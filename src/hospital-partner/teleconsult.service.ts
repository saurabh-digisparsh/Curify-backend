import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { join } from 'path';
import { TeleconsultStatus, TeleconsultDocSender } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../admin/settings/settings.service';
import { VideoService } from './video.service';
import { NotificationService } from './notification.service';
import { HOSPITAL_DOCS_DIR } from './docs.storage';
import { BookTeleconsultDto, QuoteDto } from './dto/partner.dto';

// Free video consultations included per journey. Beyond this the patient pays the
// admin-configured TELECONSULT_FEE before the held slot becomes a real booking.
// ponytail: a constant, not a setting — move it next to TELECONSULT_FEE in
//   settings.registry.ts when the allowance itself needs changing without a deploy.
const FREE_CONSULTS_PER_JOURNEY = 2;

// Statuses that consume the free allowance: booked and not cancelled. A cancelled
// consult hands the free slot back, and PENDING_PAYMENT is excluded because it is a
// PAID consult mid-checkout — an abandoned one must never eat a free slot.
const QUOTA_STATUSES = [
  TeleconsultStatus.SCHEDULED,
  TeleconsultStatus.IN_PROGRESS,
  TeleconsultStatus.COMPLETED,
] as const;

// How long the patient has to finish checkout before the held slot is released.
const HOLD_MINUTES = 15;

// How long a FREE consultation's room stays open. Paid consults are uncapped —
// they bought the call, so we don't cut them off.
// ponytail: constants, not settings — move next to TELECONSULT_FEE in
//   settings.registry.ts when these need changing without a deploy.
const FREE_CONSULT_MINUTES = 15;

// Nobody may open the room before its scheduled time. The 30s of slack absorbs
// clock skew between the browser and this server — without it a user whose clock
// runs slightly slow watches the countdown hit 0:00 and still get refused.
const JOIN_GRACE_MS = 30_000;

// Documents shared during a consult — safe fields (never the on-disk filename).
const DOC_SELECT = {
  id: true, sender: true, kind: true, originalName: true, createdAt: true,
} as const;

// Fields safe to return to a patient — never the room name (that's only handed
// out through the ownership-checked token endpoints). Includes the doctor's quote
// and the documents exchanged so the patient can review them.
const TELECONSULT_SELECT = {
  id: true, scheduledAt: true, status: true, startedAt: true, endedAt: true, journeyId: true,
  // Set only while PENDING_PAYMENT — lets the UI show the checkout countdown.
  holdExpiresAt: true,
  quoteAmount: true, quoteCurrency: true, quoteNote: true, quotedAt: true, quoteAcceptedAt: true,
  // So the patient sees "your doctor cancelled — here's why" rather than a bare
  // CANCELLED pill, and knows their free consultation was handed back.
  cancelledBy: true, cancelReason: true,
  doctor: { select: { id: true, name: true, specialty: true, application: { select: { legalName: true } } } },
  documents: { select: DOC_SELECT, orderBy: { createdAt: 'asc' as const } },
} as const;

// The monitoring shape shown to the hospital dashboard: status/lifecycle,
// quotation, patient (name only — no PII leak across the hospital), documents.
const MONITOR_SELECT = {
  id: true, scheduledAt: true, status: true, startedAt: true, endedAt: true,
  quoteAmount: true, quoteCurrency: true, quoteNote: true, quotedAt: true,
  cancelledBy: true, cancelReason: true,
  patient: { select: { name: true } },
  doctor: { select: { id: true, name: true, specialty: true } },
  documents: { select: DOC_SELECT, orderBy: { createdAt: 'asc' as const } },
} as const;

// The doctor's OWN consult list additionally exposes the patient's email — the
// treating doctor legitimately needs to identify their patient (a generic/blank
// display name would otherwise read as just "Patient").
const DOCTOR_MONITOR_SELECT = {
  ...MONITOR_SELECT,
  patient: { select: { name: true, email: true } },
} as const;

// ─── Slot generation from recurring weekly availability ──────────────────────
// Doctors set recurring weekly windows as "HH:mm–HH:mm on weekday N" in their own
// IANA timezone; we turn those into concrete bookable UTC instants. Done with
// native Intl (no tz dependency) so DST is handled correctly.
const SLOT_MINUTES = 30;
const HORIZON_DAYS = 14;
type Win = { weekday: number; start: string; end: string };

