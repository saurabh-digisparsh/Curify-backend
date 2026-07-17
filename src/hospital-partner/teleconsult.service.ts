import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { join } from 'path';
import { TeleconsultStatus, TeleconsultDocSender } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { VideoService } from './video.service';
import { NotificationService } from './notification.service';
import { HOSPITAL_DOCS_DIR } from './docs.storage';
import { BookTeleconsultDto, QuoteDto } from './dto/partner.dto';

// Documents shared during a consult — safe fields (never the on-disk filename).
const DOC_SELECT = {
  id: true, sender: true, kind: true, originalName: true, createdAt: true,
} as const;

// Fields safe to return to a patient — never the room name (that's only handed
// out through the ownership-checked token endpoints). Includes the doctor's quote
// and the documents exchanged so the patient can review them.
const TELECONSULT_SELECT = {
  id: true, scheduledAt: true, status: true, startedAt: true, endedAt: true, journeyId: true,
  quoteAmount: true, quoteCurrency: true, quoteNote: true, quotedAt: true, quoteAcceptedAt: true,
  doctor: { select: { id: true, name: true, specialty: true, application: { select: { legalName: true } } } },
  documents: { select: DOC_SELECT, orderBy: { createdAt: 'asc' as const } },
} as const;

// The monitoring shape shown to the hospital dashboard: status/lifecycle,
// quotation, patient (name only — no PII leak across the hospital), documents.
const MONITOR_SELECT = {
  id: true, scheduledAt: true, status: true, startedAt: true, endedAt: true,
  quoteAmount: true, quoteCurrency: true, quoteNote: true, quotedAt: true,
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
  constructor(private prisma: PrismaService, private video: VideoService, private notif: NotificationService) {}

  // ─── Patient side (JWT) ─────────────────────────────────────────────────────

  /** Instants already taken (scheduled or live) for a doctor, from now on — so
   *  slot generation and booking never hand out a slot twice. */
  private async bookedMs(doctorId: string): Promise<Set<number>> {
    const rows = await this.prisma.teleconsult.findMany({
      where: {
        doctorId, scheduledAt: { gte: new Date() },
        status: { in: [TeleconsultStatus.SCHEDULED, TeleconsultStatus.IN_PROGRESS] },
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
      const existing = await this.prisma.teleconsult.findFirst({
        where: { journeyId: dto.journeyId, status: { in: [TeleconsultStatus.SCHEDULED, TeleconsultStatus.IN_PROGRESS] } },
        select: { id: true },
      });
      if (existing) throw new BadRequestException('You already have a consultation booked for this journey. Cancel it first to rebook.');
    }

    const wanted = new Date(dto.scheduledAt).toISOString();
    const open = computeSlots(doc.timezone, doc.windows, await this.bookedMs(doc.id));
    if (!open.includes(wanted)) throw new BadRequestException('That time is no longer available. Please pick another slot.');

    const tc = await this.prisma.teleconsult.create({
      data: { patientId: userId, doctorId: doc.id, journeyId: dto.journeyId ?? null, scheduledAt: new Date(wanted) },
      select: TELECONSULT_SELECT,
    });

    // Email both sides the join links + calendar invites (fire-and-forget: mail
    // never throws, and a mail hiccup must not fail the booking).
    const patient = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
    this.notif.sendTeleconsultBooked({
      teleconsultId: tc.id, scheduledAt: new Date(wanted),
      patient: { email: patient?.email, name: patient?.name },
      doctor: { name: doc.name, email: doc.email, availabilityToken: doc.availabilityToken, timezone: doc.timezone },
    }).catch(() => {});

    return tc;
  }

  /** Patient cancels their own consult — frees the journey to rebook. */
  async cancel(userId: string, id: string) {
    const tc = await this.prisma.teleconsult.findUnique({ where: { id }, select: { patientId: true, status: true } });
    if (!tc || tc.patientId !== userId) throw new NotFoundException('Consultation not found');
    if (tc.status === TeleconsultStatus.COMPLETED) throw new BadRequestException('This consultation is already completed.');
    await this.prisma.teleconsult.update({ where: { id }, data: { status: TeleconsultStatus.CANCELLED } });
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

  /** The caller's teleconsults (with quote + documents). */
  mine(userId: string) {
    return this.prisma.teleconsult.findMany({
      where: { patientId: userId },
      orderBy: { scheduledAt: 'asc' },
      select: TELECONSULT_SELECT,
    });
  }

  /** Patient join token — must own the teleconsult (active = scheduled or live). */
  async patientVideoToken(userId: string, id: string) {
    const tc = await this.prisma.teleconsult.findUnique({
      where: { id },
      select: { patientId: true, status: true, roomName: true, patient: { select: { name: true } } },
    });
    if (!tc || tc.patientId !== userId) throw new NotFoundException('Consultation not found');
    if (tc.status !== TeleconsultStatus.SCHEDULED && tc.status !== TeleconsultStatus.IN_PROGRESS) {
      throw new BadRequestException('This consultation is not active.');
    }
    return this.video.mintJitsi(tc.roomName, { id: userId, name: tc.patient?.name || 'Patient' }, false);
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
      where: { id }, select: { doctorId: true, status: true, roomName: true, startedAt: true },
    });
    if (!tc || tc.doctorId !== doc.id) throw new NotFoundException('Consultation not found');
    if (tc.status === TeleconsultStatus.COMPLETED || tc.status === TeleconsultStatus.CANCELLED) {
      throw new BadRequestException('This consultation is not active.');
    }
    // Doctor joining marks the consult "connected / live now".
    if (tc.status === TeleconsultStatus.SCHEDULED) {
      await this.prisma.teleconsult.update({
        where: { id }, data: { status: TeleconsultStatus.IN_PROGRESS, startedAt: tc.startedAt ?? new Date() },
      });
    }
    return this.video.mintJitsi(tc.roomName, { id: doc.id, name: `Dr ${doc.name}` }, true);
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
