import {
  Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { unlink } from 'fs/promises';
import { join } from 'path';
import * as bcrypt from 'bcryptjs';
import { AccreditationBody, AccreditationSource, DocStatus, OnboardingStatus, OnboardingDoctorStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from './notification.service';
import { AccreditationService } from './accreditation.service';
import { VideoService } from './video.service';
import { EnrichmentService } from '../admin/enrichment.service';
import { ScrapeService } from '../admin/scrape.service';
import { BulkImportService } from './bulk-import.service';
import { HOSPITAL_DOCS_DIR } from './docs.storage';
import {
  ApplyDto, ContactDto, VerifyOtpDto, AccreditationDto, UploadDocDto, AgreementDto,
  DoctorDto, PricingDto, ServicesDto, SetAvailabilityDto, ReviewDocDto,
} from './dto/partner.dto';

const COMMISSION = { version: '2026-v1', percentage: 15, payoutRail: 'RazorpayX' }; // BR-3 fixed terms
// Reviews the foreign pipeline collects for a newly-onboarded hospital that has none.
const ONBOARDING_REVIEW_TARGET = 10;

// What the applicant / dashboard sees (never OTP secrets or session token).
const APP_INCLUDE = {
  contact: { select: { name: true, designation: true, workEmail: true, whatsapp: true, emailVerifiedAt: true, whatsappVerifiedAt: true } },
  accreditations: true,
  documents: true,
  agreement: true,
  doctors: { include: { windows: true }, orderBy: { createdAt: 'asc' as const } },
};

function otp() { return String(Math.floor(100000 + Math.random() * 900000)); }
function tok(n = 24) { return randomBytes(n).toString('hex'); }
function slugId(name: string) {
  const base = (name || 'hospital').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'hospital';
  return `${base}-${randomBytes(3).toString('hex')}`;
}

/** Does the application hold a verified NABH/JCI accreditation? Used for the
 *  onboarding fast-track + doctor auto-approve (distinct from the admin-set
 *  "priority partner" ranking flag). */
function isAccredited(app: { accreditations?: { status: DocStatus }[] }): boolean {
  return (app.accreditations || []).some((a) => a.status === DocStatus.VERIFIED);
}

@Injectable()
export class PartnerService {
  private readonly logger = new Logger(PartnerService.name);

  constructor(
    private prisma: PrismaService,
    private notify: NotificationService,
    private accred: AccreditationService,
    private video: VideoService,
    private enrich: EnrichmentService,
    private scrape: ScrapeService,
    private bulk: BulkImportService,
  ) {}

  // ─── Public application flow (no login; scoped by sessionToken) ─────────────

  /** FR-1–4: start a self-serve application. Returns id + sessionToken handle. */
  async apply(dto: ApplyDto) {
    if (!dto.specialties?.length || !dto.insurers?.length) {
      throw new BadRequestException('At least one specialty and one insurer/self-pay option are required.');
    }
    const sessionToken = tok(24);
    const app = await this.prisma.hospitalApplication.create({
      data: {
        legalName: dto.legalName, city: dto.city, address: dto.address,
        registrationNo: dto.registrationNo, ownership: dto.ownership, website: dto.website,
        totalBeds: dto.totalBeds, icuBeds: dto.icuBeds, airportDistanceKm: dto.airportDistanceKm,
        specialties: dto.specialties, insurers: dto.insurers,
        languages: dto.languages ?? [], intlFacilities: dto.intlFacilities ?? [],
        status: OnboardingStatus.DRAFT, sessionToken,
      },
    });
    return { id: app.id, sessionToken, status: app.status };
  }

  private async bySession(id: string, sessionToken: string) {
    const app = await this.prisma.hospitalApplication.findUnique({ where: { id }, include: APP_INCLUDE });
    if (!app || app.sessionToken !== sessionToken) throw new NotFoundException('Application not found');
    if (app.status === OnboardingStatus.LIVE || app.ownerUserId) {
      throw new ForbiddenException('This application is already provisioned.');
    }
    return app;
  }

  /** Public read of an in-progress application (resume the flow). */
  async getApplication(id: string, sessionToken: string) {
    const app = await this.bySession(id, sessionToken);
    return this.publicView(app);
  }

  private publicView(app: any) {
    const { sessionToken, ...rest } = app;
    return { ...rest, commission: COMMISSION };
  }

  /** FR-5/6 + FR-7: capture contact and send both OTPs. */
  async setContact(id: string, sessionToken: string, dto: ContactDto) {
    await this.bySession(id, sessionToken);
    const emailOtp = otp(); const waOtp = otp();
    const exp = new Date(Date.now() + 10 * 60 * 1000);
    // WhatsApp verification is disabled for now — the contact's WhatsApp is
    // auto-marked verified so only the email OTP gates the flow. Re-enable by
    // reverting whatsappVerifiedAt to null and uncommenting sendWhatsappOtp below.
    await this.prisma.authorisedContact.upsert({
      where: { applicationId: id },
      create: { applicationId: id, ...dto, emailOtp, emailOtpExp: exp, waOtp, waOtpExp: exp, whatsappVerifiedAt: new Date() },
      update: { ...dto, emailVerifiedAt: null, whatsappVerifiedAt: new Date(), emailOtp, emailOtpExp: exp, emailOtpTries: 0, waOtp, waOtpExp: exp, waOtpTries: 0 },
    });
    await this.prisma.hospitalApplication.update({ where: { id }, data: { status: OnboardingStatus.CONTACT_VERIFYING } });
    await this.notify.sendEmailOtp(dto.workEmail, emailOtp);
    // await this.notify.sendWhatsappOtp(dto.whatsapp, waOtp); // WhatsApp OTP disabled for now
    return { sent: true };
  }

  async resendOtps(id: string, sessionToken: string) {
    const app = await this.bySession(id, sessionToken);
    if (!app.contact) throw new BadRequestException('Add the authorised contact first.');
    return this.setContact(id, sessionToken, {
      name: app.contact.name, designation: app.contact.designation ?? undefined,
      workEmail: app.contact.workEmail, whatsapp: app.contact.whatsapp,
    });
  }

  /** FR-7/8: verify one channel's OTP; both must pass before continuing. */
  async verifyOtp(id: string, sessionToken: string, dto: VerifyOtpDto) {
    await this.bySession(id, sessionToken);
    const c = await this.prisma.authorisedContact.findUnique({ where: { applicationId: id } });
    if (!c) throw new BadRequestException('Add the authorised contact first.');
    const isEmail = dto.channel === 'email';
    const code = isEmail ? c.emailOtp : c.waOtp;
    const exp = isEmail ? c.emailOtpExp : c.waOtpExp;
    const tries = isEmail ? c.emailOtpTries : c.waOtpTries;
    if (!code || !exp) throw new BadRequestException('Request a code first.');
    if (exp < new Date()) throw new BadRequestException('This code has expired — resend a new one.');
    if (tries >= 6) throw new BadRequestException('Too many attempts — resend a new code.');
    if (dto.code !== code) {
      await this.prisma.authorisedContact.update({ where: { applicationId: id }, data: isEmail ? { emailOtpTries: { increment: 1 } } : { waOtpTries: { increment: 1 } } });
      throw new BadRequestException('Incorrect code — please try again.');
    }
    const updated = await this.prisma.authorisedContact.update({
      where: { applicationId: id },
      data: isEmail ? { emailVerifiedAt: new Date(), emailOtp: null } : { whatsappVerifiedAt: new Date(), waOtp: null },
    });
    const bothVerified = !!updated.emailVerifiedAt && !!updated.whatsappVerifiedAt;
    if (bothVerified) await this.prisma.hospitalApplication.update({ where: { id }, data: { status: OnboardingStatus.ACCREDITATION } });
    return { emailVerified: !!updated.emailVerifiedAt, whatsappVerified: !!updated.whatsappVerifiedAt, bothVerified };
  }

  private assertContactVerified(app: any) {
    if (!app.contact?.emailVerifiedAt || !app.contact?.whatsappVerifiedAt) {
      throw new ForbiddenException('Verify email and WhatsApp first.');
    }
  }

  /** FR-9/10: add a NABH/JCI accreditation and try registry fast-track. */
  async addAccreditation(id: string, sessionToken: string, dto: AccreditationDto) {
    const app = await this.bySession(id, sessionToken);
    this.assertContactVerified(app);
    const hit = this.accred.verify(dto.body, dto.identifier);
    // At most one record per body — re-adding a body replaces its previous record
    // rather than stacking a second NABH/JCI card onto the application.
    await this.prisma.accreditationRecord.deleteMany({ where: { applicationId: id, body: dto.body } });
    await this.prisma.accreditationRecord.create({
      data: {
        applicationId: id, body: dto.body, identifier: dto.identifier,
        source: hit ? AccreditationSource.REGISTRY : AccreditationSource.CERT_UPLOAD,
        status: hit ? DocStatus.VERIFIED : DocStatus.PENDING,
        verifiedAt: hit ? new Date() : null, validUntil: hit?.validUntil ?? null,
      },
    });
    // Verified accreditation fast-tracks onboarding (skips the doc check). The
    // "Priority partner" ranking flag is NOT set here — it's admin-controlled
    // (see setPriority) so admins decide who gets recommendation preference.
    if (hit) await this.prisma.hospitalApplication.update({ where: { id }, data: { notAccredited: false, status: OnboardingStatus.AGREEMENT } });
    return this.getApplication(id, sessionToken);
  }

  /** FR-9/10: auto-verify accreditation by looking the hospital up in the scraped
   *  NABH/JCI registry mirror using its general info (name + city). A match
   *  auto-creates verified accreditation records; no match → document-check flow. */
  async lookupAccreditation(id: string, sessionToken: string) {
    const app = await this.bySession(id, sessionToken);
    this.assertContactVerified(app);
    // lookup() returns at most one hit per body (one NABH + one JCI).
    const hits = this.accred.lookup(app.legalName, app.city);
    // Idempotent re-scan: drop prior registry hits, re-create from the current lookup.
    await this.prisma.accreditationRecord.deleteMany({ where: { applicationId: id, source: AccreditationSource.REGISTRY } });
    // A verified registry hit supersedes any manually-added record for the same
    // body, so the applicant never ends up holding two cards for one body.
    await this.prisma.accreditationRecord.deleteMany({ where: { applicationId: id, body: { in: hits.map((h) => h.body) } } });
    for (const h of hits) {
      await this.prisma.accreditationRecord.create({
        data: { applicationId: id, body: h.body, identifier: h.identifier, source: AccreditationSource.REGISTRY, status: DocStatus.VERIFIED, verifiedAt: new Date(), validUntil: h.validUntil },
      });
    }
    if (hits.length) await this.prisma.hospitalApplication.update({ where: { id }, data: { notAccredited: false, status: OnboardingStatus.AGREEMENT } });
    const res = await this.getApplication(id, sessionToken);
    return { ...res, lookup: { found: hits.length, matchedName: hits[0]?.matchedName ?? null } };
  }

  /** FR-11: applicant declares "not accredited yet" → document-check path. */
  async markNotAccredited(id: string, sessionToken: string) {
    const app = await this.bySession(id, sessionToken);
    this.assertContactVerified(app);
    await this.prisma.hospitalApplication.update({ where: { id }, data: { notAccredited: true, priority: false, status: OnboardingStatus.VALIDATING } });
    return this.getApplication(id, sessionToken);
  }

  /** FR-11: upload a verification document (auto-classify stub = declared type). */
  async uploadDoc(id: string, sessionToken: string, file: Express.Multer.File, dto: UploadDocDto) {
    if (!file) throw new BadRequestException('No file uploaded');
    await this.bySession(id, sessionToken);
    // ponytail: real auto-classification would inspect the file; here we trust the
    // declared type and mark it VERIFIED (auto-check). Admin can override (FR-12).
    await this.prisma.onboardingDocument.create({
      data: { applicationId: id, doctorId: dto.doctorId || null, type: dto.type, autoClassifiedType: dto.type, fileUrl: file.filename, originalName: file.originalname, status: DocStatus.VERIFIED },
    });
    return this.getApplication(id, sessionToken);
  }

  async removeDoc(id: string, sessionToken: string, docId: string) {
    await this.bySession(id, sessionToken);
    const doc = await this.prisma.onboardingDocument.findUnique({ where: { id: docId } });
    if (!doc || doc.applicationId !== id) throw new NotFoundException('Document not found');
    await this.prisma.onboardingDocument.delete({ where: { id: docId } });
    await unlink(join(HOSPITAL_DOCS_DIR, doc.fileUrl)).catch(() => {});
    return this.getApplication(id, sessionToken);
  }

  /** FR-11/12: are the required non-accredited docs present + verified? */
  private docsSatisfied(app: any): boolean {
    const REQUIRED = ['REGISTRATION', 'FIRE_BUILDING_SAFETY', 'BIOMEDICAL_WASTE', 'INDEMNITY_INSURANCE', 'SIGNATORY_ID'];
    const verified = new Set(app.documents.filter((d: any) => d.status === 'VERIFIED' && !d.doctorId).map((d: any) => d.type));
    return REQUIRED.every((t) => verified.has(t));
  }

  /** FR-14–16: accept the commission agreement via typed-name e-signature. */
  async signAgreement(id: string, sessionToken: string, dto: AgreementDto, ip?: string) {
    const app = await this.bySession(id, sessionToken);
    this.assertContactVerified(app);
    if (!dto.authorised) throw new BadRequestException('You must confirm you are authorised to sign.');
    if (!isAccredited(app) && !this.docsSatisfied(app)) {
      throw new BadRequestException('Upload and pass all required verification documents first.');
    }
    await this.prisma.commissionAgreement.upsert({
      where: { applicationId: id },
      create: { applicationId: id, ...COMMISSION, signatoryName: dto.signatoryName, ip, terms: COMMISSION as any },
      update: { signatoryName: dto.signatoryName, ip, signedAt: new Date() },
    });
    await this.prisma.hospitalApplication.update({ where: { id }, data: { status: OnboardingStatus.AGREEMENT } });
    return this.getApplication(id, sessionToken);
  }

  /** FR-17–19: provision the dashboard — create the HOSPITAL user + deliver
   *  login ID + one-time password (never returned in the response body). */
  async provision(id: string, sessionToken: string) {
    const app = await this.bySession(id, sessionToken);
    if (!app.agreement) throw new BadRequestException('Sign the commission agreement first.');
    const email = app.contact!.workEmail;
    const clash = await this.prisma.user.findUnique({ where: { email } });
    if (clash) throw new BadRequestException('An account already exists for this email.');
    // Seed the comparison card with AI BEFORE issuing credentials, so the very
    // first sign-in shows a complete profile instead of an empty shell.
    await this.enrichApplication(app);
    const oneTimePassword = tok(6); // 12-hex-char temp password
    const user = await this.prisma.user.create({
      data: { email, name: app.contact!.name, role: 'HOSPITAL', country: 'India', password: await bcrypt.hash(oneTimePassword, 12), emailVerifiedAt: new Date() },
    });
    await this.prisma.hospitalApplication.update({ where: { id }, data: { ownerUserId: user.id, sessionToken: null, status: OnboardingStatus.PROVISIONED } });
    await this.notify.sendCredentials(email, app.contact!.whatsapp, email, oneTimePassword);
    return { provisioned: true, loginId: email }; // password sent out-of-band only
  }

  /**
   * AI-seed the applicant's comparison-card fields (price, local benchmark,
   * what's-included, pros/cons) so the card is complete the moment they sign in.
   * Run at provisioning, before credentials are issued.
   *
   * Only fills what the applicant left BLANK — their own numbers always win, and
   * everything here stays editable on the Pricing screen. Best-effort by design:
   * a hospital must still get its credentials when the AI is down, so a failure
   * is swallowed (go-live re-seeds anything still blank).
   */
  private async enrichApplication(app: any): Promise<void> {
    const blank = (v: any) => !v || (Array.isArray(v) && v.length === 0);
    const needs = blank(app.included) || blank(app.pros) || app.quotedPriceUsd == null || app.localBenchmarkUsd == null;
    if (!needs) return;
    try {
      const jci = !!app.accreditations?.some((a: any) => a.body === AccreditationBody.JCI && a.status === DocStatus.VERIFIED);
      // No reviews to cite yet — they're mapped onto the hospital at go-live, and
      // the prompt handles the review-less case.
      const n = await this.enrich.suggestNarrative({ name: app.legalName, city: app.city, jciAccredited: jci });
      await this.prisma.hospitalApplication.update({
        where: { id: app.id },
        data: {
          included: blank(app.included) ? n.included : undefined,
          notIncluded: blank(app.notIncluded) ? n.notIncluded : undefined,
          pros: blank(app.pros) ? n.pros : undefined,
          cons: blank(app.cons) ? n.cons : undefined,
          localBenchmarkUsd: app.localBenchmarkUsd ?? n.localBenchmarkUsd ?? undefined,
          quotedPriceUsd: app.quotedPriceUsd ?? n.quotedPriceUsd ?? undefined,
        },
      });
    } catch (e: any) {
      // Never block a hospital's credentials on enrichment.
      this.logger.warn(`provision enrich failed for "${app.legalName}": ${e.message}`);
    }
  }

  // ─── Dashboard (authenticated HOSPITAL owner) ──────────────────────────────

  private async mine(userId: string) {
    const app = await this.prisma.hospitalApplication.findUnique({ where: { ownerUserId: userId }, include: APP_INCLUDE });
    if (!app) throw new NotFoundException('No hospital application for this account.');
    return app;
  }

  /** FR-20: dashboard payload + setup checklist gating Go-live. */
  async dashboard(userId: string) {
    const app = await this.mine(userId);
    const teleDoctors = app.doctors.filter((d) => d.teleconsultEnabled);
    // Video off (missing/placeholder JITSI_APP_SECRET) → the teleconsult step is
    // not part of setup at all: it's neither shown as required nor gates go-live.
    const videoEnabled = await this.video.enabled();
    const checklist = {
      doctorsAdded: app.doctors.length > 0,
      pricingSet: app.quotedPriceUsd != null,
      ...(videoEnabled ? { teleconsultSetUp: teleDoctors.some((d) => d.windows.length > 0) } : {}),
    };
    const canGoLive = app.status !== OnboardingStatus.LIVE && checklist.doctorsAdded
      && (!videoEnabled || !!checklist.teleconsultSetUp);
    const { sessionToken, ...rest } = app as any;
    return { ...rest, commission: COMMISSION, videoEnabled, checklist, canGoLive };
  }

  async addDoctor(userId: string, dto: DoctorDto) {
    const app = await this.mine(userId);
    await this.prisma.onboardingDoctor.create({
      data: {
        applicationId: app.id, availabilityToken: tok(24),
        // FR-22: doctors at accredited hospitals auto-approve; others in review.
        status: isAccredited(app) ? OnboardingDoctorStatus.APPROVED : OnboardingDoctorStatus.IN_REVIEW,
        name: dto.name, photoUrl: dto.photoUrl, qualifications: dto.qualifications,
        specialty: dto.specialty, subspecialty: dto.subspecialty, yearsExperience: dto.yearsExperience,
        registrationNo: dto.registrationNo, languages: dto.languages ?? [], bio: dto.bio,
        proceduresPerformed: dto.proceduresPerformed, email: dto.email,
        teleconsultEnabled: dto.teleconsultEnabled ?? false, timezone: dto.timezone || 'Asia/Kolkata',
      },
    });
    return this.dashboard(userId);
  }

  /**
   * Bulk-import doctors from a CSV. All-or-nothing: any bad row rejects the whole
   * file so a re-upload can't double-insert the rows that already landed. Rows go
   * through the SAME approval rule as addDoctor — a CSV must not be a way to skip
   * the review that the form applies.
   */
  async importDoctors(userId: string, file: Express.Multer.File) {
    const app = await this.mine(userId);
    const { rows, errors } = await this.bulk.parse<DoctorDto>('doctors', file);
    if (errors.length) return { imported: 0, errors, data: await this.dashboard(userId) };
    const imported = await this.writeDoctors(app, rows);
    return { imported, errors: [], data: await this.dashboard(userId) };
  }

  /**
   * Add roster rows, skipping doctors this application already has. Re-uploading a
   * sheet after fixing one cell is the normal way hospitals work — and with the
   * combined file it re-submits the whole roster every time — so an append-only
   * import would silently duplicate the list. Identity is the doctor's registration
   * number or email when given (those are unique in practice), else their name.
   */
  private async writeDoctors(app: { id: string; accreditations?: { status: DocStatus }[] }, rows: DoctorDto[]) {
    const existing = await this.prisma.onboardingDoctor.findMany({
      where: { applicationId: app.id },
      select: { name: true, registrationNo: true, email: true },
    });
    const key = (d: { name?: string; registrationNo?: string | null; email?: string | null }) =>
      (d.registrationNo || d.email || d.name || '').trim().toLowerCase();
    const seen = new Set(existing.map(key));
    const fresh = rows.filter((d) => {
      const k = key(d);
      if (!k || seen.has(k)) return false;
      seen.add(k); // also de-duplicates repeats WITHIN the uploaded sheet
      return true;
    });
    if (!fresh.length) return 0;
    await this.prisma.onboardingDoctor.createMany({
      data: fresh.map((d) => ({
        applicationId: app.id, availabilityToken: tok(24),
        status: isAccredited(app) ? OnboardingDoctorStatus.APPROVED : OnboardingDoctorStatus.IN_REVIEW,
        name: d.name, qualifications: d.qualifications, specialty: d.specialty, subspecialty: d.subspecialty,
        yearsExperience: d.yearsExperience, registrationNo: d.registrationNo, languages: d.languages ?? [],
        bio: d.bio, proceduresPerformed: d.proceduresPerformed, email: d.email,
        teleconsultEnabled: d.teleconsultEnabled ?? false, timezone: 'Asia/Kolkata',
      })),
    });
    return fresh.length;
  }

  /**
   * Bulk-import treatment packages (name + per-package price) from a CSV. Replaces
   * the whole package list — a spreadsheet is the hospital's full price list, and
   * appending would silently keep packages they deleted from their own file.
   * `procedures` is kept in sync as the flat name list every existing reader
   * (patient matching, comparison card) already uses.
   */
  async importPackages(userId: string, file: Express.Multer.File) {
    const app = await this.mine(userId);
    const { rows, errors } = await this.bulk.parse<{ name: string; priceUsd: number; included?: string[]; notes?: string }>('packages', file);
    if (errors.length) return { imported: 0, errors, data: await this.dashboard(userId) };
    await this.writePackages(app, rows);
    return { imported: rows.length, errors: [], data: await this.dashboard(userId) };
  }

  /** Replace the package list (+ the flat `procedures` names every reader uses). */
  private async writePackages(
    app: { id: string; quotedPriceUsd: number | null; publishedHospitalId: string | null },
    rows: { name: string; priceUsd: number; included?: string[]; notes?: string }[],
  ) {
    const packages = rows.map((p) => ({ name: p.name, priceUsd: p.priceUsd, included: p.included ?? [], notes: p.notes ?? null }));
    const procedures = packages.map((p) => p.name);
    // Headline "from" price on the comparison card = the cheapest package, unless
    // the hospital already set one by hand.
    const from = Math.min(...packages.map((p) => p.priceUsd));
    const data = { packages: packages as any, procedures, quotedPriceUsd: app.quotedPriceUsd ?? from };
    await this.prisma.hospitalApplication.update({ where: { id: app.id }, data });
    if (app.publishedHospitalId) {
      await this.prisma.hospital.update({ where: { id: app.publishedHospitalId }, data: { ...data, procedures: procedures as any } });
    }
  }

  /**
   * Bulk-import the hospital's OWN record from a one-row CSV — everything the
   * Profile, Pricing, Treatments and Services screens write, in a single file, so a
   * hospital can complete its whole listing from a spreadsheet.
   *
   * Blank cells are omitted by the parser and therefore left untouched (same
   * skip-undefined rule as setPricing/setServices), so the same file works as a
   * partial update. Mirrored to the published Hospital exactly like setPricing does,
   * so a live listing reflects the import immediately.
   */
  async importProfile(userId: string, file: Express.Multer.File) {
    const app = await this.mine(userId);
    const { rows, errors } = await this.bulk.parse<Record<string, any>>('profile', file);
    if (errors.length) return { imported: 0, errors, data: await this.dashboard(userId) };
    // One hospital, one row. A file with several is a doctors/packages sheet by
    // mistake — importing only the first would silently drop the rest.
    if (rows.length !== 1) {
      return {
        imported: 0,
        errors: [{ row: 2, message: `The profile template holds ONE row — your hospital. This file has ${rows.length}.` }],
        data: await this.dashboard(userId),
      };
    }
    await this.writeProfile(app, rows[0]);
    return { imported: 1, errors: [], data: await this.dashboard(userId) };
  }

  /** Apply one profile row. Blank cells arrive absent, so `?? undefined` leaves
   *  every field the hospital didn't fill exactly as it was. */
  private async writeProfile(app: { id: string; publishedHospitalId: string | null }, p: Record<string, any>) {
    await this.prisma.hospitalApplication.update({
      where: { id: app.id },
      data: {
        city: p.city ?? undefined, address: p.address ?? undefined, website: p.website ?? undefined,
        ownership: p.ownership ?? undefined, totalBeds: p.totalBeds ?? undefined, icuBeds: p.icuBeds ?? undefined,
        airportDistanceKm: p.airportDistanceKm ?? undefined,
        specialties: p.specialties ?? undefined, procedures: p.procedures ?? undefined,
        languages: p.languages ?? undefined, insurers: p.insurers ?? undefined, intlFacilities: p.intlFacilities ?? undefined,
        quotedPriceUsd: p.quotedPriceUsd ?? undefined, localBenchmarkUsd: p.localBenchmarkUsd ?? undefined,
        patientsPerYear: p.patientsPerYear ?? undefined, imageUrl: p.imageUrl ?? undefined,
        included: p.included ?? undefined, notIncluded: p.notIncluded ?? undefined,
        pros: p.pros ?? undefined, cons: p.cons ?? undefined,
      },
    });
    if (app.publishedHospitalId) {
      await this.prisma.hospital.update({
        where: { id: app.publishedHospitalId },
        data: {
          city: p.city ?? undefined, procedures: p.procedures ?? undefined,
          // Published hospital carries a single primary specialty (first of the list).
          specialty: p.specialties ? (p.specialties[0] ?? null) : undefined,
          quotedPriceUsd: p.quotedPriceUsd ?? undefined, localBenchmarkUsd: p.localBenchmarkUsd ?? undefined,
          patientsPerYear: p.patientsPerYear ?? undefined, imageUrl: p.imageUrl ?? undefined,
          included: p.included ?? undefined, notIncluded: p.notIncluded ?? undefined,
          pros: p.pros ?? undefined, cons: p.cons ?? undefined,
        },
      });
    }
  }

  /**
   * ONE upload that carries the whole listing — profile, doctor roster and price
   * list together, from an Excel workbook (a sheet per table) or a CSV with section
   * markers. A table the hospital left blank is skipped, so this file is equally a
   * first-time setup and a later partial update.
   *
   * All-or-nothing across the WHOLE file: one bad cell anywhere and nothing is
   * written, otherwise a half-applied listing would go live while the hospital is
   * still fixing the sheet.
   */
  async importAll(userId: string, file: Express.Multer.File) {
    const app = await this.mine(userId);
    const { profile, doctors, packages, errors } = await this.bulk.parseAll(file);
    if (errors.length) return { imported: 0, errors, data: await this.dashboard(userId), detail: null };

    if (profile) await this.writeProfile(app, profile);
    const doctorsAdded = doctors.length ? await this.writeDoctors(app, doctors as DoctorDto[]) : 0;
    // Re-read: writeProfile may have just set the headline price writePackages reads.
    if (packages.length) await this.writePackages(await this.mine(userId), packages as any);

    const detail = {
      profile: profile ? 1 : 0,
      doctors: doctorsAdded,
      doctorsSkipped: doctors.length - doctorsAdded, // already on the roster
      packages: packages.length,
    };
    return {
      imported: detail.profile + detail.doctors + detail.packages,
      errors: [],
      data: await this.dashboard(userId),
      detail,
    };
  }

  private async doctorOfMine(userId: string, doctorId: string) {
    const app = await this.mine(userId);
    const doc = await this.prisma.onboardingDoctor.findUnique({ where: { id: doctorId } });
    if (!doc || doc.applicationId !== app.id) throw new NotFoundException('Doctor not found');
    return doc;
  }

  async updateDoctor(userId: string, doctorId: string, dto: DoctorDto) {
    await this.doctorOfMine(userId, doctorId);
    await this.prisma.onboardingDoctor.update({ where: { id: doctorId }, data: { ...dto, languages: dto.languages ?? undefined } });
    return this.dashboard(userId);
  }

  async setDoctorLeave(userId: string, doctorId: string, onLeave: boolean) {
    const doc = await this.doctorOfMine(userId, doctorId);
    const status = onLeave ? OnboardingDoctorStatus.ON_LEAVE
      : isAccredited(await this.mine(userId)) ? OnboardingDoctorStatus.APPROVED : OnboardingDoctorStatus.IN_REVIEW;
    await this.prisma.onboardingDoctor.update({ where: { id: doc.id }, data: { status } });
    return this.dashboard(userId);
  }

  async removeDoctor(userId: string, doctorId: string) {
    await this.doctorOfMine(userId, doctorId);
    await this.prisma.onboardingDoctor.delete({ where: { id: doctorId } });
    return this.dashboard(userId);
  }

  /** FR-26/30: (re)send a doctor's private availability link. */
  async sendAvailabilityLink(userId: string, doctorId: string) {
    // Video off → don't invite a doctor to set slots for a feature that's skipped.
    if (!(await this.video.enabled())) {
      throw new BadRequestException('Video consultations are currently unavailable.');
    }
    const doc = await this.doctorOfMine(userId, doctorId);
    const token = doc.availabilityToken || tok(24);
    if (!doc.availabilityToken) await this.prisma.onboardingDoctor.update({ where: { id: doc.id }, data: { availabilityToken: token } });
    await this.notify.sendAvailabilityLink({ name: doc.name, email: doc.email }, token);
    return { sent: true };
  }

  /** FR-21: pricing & capacity — persisted on the application; applied to the
   *  published Hospital now (if already live) and at go-live. */
  async setPricing(userId: string, dto: PricingDto) {
    const app = await this.mine(userId);
    await this.prisma.hospitalApplication.update({
      where: { id: app.id },
      data: {
        quotedPriceUsd: dto.quotedPriceUsd, patientsPerYear: dto.patientsPerYear, imageUrl: dto.imageUrl,
        procedures: dto.procedures ?? [],
        // specialties omitted (undefined) by the Pricing form → left untouched.
        specialties: dto.specialties ?? undefined,
        // Package narrative (shown on the patient comparison card). Skip-undefined
        // so a partial save (e.g. only price) doesn't wipe the included list.
        localBenchmarkUsd: dto.localBenchmarkUsd ?? undefined,
        included: dto.included ?? undefined,
        notIncluded: dto.notIncluded ?? undefined,
        pros: dto.pros ?? undefined,
        cons: dto.cons ?? undefined,
      },
    });
    if (app.publishedHospitalId) {
      await this.prisma.hospital.update({
        where: { id: app.publishedHospitalId },
        data: {
          quotedPriceUsd: dto.quotedPriceUsd, patientsPerYear: dto.patientsPerYear, imageUrl: dto.imageUrl, procedures: dto.procedures,
          // Published hospital carries a single primary specialty (first of the list).
          specialty: dto.specialties ? (dto.specialties[0] ?? null) : undefined,
          localBenchmarkUsd: dto.localBenchmarkUsd ?? undefined,
          included: dto.included ?? undefined,
          notIncluded: dto.notIncluded ?? undefined,
          pros: dto.pros ?? undefined,
          cons: dto.cons ?? undefined,
        },
      });
    }
    return this.dashboard(userId);
  }

  /** Patient services — languages, insurers/TPAs, international-patient facilities.
   *  Stored on the application (the published Hospital carries none of these), so
   *  no republish is needed. Skip-undefined so partial saves don't wipe siblings. */
  async setServices(userId: string, dto: ServicesDto) {
    const app = await this.mine(userId);
    await this.prisma.hospitalApplication.update({
      where: { id: app.id },
      data: {
        languages: dto.languages ?? undefined,
        insurers: dto.insurers ?? undefined,
        intlFacilities: dto.intlFacilities ?? undefined,
      },
    });
    return this.dashboard(userId);
  }

  /**
   * Part 5: AI-seed the package narrative (pros/cons + what's included / not) from
   * the hospital's info and any reviews already mapped to it — saved to the
   * application so the panel can EDIT it before (and after) go-live.
   */
  async generateNarrative(userId: string) {
    const app = await this.mine(userId);
    const reviews = app.publishedHospitalId
      ? await this.prisma.review.findMany({ where: { hospitalId: app.publishedHospitalId }, select: { text: true, rating: true, nationality: true }, take: 6, orderBy: { createdAt: 'desc' } })
      : [];
    const jci = app.accreditations.some((a) => a.body === AccreditationBody.JCI && a.status === DocStatus.VERIFIED);
    const n = await this.enrich.suggestNarrative({ name: app.legalName, city: app.city, jciAccredited: jci, reviews });
    await this.prisma.hospitalApplication.update({
      where: { id: app.id },
      data: { included: n.included, notIncluded: n.notIncluded, pros: n.pros, cons: n.cons, localBenchmarkUsd: n.localBenchmarkUsd ?? undefined },
    });
    return this.dashboard(userId);
  }

  /**
   * Part 2: the hospital's own reviews for the panel Reviews screen, with light
   * filters (min rating, region, verified-only) + summary stats.
   */
  async dashboardReviews(userId: string, opts: { rating?: number; region?: string; verified?: boolean } = {}) {
    const app = await this.prisma.hospitalApplication.findUnique({ where: { ownerUserId: userId }, select: { publishedHospitalId: true } });
    const hospitalId = app?.publishedHospitalId;
    if (!hospitalId) return { reviews: [], stats: { total: 0, avgRating: null, regions: [] } };
    const where: any = { hospitalId };
    if (opts.rating) where.rating = { gte: opts.rating };
    if (opts.region) where.region = opts.region;
    if (opts.verified != null) where.verified = opts.verified;
    const reviews = await this.prisma.review.findMany({
      where, orderBy: [{ verified: 'desc' }, { reviewDate: 'desc' }], take: 100,
      select: { id: true, reviewerName: true, nationality: true, region: true, rating: true, procedure: true, reviewDate: true, text: true, textEn: true, verified: true },
    });
    const all = await this.prisma.review.findMany({ where: { hospitalId }, select: { rating: true, region: true } });
    const avgRating = all.length ? Number((all.reduce((s, r) => s + (r.rating || 0), 0) / all.length).toFixed(1)) : null;
    const regions = [...new Set(all.map((r) => r.region).filter(Boolean))] as string[];
    return { reviews, stats: { total: all.length, avgRating, regions } };
  }

  /** FR-20 + BR: publish into patient matching (Hospital + Surgeon rows). */
  async goLive(userId: string) {
    const app = await this.mine(userId);
    if (app.status === OnboardingStatus.LIVE) throw new BadRequestException('Already live.');
    if (app.doctors.length === 0) throw new BadRequestException('Add at least one doctor first.');
    // Only gate on teleconsult availability when video is actually configured —
    // otherwise the scheduling flow is skipped and this would block go-live forever.
    if (await this.video.enabled()) {
      if (!app.doctors.some((d) => d.teleconsultEnabled && d.windows.length > 0)) {
        throw new BadRequestException('Set up teleconsultation availability for at least one doctor.');
      }
    }
    const nabh = app.accreditations.some((a) => a.body === AccreditationBody.NABH && a.status === DocStatus.VERIFIED);
    const jci = app.accreditations.some((a) => a.body === AccreditationBody.JCI && a.status === DocStatus.VERIFIED);
    const hospitalId = app.publishedHospitalId || slugId(app.legalName);

    // Package narrative captured in the panel (AI-seeded + editable) → published
    // onto the comparison card. Undefined-safe so re-go-live doesn't wipe them.
    const narrative = {
      localBenchmarkUsd: app.localBenchmarkUsd ?? undefined,
      included: app.included?.length ? app.included : undefined,
      notIncluded: app.notIncluded?.length ? app.notIncluded : undefined,
      pros: app.pros ?? undefined,
      cons: app.cons ?? undefined,
      // Per-package prices from the panel's bulk import; undefined when the
      // hospital never uploaded a price list (card falls back to quotedPriceUsd).
      packages: app.packages ?? undefined,
    };
    await this.prisma.hospital.upsert({
      where: { id: hospitalId },
      update: { approvalStatus: 'APPROVED', priority: app.priority, jciAccredited: jci, nabhAccredited: nabh, ...narrative },
      create: {
        id: hospitalId, name: app.legalName, city: app.city, country: 'India',
        specialty: app.specialties[0] ?? null, procedures: (app.procedures?.length ? app.procedures : app.specialties),
        website: app.website, address: app.address, imageUrl: app.imageUrl,
        quotedPriceUsd: app.quotedPriceUsd, patientsPerYear: app.patientsPerYear,
        jciAccredited: jci, nabhAccredited: nabh, priority: app.priority,
        ownerUserId: userId, approvalStatus: 'APPROVED', ...narrative,
      },
    });

    // Publish each active doctor as a Surgeon (idempotent via publishedSurgeonId).
    let primary: string | null = null;
    for (const d of app.doctors.filter((x) => x.status !== OnboardingDoctorStatus.ON_LEAVE)) {
      const surgeonId = d.publishedSurgeonId || `doc-${randomBytes(8).toString('hex')}`;
      await this.prisma.surgeon.upsert({
        where: { id: surgeonId },
        update: { name: d.name, specialization: d.specialty, hospitalId },
        create: {
          id: surgeonId, hospitalId, name: d.name, title: d.qualifications,
          specialization: d.specialty, email: d.email, medicalCouncilReg: d.registrationNo,
          yearsExperience: d.yearsExperience, totalProcedures: d.proceduresPerformed,
          languages: d.languages, photoUrl: d.photoUrl, country: 'India',
        },
      });
      if (!d.publishedSurgeonId) await this.prisma.onboardingDoctor.update({ where: { id: d.id }, data: { publishedSurgeonId: surgeonId } });
      if (!primary) primary = surgeonId;
    }
    await this.prisma.hospital.update({ where: { id: hospitalId }, data: { surgeonId: primary ?? undefined } });
    await this.prisma.hospitalApplication.update({ where: { id: app.id }, data: { status: OnboardingStatus.LIVE, publishedHospitalId: hospitalId } });

    // Reviews + AI narrative run in the BACKGROUND so go-live returns immediately.
    void this.finalizeHospital(userId, hospitalId, app);
    return this.dashboard(userId);
  }

  /**
   * Post-go-live finalize (background): (1) map any existing directory-hospital
   * reviews onto this hospital, (2) refresh its rating, (3) if it still has no
   * reviews, kick off a background scrape to fetch + map them, (4) if the hospital
   * didn't provide a package narrative, AI-seed pros/cons + what's-included.
   */
  private async finalizeHospital(userId: string, hospitalId: string, app: any) {
    try {
      const mapped = await this.mapExistingReviews(hospitalId, app.legalName, app.city, app.address);
      await this.refreshRating(hospitalId);
      const count = await this.prisma.review.count({ where: { hospitalId } });
      if (count === 0) {
        // Part 3: no reviews anywhere → fetch 10 via the foreign pipeline
        // (best-effort; depends on scraper). The import sets overallRating itself.
        this.scrape.scrapeOneHospital(hospitalId, `onboarding:${userId}`, ONBOARDING_REVIEW_TARGET).catch(() => undefined);
      }
      // Parts 4/5: fill the narrative with AI only if the hospital left it blank.
      const h = await this.prisma.hospital.findUnique({ where: { id: hospitalId } });
      const includedEmpty = !h?.included || (Array.isArray(h.included) && h.included.length === 0);
      const prosEmpty = !h?.pros || (Array.isArray(h.pros) && h.pros.length === 0);
      if (h && includedEmpty && prosEmpty) {
        const jci = !!app.accreditations?.some((a: any) => a.body === 'JCI' && a.status === 'VERIFIED');
        const reviews = await this.prisma.review.findMany({ where: { hospitalId }, select: { text: true, rating: true, nationality: true }, take: 6 });
        const n = await this.enrich.suggestNarrative({ name: app.legalName, city: app.city, jciAccredited: jci, overallRating: h.overallRating, reviews });
        await this.prisma.hospital.update({
          where: { id: hospitalId },
          data: { included: n.included, notIncluded: n.notIncluded, pros: n.pros, cons: n.cons, localBenchmarkUsd: h.localBenchmarkUsd ?? n.localBenchmarkUsd ?? undefined },
        });
        // Mirror onto the application so the panel shows the same editable values.
        await this.prisma.hospitalApplication.update({
          where: { id: app.id },
          data: { included: n.included, notIncluded: n.notIncluded, pros: n.pros, cons: n.cons, localBenchmarkUsd: h.localBenchmarkUsd ?? n.localBenchmarkUsd ?? undefined },
        }).catch(() => undefined);
      }
      void mapped;
    } catch { /* best-effort finalize — never fail go-live over it */ }
  }

  /**
   * Part 1: move the reviews of the applicant's EXISTING directory rows onto the
   * newly-onboarded hospital, so a hospital already listed publicly keeps its
   * review history (and its patient-journey reviews) after onboarding.
   *
   * The hard part is branch disambiguation. Big groups run many hospitals under
   * one near-identical name in one city — "Max Super Speciality Hospital" has
   * Saket / Dwarka / Patparganj / Shalimar Bagh rows in Delhi, and "BLK-Max" is a
   * different group entirely. Name+city alone matches all of them, which would
   * attribute other hospitals' patient reviews to this one. So a row only counts
   * as THIS hospital when every token that distinguishes it ("dwarka", "blk", …)
   * is one the applicant actually claimed in their own name or street address.
   * Unrecognised token → sibling branch → left alone.
   */
  private async mapExistingReviews(newHospitalId: string, name: string, city: string, address?: string | null): Promise<number> {
    const norm = (s: string) => (s || '').toLowerCase()
      .replace(/\b(pvt|ltd|private|limited|hospitals?|healthcare|medical|centre|center|institute|clinic|the|of|research)\b/g, ' ')
      .replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
    const target = norm(name);
    if (!target) return 0;
    const nameTok = new Set(target.split(' ').filter(Boolean));
    // Everything the applicant told us about themselves — their name plus the
    // street address, which is what actually names the branch ("… Saket …").
    const claimed = new Set([...nameTok, ...norm(`${city ?? ''} ${address ?? ''}`).split(' ').filter(Boolean)]);
    const cityN = (city || '').toLowerCase().trim();
    const candidates = await this.prisma.hospital.findMany({ where: { id: { not: newHospitalId } }, select: { id: true, name: true, city: true } });
    const matches = candidates.filter((c) => {
      const cTok = norm(c.name).split(' ').filter(Boolean);
      if (!cTok.length) return false;
      const sharesName = cTok.some((t) => nameTok.has(t));
      const noStrayBranch = cTok.every((t) => claimed.has(t));
      const sameCity = !cityN || (c.city || '').toLowerCase().includes(cityN) || cityN.includes((c.city || '').toLowerCase());
      return sharesName && noStrayBranch && sameCity;
    });
    if (!matches.length) return 0;
    const moved = await this.prisma.review.updateMany({ where: { hospitalId: { in: matches.map((m) => m.id) } }, data: { hospitalId: newHospitalId } });
    return moved.count;
  }

  /** Recompute a hospital's overallRating from the reviews currently mapped to it. */
  private async refreshRating(hospitalId: string) {
    const agg = await this.prisma.review.aggregate({ where: { hospitalId }, _avg: { rating: true }, _count: true });
    if (agg._count) {
      await this.prisma.hospital.update({
        where: { id: hospitalId },
        data: { overallRating: agg._avg.rating != null ? Number(agg._avg.rating.toFixed(1)) : undefined },
      });
    }
  }

  /** Change password (first sign-in, FR-19). */
  async setPassword(userId: string, password: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { password: await bcrypt.hash(password, 12) } });
    return { updated: true };
  }

  // ─── Availability link (public, token-scoped) ──────────────────────────────

  async availabilityByToken(token: string) {
    const doc = await this.prisma.onboardingDoctor.findUnique({
      where: { availabilityToken: token },
      select: {
        id: true, name: true, specialty: true, timezone: true, teleconsultEnabled: true,
        windows: { orderBy: [{ weekday: 'asc' }, { start: 'asc' }] },
        application: { select: { legalName: true } },
        // Upcoming booked teleconsults so the doctor can join them from this page.
        teleconsults: {
          where: { status: 'SCHEDULED' },
          orderBy: { scheduledAt: 'asc' },
          select: { id: true, scheduledAt: true, patient: { select: { name: true } } },
        },
      },
    });
    if (!doc) throw new NotFoundException('Invalid or expired link');
    // Video off → the page hides joining/consults rather than offering a call
    // that would 503 at join time.
    return { ...doc, videoEnabled: await this.video.enabled() };
  }

  async setAvailability(token: string, dto: SetAvailabilityDto) {
    const doc = await this.prisma.onboardingDoctor.findUnique({ where: { availabilityToken: token }, select: { id: true } });
    if (!doc) throw new NotFoundException('Invalid or expired link');
    for (const w of dto.windows) if (w.end <= w.start) throw new BadRequestException('Each window must end after it starts.');
    await this.prisma.$transaction([
      this.prisma.availabilityWindow.deleteMany({ where: { doctorId: doc.id } }),
      this.prisma.availabilityWindow.createMany({ data: dto.windows.map((w) => ({ doctorId: doc.id, weekday: w.weekday, start: w.start, end: w.end })) }),
      this.prisma.onboardingDoctor.update({ where: { id: doc.id }, data: { teleconsultEnabled: true, ...(dto.timezone ? { timezone: dto.timezone } : {}) } }),
    ]);
    return this.availabilityByToken(token);
  }

  // ─── Admin exception review ────────────────────────────────────────────────

  /**
   * Every onboarding application (optionally filtered to one stage) PLUS a count
   * per stage, so the admin can track the whole funnel rather than guessing which
   * status tab has anything in it. Includes just enough per row for the console to
   * show what each hospital is blocked on.
   */
  async listApplications(status?: OnboardingStatus) {
    const [applications, grouped] = await Promise.all([
      this.prisma.hospitalApplication.findMany({
        where: status ? { status } : {},
        include: {
          contact: { select: { name: true, workEmail: true, whatsapp: true, emailVerifiedAt: true } },
          agreement: { select: { signedAt: true, signatoryName: true } },
          accreditations: { select: { body: true, status: true } },
          _count: { select: { doctors: true, documents: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.hospitalApplication.groupBy({ by: ['status'], _count: true }),
    ]);
    const counts: Record<string, number> = { ALL: 0 };
    for (const g of grouped) {
      counts[g.status] = (g as any)._count;
      counts.ALL += (g as any)._count;
    }
    return { applications, counts };
  }

  async getForAdmin(id: string) {
    const app = await this.prisma.hospitalApplication.findUnique({ where: { id }, include: APP_INCLUDE });
    if (!app) throw new NotFoundException('Application not found');
    const { sessionToken, ...rest } = app as any;
    return rest;
  }

  async reviewDoc(docId: string, dto: ReviewDocDto, adminId: string) {
    const doc = await this.prisma.onboardingDocument.findUnique({ where: { id: docId } });
    if (!doc) throw new NotFoundException('Document not found');
    return this.prisma.onboardingDocument.update({ where: { id: docId }, data: { status: dto.status as DocStatus, note: dto.note, reviewedBy: adminId, reviewedAt: new Date() } });
  }

  /**
   * Admin help #1 — the hospital never verified its email (the most common place
   * to get stuck). Mints a fresh OTP, clears the attempt counter and re-sends it.
   */
  async adminResendOtp(id: string) {
    const app = await this.prisma.hospitalApplication.findUnique({ where: { id }, include: { contact: true } });
    if (!app) throw new NotFoundException('Application not found');
    if (!app.contact) throw new BadRequestException('No authorised contact captured yet — the hospital must finish the Details step.');
    if (app.contact.emailVerifiedAt) throw new BadRequestException('This contact is already verified.');
    const emailOtp = otp();
    await this.prisma.authorisedContact.update({
      where: { applicationId: id },
      data: { emailOtp, emailOtpExp: new Date(Date.now() + 10 * 60 * 1000), emailOtpTries: 0 },
    });
    await this.notify.sendEmailOtp(app.contact.workEmail, emailOtp);
    return this.getForAdmin(id);
  }

  /**
   * Admin help #2 — the hospital signed but never got in (lost/expired credential
   * mail). Re-issues a fresh one-time password to the existing account, or creates
   * the account now if provisioning never ran. The password is only ever delivered
   * out-of-band, never returned here.
   */
  async adminResendCredentials(id: string) {
    const app = await this.prisma.hospitalApplication.findUnique({ where: { id }, include: { contact: true, agreement: true } });
    if (!app) throw new NotFoundException('Application not found');
    if (!app.contact) throw new BadRequestException('No authorised contact captured yet.');
    if (!app.agreement) throw new BadRequestException('The hospital must e-sign the commission agreement first.');
    const email = app.contact.workEmail;
    const oneTimePassword = tok(6);
    const password = await bcrypt.hash(oneTimePassword, 12);

    if (app.ownerUserId) {
      await this.prisma.user.update({ where: { id: app.ownerUserId }, data: { password } });
    } else {
      const clash = await this.prisma.user.findUnique({ where: { email } });
      if (clash) throw new BadRequestException('An account already exists for this email.');
      const user = await this.prisma.user.create({
        data: { email, name: app.contact.name, role: 'HOSPITAL', country: 'India', password, emailVerifiedAt: new Date() },
      });
      await this.prisma.hospitalApplication.update({
        where: { id }, data: { ownerUserId: user.id, sessionToken: null, status: OnboardingStatus.PROVISIONED },
      });
    }
    await this.notify.sendCredentials(email, app.contact.whatsapp, email, oneTimePassword);
    return this.getForAdmin(id);
  }

  async setApplicationStatus(id: string, status: OnboardingStatus) {
    const app = await this.prisma.hospitalApplication.findUnique({ where: { id } });
    if (!app) throw new NotFoundException('Application not found');
    await this.prisma.hospitalApplication.update({ where: { id }, data: { status } });
    return this.getForAdmin(id);
  }

  /** Admin-controlled "Priority partner" flag — the strongest ranking boost in
   *  patient recommendations (see hospitals.service). Applied to the application
   *  and its published Hospital row so it takes effect immediately. */
  async setPriority(id: string, priority: boolean) {
    const app = await this.prisma.hospitalApplication.findUnique({ where: { id } });
    if (!app) throw new NotFoundException('Application not found');
    await this.prisma.hospitalApplication.update({ where: { id }, data: { priority } });
    if (app.publishedHospitalId) {
      await this.prisma.hospital.update({ where: { id: app.publishedHospitalId }, data: { priority } });
    }
    return this.getForAdmin(id);
  }

  /** Resolve a doc file path after ownership/admin check (auth-guarded stream). */
  async docFile(docId: string, userId: string, isAdmin: boolean) {
    const doc = await this.prisma.onboardingDocument.findUnique({ where: { id: docId }, include: { application: { select: { ownerUserId: true } } } });
    if (!doc) throw new NotFoundException('Document not found');
    if (!isAdmin && doc.application.ownerUserId !== userId) throw new ForbiddenException('Not your document');
    return { path: join(HOSPITAL_DOCS_DIR, doc.fileUrl), name: doc.originalName || doc.fileUrl };
  }
}