/** The calendar Y/M/D of an instant *as seen in* an IANA timezone. */
function tzYMD(date: Date, timeZone: string) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const g = (t: string) => Number(p.find((x) => x.type === t)!.value);
  return { y: g('year'), m: g('month'), d: g('day') };
}

/** Convert a wall-clock time (m0 is 0-based) in `timeZone` to a UTC instant. */
export function zonedWallToUtc(y: number, m0: number, d: number, hh: number, mm: number, timeZone: string): Date {
  const guess = Date.UTC(y, m0, d, hh, mm);
  // Offset such that the same wall clock, read back in the tz, matches — one pass
  // is exact except across the ~1hr/yr DST fold, which consult slots can tolerate.
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(guess));
  const g = (t: string) => Number(p.find((x) => x.type === t)!.value);
  const wallAsUtc = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute'), g('second'));
  return new Date(guess - (wallAsUtc - guess));
}

/** 30-min slot start times [h, m] that fully fit inside an "HH:mm"–"HH:mm" window. */
export function* slotStarts(start: string, end: string): Generator<[number, number]> {
  const toMin = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
  const e = toMin(end);
  for (let t = toMin(start); t + SLOT_MINUTES <= e; t += SLOT_MINUTES) yield [Math.floor(t / 60), t % 60];
}

/** Bookable UTC instants (ISO strings, ascending) for the next HORIZON_DAYS from
 *  the doctor's weekly windows, dropping past and already-booked slots. */
export function computeSlots(timeZone: string, windows: Win[], bookedMs: Set<number>): string[] {
  if (windows.length === 0) return [];
  const now = Date.now();
  const seen = new Set<string>();
  for (let day = 0; day < HORIZON_DAYS; day++) {
    const { y, m, d } = tzYMD(new Date(now + day * 86_400_000), timeZone);
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    for (const w of windows) {
      if (w.weekday !== weekday) continue;
      for (const [hh, mm] of slotStarts(w.start, w.end)) {
        const inst = zonedWallToUtc(y, m - 1, d, hh, mm, timeZone);
        const t = inst.getTime();
        if (t <= now || bookedMs.has(t)) continue;
        seen.add(inst.toISOString());
      }
    }
  }
  return [...seen].sort();
}

@Injectable()
export class TeleconsultService {
  private readonly log = new Logger(TeleconsultService.name);

  constructor(
    private prisma: PrismaService,
    private video: VideoService,
    private notif: NotificationService,
    private settings: SettingsService,
  ) {}

  // ─── Patient side (JWT) ─────────────────────────────────────────────────────

  /** Instants already taken (scheduled or live) for a doctor, from now on — so
   *  slot generation and booking never hand out a slot twice. */
  private async bookedMs(doctorId: string): Promise<Set<number>> {
    const now = new Date();
    const rows = await this.prisma.teleconsult.findMany({
      where: {
        doctorId, scheduledAt: { gte: now },
        OR: [
          { status: { in: [TeleconsultStatus.SCHEDULED, TeleconsultStatus.IN_PROGRESS] } },
          // An unpaid hold keeps its slot only until it expires, so an abandoned
          // checkout can't park a doctor's slot forever (lazy expiry — no cron).
          { status: TeleconsultStatus.PENDING_PAYMENT, holdExpiresAt: { gt: now } },
        ],
      },
      select: { scheduledAt: true },
    });
    return new Set(rows.map((r) => r.scheduledAt.getTime()));
  }

  /** Open teleconsult slots a patient can book with this doctor over the next two
   *  weeks — derived from the doctor's recurring weekly windows (FR-27). */
  async availableSlots(doctorId: string): Promise<string[]> {
    // Video not configured → no bookable slots at all (scheduling flow is skipped).
    if (!(await this.video.enabled())) return [];
    const doc = await this.prisma.onboardingDoctor.findFirst({
      where: { id: doctorId, teleconsultEnabled: true },
      select: { timezone: true, windows: { select: { weekday: true, start: true, end: true } } },
    });
    if (!doc) throw new NotFoundException('This doctor is not available for teleconsults.');
    return computeSlots(doc.timezone, doc.windows, await this.bookedMs(doctorId));
  }

