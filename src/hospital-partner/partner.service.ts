import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
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
import { HOSPITAL_DOCS_DIR } from './docs.storage';
import {
  ApplyDto, ContactDto, VerifyOtpDto, AccreditationDto, UploadDocDto, AgreementDto,
  DoctorDto, PricingDto, ServicesDto, SetAvailabilityDto, ReviewDocDto,
} from './dto/partner.dto';

const COMMISSION = { version: '2026-v1', percentage: 15, payoutRail: 'RazorpayX' }; // BR-3 fixed terms

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
  constructor(
    private prisma: PrismaService,
    private notify: NotificationService,
    private accred: AccreditationService,
    private video: VideoService,
    private enrich: EnrichmentService,
    private scrape: ScrapeService,
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
    const hits = this.accred.lookup(app.legalName, app.city);
    // Idempotent re-scan: drop prior registry hits, re-create from the current lookup.
    await this.prisma.accreditationRecord.deleteMany({ where: { applicationId: id, source: AccreditationSource.REGISTRY } });
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
    const oneTimePassword = tok(6); // 12-hex-char temp password
    const user = await this.prisma.user.create({
      data: { email, name: app.contact!.name, role: 'HOSPITAL', country: 'India', password: await bcrypt.hash(oneTimePassword, 12), emailVerifiedAt: new Date() },
    });
    await this.prisma.hospitalApplication.update({ where: { id }, data: { ownerUserId: user.id, sessionToken: null, status: OnboardingStatus.PROVISIONED } });
    await this.notify.sendCredentials(email, app.contact!.whatsapp, email, oneTimePassword);
    return { provisioned: true, loginId: email }; // password sent out-of-band only
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
      const mapped = await this.mapExistingReviews(hospitalId, app.legalName, app.city);
      await this.refreshRating(hospitalId);
      const count = await this.prisma.review.count({ where: { hospitalId } });
      if (count === 0) {
        // Part 3: no reviews anywhere → fetch them (best-effort; depends on scraper).
        this.scrape.scrapeOneHospital(hospitalId, `onboarding:${userId}`).catch(() => undefined);
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
   * Part 1: if a directory hospital with the same (normalized) name + city already
   * exists as a separate row, move its reviews onto the newly-onboarded hospital.
   */
  private async mapExistingReviews(newHospitalId: string, name: string, city: string): Promise<number> {
    const norm = (s: string) => (s || '').toLowerCase()
      .replace(/\b(pvt|ltd|private|limited|hospitals?|healthcare|medical|centre|center|institute|clinic|the|of|research)\b/g, ' ')
      .replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
    const target = norm(name);
    if (!target) return 0;
    const cityN = (city || '').toLowerCase().trim();
    const candidates = await this.prisma.hospital.findMany({ where: { id: { not: newHospitalId } }, select: { id: true, name: true, city: true } });
    const match = candidates.find((c) => {
      const sameName = norm(c.name) === target || norm(c.name).includes(target) || target.includes(norm(c.name));
      const sameCity = !cityN || (c.city || '').toLowerCase().includes(cityN) || cityN.includes((c.city || '').toLowerCase());
      return sameName && sameCity;
    });
    if (!match) return 0;
    const moved = await this.prisma.review.updateMany({ where: { hospitalId: match.id }, data: { hospitalId: newHospitalId } });
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
    return doc;
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

  listApplications(status?: OnboardingStatus) {
    return this.prisma.hospitalApplication.findMany({
      where: status ? { status } : {},
      include: { contact: { select: { workEmail: true, name: true } }, _count: { select: { doctors: true, documents: true } } },
      orderBy: { updatedAt: 'desc' },
    });
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