  /**
   * Patient books a teleconsult with a doctor who has teleconsults enabled. The
   * chosen time must be one of the doctor's currently-open slots — this rejects
   * past times, times outside the doctor's windows, and already-taken slots.
   * The unguessable room is minted by the schema default at create.
   *
   * ponytail: recompute-and-check, not a DB lock — a rare double-book race just
   * means two consults share a slot; add a unique (doctorId, scheduledAt) index
   * if that ever matters.
   */
  /**
   * Free-allowance state for one journey. Drives the scheduler copy ("1 free
   * consultation left" vs "$49 for this consultation") AND is the server-side gate
   * in book() — the client never decides whether a consult is free.
   *
   * The allowance is per JOURNEY; consults with no journey (legacy / dashboard-
   * initiated) share a single bucket keyed on the patient alone.
   */
  async quota(userId: string, journeyId?: string) {
    const used = await this.prisma.teleconsult.count({
      where: { patientId: userId, journeyId: journeyId ?? null, status: { in: [...QUOTA_STATUSES] } },
    });
    const remaining = Math.max(0, FREE_CONSULTS_PER_JOURNEY - used);
    const fee = await this.settings.getNumber('TELECONSULT_FEE');
    return {
      used,
      limit: FREE_CONSULTS_PER_JOURNEY,
      remaining,
      // A fee of 0 means the admin has turned charging off — everything stays free.
      requiresPayment: remaining === 0 && fee > 0,
      fee,
      currency: process.env.RAZORPAY_CURRENCY || 'USD',
    };
  }

  async book(userId: string, dto: BookTeleconsultDto) {
    // Never accept a booking we could not host — the join call would 503 later.
    if (!(await this.video.enabled())) {
      throw new BadRequestException('Video consultations are currently unavailable.');
    }
    const doc = await this.prisma.onboardingDoctor.findFirst({
      where: { id: dto.doctorId, teleconsultEnabled: true },
      select: { id: true, name: true, email: true, timezone: true, availabilityToken: true, windows: { select: { weekday: true, start: true, end: true } } },
    });
    if (!doc) throw new NotFoundException('This doctor is not available for teleconsults.');

    // One active consult per journey: block a second booking on the same journey.
    if (dto.journeyId) {
      const now = new Date();
      const existing = await this.prisma.teleconsult.findFirst({
        where: {
          journeyId: dto.journeyId,
          OR: [
            { status: { in: [TeleconsultStatus.SCHEDULED, TeleconsultStatus.IN_PROGRESS] } },
            { status: TeleconsultStatus.PENDING_PAYMENT, holdExpiresAt: { gt: now } },
          ],
        },
        select: { id: true, status: true, patientId: true },
      });
      // The patient's OWN unpaid hold is replaced, not treated as a clash: they
      // abandoned checkout and came back to pick a different slot, and making them
      // wait out the 15-minute hold would be a dead end.
      if (existing?.status === TeleconsultStatus.PENDING_PAYMENT && existing.patientId === userId) {
        await this.prisma.teleconsult.update({
          where: { id: existing.id },
          data: { status: TeleconsultStatus.CANCELLED, holdExpiresAt: null },
        });
      } else if (existing) {
        throw new BadRequestException('You already have a consultation booked for this journey. Cancel it first to rebook.');
      }
    }

    const wanted = new Date(dto.scheduledAt).toISOString();
    const open = computeSlots(doc.timezone, doc.windows, await this.bookedMs(doc.id));
    if (!open.includes(wanted)) throw new BadRequestException('That time is no longer available. Please pick another slot.');

    // Server-side gate: the client tells us nothing about price or entitlement.
    const q = await this.quota(userId, dto.journeyId);

    const tc = await this.prisma.teleconsult.create({
      data: {
        patientId: userId, doctorId: doc.id, journeyId: dto.journeyId ?? null,
        scheduledAt: new Date(wanted),
        // Out of free consults → the slot is only HELD until checkout completes.
        ...(q.requiresPayment
          ? {
              status: TeleconsultStatus.PENDING_PAYMENT,
              holdExpiresAt: new Date(Date.now() + HOLD_MINUTES * 60_000),
            }
          : {}),
      },
      select: TELECONSULT_SELECT,
    });

    // Paid consult: not a real booking yet. No confirmation mail and no join token
    // until PaymentsService captures the payment and calls activatePaidConsult().
    if (q.requiresPayment) {
      return { ...tc, requiresPayment: true, fee: q.fee, currency: q.currency, holdMinutes: HOLD_MINUTES };
    }

    // Email both sides the join links + calendar invites (fire-and-forget: mail
    // never throws, and a mail hiccup must not fail the booking).
    const patient = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
    this.notif.sendTeleconsultBooked({
      teleconsultId: tc.id, scheduledAt: new Date(wanted),
      patient: { email: patient?.email, name: patient?.name },
      doctor: { name: doc.name, email: doc.email, availabilityToken: doc.availabilityToken, timezone: doc.timezone },
    }).catch(() => {});

    return { ...tc, requiresPayment: false };
  }

  /**
   * Payment captured → the held slot becomes a real booking. Called by
   * PaymentsService; the dependency runs payments → hospital-partner only (this
   * service never imports PaymentsService), so there is no module cycle.
   *
   * Idempotent: the sync /payments/verify call and the Razorpay webhook can both
   * land, so the PENDING_PAYMENT → SCHEDULED move is a conditional update and only
   * the winner sends the confirmation mail. Returns whether it made the transition.
   */
  async activatePaidConsult(teleconsultId: string, paymentId: string): Promise<boolean> {
    const tc = await this.prisma.teleconsult.findUnique({
      where: { id: teleconsultId },
      select: {
        id: true, status: true, doctorId: true, scheduledAt: true,
        patient: { select: { email: true, name: true } },
        doctor: { select: { name: true, email: true, availabilityToken: true, timezone: true } },
      },
    });
    if (!tc || tc.status !== TeleconsultStatus.PENDING_PAYMENT) return false;

    // The hold can expire while the patient is in checkout, and a slow payer may
    // come back to find the slot gone. Never activate into a double-booking — the
    // payment stands and support refunds or reschedules it.
    const clash = await this.prisma.teleconsult.findFirst({
      where: {
        id: { not: tc.id }, doctorId: tc.doctorId, scheduledAt: tc.scheduledAt,
        status: { in: [TeleconsultStatus.SCHEDULED, TeleconsultStatus.IN_PROGRESS] },
      },
      select: { id: true },
    });
    if (clash) {
      this.log.error(
        `Paid teleconsult ${tc.id} lost its held slot to ${clash.id}; payment ${paymentId} needs a refund or reschedule.`,
      );
      return false;
    }

    const res = await this.prisma.teleconsult.updateMany({
      where: { id: tc.id, status: TeleconsultStatus.PENDING_PAYMENT },
      data: { status: TeleconsultStatus.SCHEDULED, paymentId, holdExpiresAt: null },
    });
    if (res.count !== 1) return false; // a concurrent writer already activated it

    this.notif.sendTeleconsultBooked({
      teleconsultId: tc.id, scheduledAt: tc.scheduledAt,
      patient: { email: tc.patient?.email, name: tc.patient?.name },
      doctor: tc.doctor,
    }).catch(() => {});
    return true;
  }

  /** Patient cancels their own consult — frees the journey to rebook. The optional
   *  comment is kept so the hospital/doctor sees why the slot came back. */
  async cancel(userId: string, id: string, reason?: string) {
    const tc = await this.prisma.teleconsult.findUnique({ where: { id }, select: { patientId: true, status: true } });
    if (!tc || tc.patientId !== userId) throw new NotFoundException('Consultation not found');
    if (tc.status === TeleconsultStatus.COMPLETED) throw new BadRequestException('This consultation is already completed.');
    await this.prisma.teleconsult.update({
      where: { id },
      data: { status: TeleconsultStatus.CANCELLED, cancelledBy: 'PATIENT', cancelReason: reason?.trim() || null },
    });
    return this.mine(userId);
  }

  /**
   * Patient accepts the doctor's quote — the go-signal that unlocks trip planning.
   * Requires a quote to exist; idempotent (re-accepting keeps the first timestamp).
   */
  async acceptQuote(userId: string, id: string) {
    const tc = await this.prisma.teleconsult.findUnique({
      where: { id }, select: { patientId: true, quoteAmount: true, quoteAcceptedAt: true },
    });
    if (!tc || tc.patientId !== userId) throw new NotFoundException('Consultation not found');
    if (tc.quoteAmount == null) throw new BadRequestException('The doctor has not sent a quote yet.');
    if (!tc.quoteAcceptedAt) {
      await this.prisma.teleconsult.update({ where: { id }, data: { quoteAcceptedAt: new Date() } });
    }
    return this.mine(userId);
  }

  /** The caller's teleconsults (with quote + documents). Expired unpaid holds are
   *  hidden — they never became bookings, so showing them would just be clutter
   *  that also blocks the scheduler UI. */
  mine(userId: string) {
    const now = new Date();
    return this.prisma.teleconsult.findMany({
      where: {
        patientId: userId,
        NOT: { status: TeleconsultStatus.PENDING_PAYMENT, holdExpiresAt: { lte: now } },
      },
      orderBy: { scheduledAt: 'asc' },
      select: TELECONSULT_SELECT,
    });
  }

  /**
   * When this call's room must close, as an ISO string — or null for "no limit".
   *
   * Free consultations get FREE_CONSULT_MINUTES from the moment the room first
   * opens; paid ones are uncapped. The clock is anchored to startedAt, and THIS
   * is the only place that stamps it, so whoever joins first starts the clock and
   * both sides are then handed the identical deadline. The client counts down to
   * it but never decides it.
   */
  /**
   * The room opens at the appointment time, not before. Enforced here rather than
   * only in the UI: the join token IS the key to the room, so handing one out early
   * would let anyone bypass the countdown by calling the endpoint directly.
   */
  private assertJoinWindowOpen(scheduledAt: Date) {
    const msAway = scheduledAt.getTime() - Date.now();
    if (msAway > JOIN_GRACE_MS) {
      throw new BadRequestException(
        `This consultation starts at ${scheduledAt.toISOString()}. You can join once it begins.`,
      );
    }
  }

  private async callDeadline(tc: { id: string; paymentId: string | null; startedAt: Date | null }): Promise<string | null> {
    if (tc.paymentId) return null; // paid consult — they bought the time
    let startedAt = tc.startedAt;
    if (!startedAt) {
      // Conditional write: if the other side stamped it a moment ago, keep THEIRS,
      // otherwise the two participants would count down to different instants.
      await this.prisma.teleconsult.updateMany({
        where: { id: tc.id, startedAt: null }, data: { startedAt: new Date() },
      });
      startedAt = (await this.prisma.teleconsult.findUnique({
        where: { id: tc.id }, select: { startedAt: true },
      }))?.startedAt ?? new Date();
    }
    return new Date(startedAt.getTime() + FREE_CONSULT_MINUTES * 60_000).toISOString();
  }

  /** Patient join token — must own the teleconsult (active = scheduled or live). */
  async patientVideoToken(userId: string, id: string) {
    const tc = await this.prisma.teleconsult.findUnique({
      where: { id },
      select: {
        id: true, patientId: true, status: true, roomName: true, scheduledAt: true,
        paymentId: true, startedAt: true, patient: { select: { name: true } },
      },
    });
    if (!tc || tc.patientId !== userId) throw new NotFoundException('Consultation not found');
    if (tc.status !== TeleconsultStatus.SCHEDULED && tc.status !== TeleconsultStatus.IN_PROGRESS) {
      throw new BadRequestException('This consultation is not active.');
    }
    this.assertJoinWindowOpen(tc.scheduledAt);
    const token = await this.video.mintJitsi(tc.roomName, { id: userId, name: tc.patient?.name || 'Patient' }, false);
    return { ...token, endsAt: await this.callDeadline(tc) };
  }

  /** Patient shares a document (report/scan) into a consult they own. */
  async patientAddDoc(userId: string, id: string, file: Express.Multer.File, kind?: string) {
    if (!file) throw new BadRequestException('No file uploaded');
    const tc = await this.prisma.teleconsult.findUnique({ where: { id }, select: { patientId: true } });
    if (!tc || tc.patientId !== userId) throw new NotFoundException('Consultation not found');
    await this.prisma.teleconsultDocument.create({
      data: { teleconsultId: id, sender: TeleconsultDocSender.PATIENT, kind: kind || null, fileUrl: file.filename, originalName: file.originalname },
    });
    return this.mine(userId);
  }

  // ─── Doctor side (public, scoped by availabilityToken) ──────────────────────

  /** Doctor join token — scoped by the doctor's secret availabilityToken; must
   *  own the teleconsult. First join flips SCHEDULED → IN_PROGRESS (connected). */
  async doctorVideoToken(availabilityToken: string, id: string) {
    const doc = await this.prisma.onboardingDoctor.findUnique({
      where: { availabilityToken }, select: { id: true, name: true },
    });
    if (!doc) throw new NotFoundException('Invalid or expired link');
    const tc = await this.prisma.teleconsult.findUnique({
      where: { id },
      select: { id: true, doctorId: true, status: true, roomName: true, scheduledAt: true, startedAt: true, paymentId: true },
    });
    if (!tc || tc.doctorId !== doc.id) throw new NotFoundException('Consultation not found');
    if (tc.status === TeleconsultStatus.COMPLETED || tc.status === TeleconsultStatus.CANCELLED) {
      throw new BadRequestException('This consultation is not active.');
    }
    this.assertJoinWindowOpen(tc.scheduledAt);
    // Doctor joining marks the consult "connected / live now". startedAt is left to
    // callDeadline so a single place owns the clock (the patient may have opened
    // the room first, and that earlier instant is the one that counts).
    if (tc.status === TeleconsultStatus.SCHEDULED) {
      await this.prisma.teleconsult.update({
        where: { id }, data: { status: TeleconsultStatus.IN_PROGRESS },
      });
    }
    // Some doctor names already carry the honorific — prefix only when missing,
    // otherwise the call header reads "Dr Dr. Anita Rao".
    const display = /^dr\.?\s/i.test(doc.name) ? doc.name : `Dr. ${doc.name}`;
    const token = await this.video.mintJitsi(tc.roomName, { id: doc.id, name: display }, true);
    return { ...token, endsAt: await this.callDeadline(tc) };
  }

  private async doctorTcOrThrow(token: string, id: string) {
    const doc = await this.prisma.onboardingDoctor.findUnique({ where: { availabilityToken: token }, select: { id: true } });
    if (!doc) throw new NotFoundException('Invalid or expired link');
    const tc = await this.prisma.teleconsult.findUnique({ where: { id }, select: { id: true, doctorId: true } });
    if (!tc || tc.doctorId !== doc.id) throw new NotFoundException('Consultation not found');
    return { doc, tc };
  }

  /** All of this doctor's consultations (for the doctor's link-page management). */
  async doctorConsults(token: string) {
    const doc = await this.prisma.onboardingDoctor.findUnique({ where: { availabilityToken: token }, select: { id: true } });
    if (!doc) throw new NotFoundException('Invalid or expired link');
    return this.prisma.teleconsult.findMany({
      where: { doctorId: doc.id }, orderBy: { scheduledAt: 'desc' }, select: DOCTOR_MONITOR_SELECT,
    });
  }

  /** Doctor records the price quotation given to the patient. */
  async setQuote(token: string, id: string, dto: QuoteDto) {
    await this.doctorTcOrThrow(token, id);
    await this.prisma.teleconsult.update({
      where: { id },
      data: { quoteAmount: dto.amount, quoteCurrency: dto.currency || 'USD', quoteNote: dto.note ?? null, quotedAt: new Date() },
    });
    return this.doctorConsults(token);
  }

  /**
   * Doctor calls off a booked consultation. The patient is emailed straight away
   * (they planned their day around it), and because the free-consult allowance
   * only counts SCHEDULED/IN_PROGRESS/COMPLETED, a doctor-side cancellation gives
   * the free consultation back automatically — the patient is never charged for a
   * call the hospital cancelled.
   */
  async doctorCancel(token: string, id: string, reason?: string) {
    await this.doctorTcOrThrow(token, id);
    const tc = await this.prisma.teleconsult.findUnique({
      where: { id },
      select: {
        id: true, status: true, scheduledAt: true, journeyId: true,
        patient: { select: { email: true, name: true } },
        doctor: { select: { name: true } },
      },
    });
    if (!tc) throw new NotFoundException('Consultation not found');
    if (tc.status === TeleconsultStatus.COMPLETED) throw new BadRequestException('This consultation is already completed.');
    if (tc.status === TeleconsultStatus.CANCELLED) return this.doctorConsults(token); // idempotent

    await this.prisma.teleconsult.update({
      where: { id },
      data: { status: TeleconsultStatus.CANCELLED, cancelledBy: 'DOCTOR', cancelReason: reason?.trim() || null, holdExpiresAt: null },
    });
    // Fire-and-forget: a mail hiccup must not fail the cancellation itself.
    this.notif.sendTeleconsultCancelled({
      teleconsultId: tc.id, scheduledAt: tc.scheduledAt, reason: reason?.trim(),
      patient: tc.patient, doctorName: tc.doctor.name,
    }).catch(() => {});
    return this.doctorConsults(token);
  }

  /** Doctor marks the consult finished (COMPLETED + endedAt for the duration). */
  async doctorComplete(token: string, id: string) {
    await this.doctorTcOrThrow(token, id);
    await this.prisma.teleconsult.update({
      where: { id }, data: { status: TeleconsultStatus.COMPLETED, endedAt: new Date() },
    });
    return this.doctorConsults(token);
  }

  /**
   * The doctor left/ended the video call. This is the reliable "the call is over"
   * signal (VideoRoom's hang-up), so a live consult transitions to COMPLETED with
   * endedAt — otherwise it stays stuck on "Live now" forever. Idempotent: a consult
   * that isn't live is left untouched (e.g. already completed, or never started).
   */
  async doctorEndCall(token: string, id: string) {
    await this.doctorTcOrThrow(token, id);
    const cur = await this.prisma.teleconsult.findUnique({ where: { id }, select: { status: true } });
    if (cur?.status === TeleconsultStatus.IN_PROGRESS) {
      await this.prisma.teleconsult.update({
        where: { id }, data: { status: TeleconsultStatus.COMPLETED, endedAt: new Date() },
      });
    }
    return this.doctorConsults(token);
  }

  /** Doctor shares a document (prescription/report/quotation…) into the consult. */
  async doctorAddDoc(token: string, id: string, file: Express.Multer.File, kind?: string) {
    if (!file) throw new BadRequestException('No file uploaded');
    await this.doctorTcOrThrow(token, id);
    await this.prisma.teleconsultDocument.create({
      data: { teleconsultId: id, sender: TeleconsultDocSender.DOCTOR, kind: kind || null, fileUrl: file.filename, originalName: file.originalname },
    });
    return this.doctorConsults(token);
  }

  // ─── Hospital dashboard (JWT, owner) ────────────────────────────────────────

  /** Every teleconsult across this hospital's doctors, with monitoring stats. */
  async hospitalConsults(userId: string) {
    const app = await this.prisma.hospitalApplication.findUnique({ where: { ownerUserId: userId }, select: { id: true } });
    if (!app) throw new NotFoundException('No hospital application for this account.');
    const consults = await this.prisma.teleconsult.findMany({
      where: { doctor: { applicationId: app.id } },
      orderBy: { scheduledAt: 'desc' },
      select: MONITOR_SELECT,
    });
    const stats = {
      total: consults.length,
      scheduled: consults.filter((c) => c.status === TeleconsultStatus.SCHEDULED).length,
      live: consults.filter((c) => c.status === TeleconsultStatus.IN_PROGRESS).length,
      completed: consults.filter((c) => c.status === TeleconsultStatus.COMPLETED).length,
    };
    return { consults, stats };
  }

  // ─── Document streaming (three ownership-checked access paths) ───────────────

  private async docOrThrow(docId: string) {
    const doc = await this.prisma.teleconsultDocument.findUnique({
      where: { id: docId },
      select: {
        fileUrl: true, originalName: true,
        teleconsult: { select: { patientId: true, doctor: { select: { availabilityToken: true, application: { select: { ownerUserId: true } } } } } },
      },
    });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }
  private path(doc: { fileUrl: string; originalName: string | null }) {
    return { path: join(HOSPITAL_DOCS_DIR, doc.fileUrl), name: doc.originalName || doc.fileUrl };
  }

  async docFileForHospital(docId: string, userId: string) {
    const doc = await this.docOrThrow(docId);
    if (doc.teleconsult.doctor.application?.ownerUserId !== userId) throw new ForbiddenException('Not your document');
    return this.path(doc);
  }
  async docFileForDoctor(docId: string, token: string) {
    const doc = await this.docOrThrow(docId);
    if (doc.teleconsult.doctor.availabilityToken !== token) throw new ForbiddenException('Not your document');
    return this.path(doc);
  }
  async docFileForPatient(docId: string, userId: string) {
    const doc = await this.docOrThrow(docId);
    if (doc.teleconsult.patientId !== userId) throw new ForbiddenException('Not your document');
    return this.path(doc);
  }
}
