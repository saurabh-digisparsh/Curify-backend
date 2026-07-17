"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var PartnerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PartnerService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const bcrypt = require("bcryptjs");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const notification_service_1 = require("./notification.service");
const accreditation_service_1 = require("./accreditation.service");
const video_service_1 = require("./video.service");
const enrichment_service_1 = require("../admin/enrichment.service");
const scrape_service_1 = require("../admin/scrape.service");
const bulk_import_service_1 = require("./bulk-import.service");
const docs_storage_1 = require("./docs.storage");
const COMMISSION = { version: '2026-v1', percentage: 15, payoutRail: 'RazorpayX' };
const ONBOARDING_REVIEW_TARGET = 10;
const APP_INCLUDE = {
    contact: { select: { name: true, designation: true, workEmail: true, whatsapp: true, emailVerifiedAt: true, whatsappVerifiedAt: true } },
    accreditations: true,
    documents: true,
    agreement: true,
    doctors: { include: { windows: true }, orderBy: { createdAt: 'asc' } },
};
function otp() { return String(Math.floor(100000 + Math.random() * 900000)); }
function tok(n = 24) { return (0, crypto_1.randomBytes)(n).toString('hex'); }
function slugId(name) {
    const base = (name || 'hospital').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'hospital';
    return `${base}-${(0, crypto_1.randomBytes)(3).toString('hex')}`;
}
function isAccredited(app) {
    return (app.accreditations || []).some((a) => a.status === client_1.DocStatus.VERIFIED);
}
let PartnerService = PartnerService_1 = class PartnerService {
    constructor(prisma, notify, accred, video, enrich, scrape, bulk) {
        this.prisma = prisma;
        this.notify = notify;
        this.accred = accred;
        this.video = video;
        this.enrich = enrich;
        this.scrape = scrape;
        this.bulk = bulk;
        this.logger = new common_1.Logger(PartnerService_1.name);
    }
    async apply(dto) {
        if (!dto.specialties?.length || !dto.insurers?.length) {
            throw new common_1.BadRequestException('At least one specialty and one insurer/self-pay option are required.');
        }
        const sessionToken = tok(24);
        const app = await this.prisma.hospitalApplication.create({
            data: {
                legalName: dto.legalName, city: dto.city, address: dto.address,
                registrationNo: dto.registrationNo, ownership: dto.ownership, website: dto.website,
                totalBeds: dto.totalBeds, icuBeds: dto.icuBeds, airportDistanceKm: dto.airportDistanceKm,
                specialties: dto.specialties, insurers: dto.insurers,
                languages: dto.languages ?? [], intlFacilities: dto.intlFacilities ?? [],
                status: client_1.OnboardingStatus.DRAFT, sessionToken,
            },
        });
        return { id: app.id, sessionToken, status: app.status };
    }
    async bySession(id, sessionToken) {
        const app = await this.prisma.hospitalApplication.findUnique({ where: { id }, include: APP_INCLUDE });
        if (!app || app.sessionToken !== sessionToken)
            throw new common_1.NotFoundException('Application not found');
        if (app.status === client_1.OnboardingStatus.LIVE || app.ownerUserId) {
            throw new common_1.ForbiddenException('This application is already provisioned.');
        }
        return app;
    }
    async getApplication(id, sessionToken) {
        const app = await this.bySession(id, sessionToken);
        return this.publicView(app);
    }
    publicView(app) {
        const { sessionToken, ...rest } = app;
        return { ...rest, commission: COMMISSION };
    }
    async setContact(id, sessionToken, dto) {
        await this.bySession(id, sessionToken);
        const emailOtp = otp();
        const waOtp = otp();
        const exp = new Date(Date.now() + 10 * 60 * 1000);
        await this.prisma.authorisedContact.upsert({
            where: { applicationId: id },
            create: { applicationId: id, ...dto, emailOtp, emailOtpExp: exp, waOtp, waOtpExp: exp, whatsappVerifiedAt: new Date() },
            update: { ...dto, emailVerifiedAt: null, whatsappVerifiedAt: new Date(), emailOtp, emailOtpExp: exp, emailOtpTries: 0, waOtp, waOtpExp: exp, waOtpTries: 0 },
        });
        await this.prisma.hospitalApplication.update({ where: { id }, data: { status: client_1.OnboardingStatus.CONTACT_VERIFYING } });
        await this.notify.sendEmailOtp(dto.workEmail, emailOtp);
        return { sent: true };
    }
    async resendOtps(id, sessionToken) {
        const app = await this.bySession(id, sessionToken);
        if (!app.contact)
            throw new common_1.BadRequestException('Add the authorised contact first.');
        return this.setContact(id, sessionToken, {
            name: app.contact.name, designation: app.contact.designation ?? undefined,
            workEmail: app.contact.workEmail, whatsapp: app.contact.whatsapp,
        });
    }
    async verifyOtp(id, sessionToken, dto) {
        await this.bySession(id, sessionToken);
        const c = await this.prisma.authorisedContact.findUnique({ where: { applicationId: id } });
        if (!c)
            throw new common_1.BadRequestException('Add the authorised contact first.');
        const isEmail = dto.channel === 'email';
        const code = isEmail ? c.emailOtp : c.waOtp;
        const exp = isEmail ? c.emailOtpExp : c.waOtpExp;
        const tries = isEmail ? c.emailOtpTries : c.waOtpTries;
        if (!code || !exp)
            throw new common_1.BadRequestException('Request a code first.');
        if (exp < new Date())
            throw new common_1.BadRequestException('This code has expired — resend a new one.');
        if (tries >= 6)
            throw new common_1.BadRequestException('Too many attempts — resend a new code.');
        if (dto.code !== code) {
            await this.prisma.authorisedContact.update({ where: { applicationId: id }, data: isEmail ? { emailOtpTries: { increment: 1 } } : { waOtpTries: { increment: 1 } } });
            throw new common_1.BadRequestException('Incorrect code — please try again.');
        }
        const updated = await this.prisma.authorisedContact.update({
            where: { applicationId: id },
            data: isEmail ? { emailVerifiedAt: new Date(), emailOtp: null } : { whatsappVerifiedAt: new Date(), waOtp: null },
        });
        const bothVerified = !!updated.emailVerifiedAt && !!updated.whatsappVerifiedAt;
        if (bothVerified)
            await this.prisma.hospitalApplication.update({ where: { id }, data: { status: client_1.OnboardingStatus.ACCREDITATION } });
        return { emailVerified: !!updated.emailVerifiedAt, whatsappVerified: !!updated.whatsappVerifiedAt, bothVerified };
    }
    assertContactVerified(app) {
        if (!app.contact?.emailVerifiedAt || !app.contact?.whatsappVerifiedAt) {
            throw new common_1.ForbiddenException('Verify email and WhatsApp first.');
        }
    }
    async addAccreditation(id, sessionToken, dto) {
        const app = await this.bySession(id, sessionToken);
        this.assertContactVerified(app);
        const hit = this.accred.verify(dto.body, dto.identifier);
        await this.prisma.accreditationRecord.deleteMany({ where: { applicationId: id, body: dto.body } });
        await this.prisma.accreditationRecord.create({
            data: {
                applicationId: id, body: dto.body, identifier: dto.identifier,
                source: hit ? client_1.AccreditationSource.REGISTRY : client_1.AccreditationSource.CERT_UPLOAD,
                status: hit ? client_1.DocStatus.VERIFIED : client_1.DocStatus.PENDING,
                verifiedAt: hit ? new Date() : null, validUntil: hit?.validUntil ?? null,
            },
        });
        if (hit)
            await this.prisma.hospitalApplication.update({ where: { id }, data: { notAccredited: false, status: client_1.OnboardingStatus.AGREEMENT } });
        return this.getApplication(id, sessionToken);
    }
    async lookupAccreditation(id, sessionToken) {
        const app = await this.bySession(id, sessionToken);
        this.assertContactVerified(app);
        const hits = this.accred.lookup(app.legalName, app.city);
        await this.prisma.accreditationRecord.deleteMany({ where: { applicationId: id, source: client_1.AccreditationSource.REGISTRY } });
        await this.prisma.accreditationRecord.deleteMany({ where: { applicationId: id, body: { in: hits.map((h) => h.body) } } });
        for (const h of hits) {
            await this.prisma.accreditationRecord.create({
                data: { applicationId: id, body: h.body, identifier: h.identifier, source: client_1.AccreditationSource.REGISTRY, status: client_1.DocStatus.VERIFIED, verifiedAt: new Date(), validUntil: h.validUntil },
            });
        }
        if (hits.length)
            await this.prisma.hospitalApplication.update({ where: { id }, data: { notAccredited: false, status: client_1.OnboardingStatus.AGREEMENT } });
        const res = await this.getApplication(id, sessionToken);
        return { ...res, lookup: { found: hits.length, matchedName: hits[0]?.matchedName ?? null } };
    }
    async markNotAccredited(id, sessionToken) {
        const app = await this.bySession(id, sessionToken);
        this.assertContactVerified(app);
        await this.prisma.hospitalApplication.update({ where: { id }, data: { notAccredited: true, priority: false, status: client_1.OnboardingStatus.VALIDATING } });
        return this.getApplication(id, sessionToken);
    }
    async uploadDoc(id, sessionToken, file, dto) {
        if (!file)
            throw new common_1.BadRequestException('No file uploaded');
        await this.bySession(id, sessionToken);
        await this.prisma.onboardingDocument.create({
            data: { applicationId: id, doctorId: dto.doctorId || null, type: dto.type, autoClassifiedType: dto.type, fileUrl: file.filename, originalName: file.originalname, status: client_1.DocStatus.VERIFIED },
        });
        return this.getApplication(id, sessionToken);
    }
    async removeDoc(id, sessionToken, docId) {
        await this.bySession(id, sessionToken);
        const doc = await this.prisma.onboardingDocument.findUnique({ where: { id: docId } });
        if (!doc || doc.applicationId !== id)
            throw new common_1.NotFoundException('Document not found');
        await this.prisma.onboardingDocument.delete({ where: { id: docId } });
        await (0, promises_1.unlink)((0, path_1.join)(docs_storage_1.HOSPITAL_DOCS_DIR, doc.fileUrl)).catch(() => { });
        return this.getApplication(id, sessionToken);
    }
    docsSatisfied(app) {
        const REQUIRED = ['REGISTRATION', 'FIRE_BUILDING_SAFETY', 'BIOMEDICAL_WASTE', 'INDEMNITY_INSURANCE', 'SIGNATORY_ID'];
        const verified = new Set(app.documents.filter((d) => d.status === 'VERIFIED' && !d.doctorId).map((d) => d.type));
        return REQUIRED.every((t) => verified.has(t));
    }
    async signAgreement(id, sessionToken, dto, ip) {
        const app = await this.bySession(id, sessionToken);
        this.assertContactVerified(app);
        if (!dto.authorised)
            throw new common_1.BadRequestException('You must confirm you are authorised to sign.');
        if (!isAccredited(app) && !this.docsSatisfied(app)) {
            throw new common_1.BadRequestException('Upload and pass all required verification documents first.');
        }
        await this.prisma.commissionAgreement.upsert({
            where: { applicationId: id },
            create: { applicationId: id, ...COMMISSION, signatoryName: dto.signatoryName, ip, terms: COMMISSION },
            update: { signatoryName: dto.signatoryName, ip, signedAt: new Date() },
        });
        await this.prisma.hospitalApplication.update({ where: { id }, data: { status: client_1.OnboardingStatus.AGREEMENT } });
        return this.getApplication(id, sessionToken);
    }
    async provision(id, sessionToken) {
        const app = await this.bySession(id, sessionToken);
        if (!app.agreement)
            throw new common_1.BadRequestException('Sign the commission agreement first.');
        const email = app.contact.workEmail;
        const clash = await this.prisma.user.findUnique({ where: { email } });
        if (clash)
            throw new common_1.BadRequestException('An account already exists for this email.');
        await this.enrichApplication(app);
        const oneTimePassword = tok(6);
        const user = await this.prisma.user.create({
            data: { email, name: app.contact.name, role: 'HOSPITAL', country: 'India', password: await bcrypt.hash(oneTimePassword, 12), emailVerifiedAt: new Date() },
        });
        await this.prisma.hospitalApplication.update({ where: { id }, data: { ownerUserId: user.id, sessionToken: null, status: client_1.OnboardingStatus.PROVISIONED } });
        await this.notify.sendCredentials(email, app.contact.whatsapp, email, oneTimePassword);
        return { provisioned: true, loginId: email };
    }
    async enrichApplication(app) {
        const blank = (v) => !v || (Array.isArray(v) && v.length === 0);
        const needs = blank(app.included) || blank(app.pros) || app.quotedPriceUsd == null || app.localBenchmarkUsd == null;
        if (!needs)
            return;
        try {
            const jci = !!app.accreditations?.some((a) => a.body === client_1.AccreditationBody.JCI && a.status === client_1.DocStatus.VERIFIED);
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
        }
        catch (e) {
            this.logger.warn(`provision enrich failed for "${app.legalName}": ${e.message}`);
        }
    }
    async mine(userId) {
        const app = await this.prisma.hospitalApplication.findUnique({ where: { ownerUserId: userId }, include: APP_INCLUDE });
        if (!app)
            throw new common_1.NotFoundException('No hospital application for this account.');
        return app;
    }
    async dashboard(userId) {
        const app = await this.mine(userId);
        const teleDoctors = app.doctors.filter((d) => d.teleconsultEnabled);
        const videoEnabled = await this.video.enabled();
        const checklist = {
            doctorsAdded: app.doctors.length > 0,
            pricingSet: app.quotedPriceUsd != null,
            ...(videoEnabled ? { teleconsultSetUp: teleDoctors.some((d) => d.windows.length > 0) } : {}),
        };
        const canGoLive = app.status !== client_1.OnboardingStatus.LIVE && checklist.doctorsAdded
            && (!videoEnabled || !!checklist.teleconsultSetUp);
        const { sessionToken, ...rest } = app;
        return { ...rest, commission: COMMISSION, videoEnabled, checklist, canGoLive };
    }
    async addDoctor(userId, dto) {
        const app = await this.mine(userId);
        await this.prisma.onboardingDoctor.create({
            data: {
                applicationId: app.id, availabilityToken: tok(24),
                status: isAccredited(app) ? client_1.OnboardingDoctorStatus.APPROVED : client_1.OnboardingDoctorStatus.IN_REVIEW,
                name: dto.name, photoUrl: dto.photoUrl, qualifications: dto.qualifications,
                specialty: dto.specialty, subspecialty: dto.subspecialty, yearsExperience: dto.yearsExperience,
                registrationNo: dto.registrationNo, languages: dto.languages ?? [], bio: dto.bio,
                proceduresPerformed: dto.proceduresPerformed, email: dto.email,
                teleconsultEnabled: dto.teleconsultEnabled ?? false, timezone: dto.timezone || 'Asia/Kolkata',
            },
        });
        return this.dashboard(userId);
    }
    async importDoctors(userId, file) {
        const app = await this.mine(userId);
        const { rows, errors } = this.bulk.parse('doctors', file);
        if (errors.length)
            return { imported: 0, errors, data: await this.dashboard(userId) };
        await this.prisma.onboardingDoctor.createMany({
            data: rows.map((d) => ({
                applicationId: app.id, availabilityToken: tok(24),
                status: isAccredited(app) ? client_1.OnboardingDoctorStatus.APPROVED : client_1.OnboardingDoctorStatus.IN_REVIEW,
                name: d.name, qualifications: d.qualifications, specialty: d.specialty, subspecialty: d.subspecialty,
                yearsExperience: d.yearsExperience, registrationNo: d.registrationNo, languages: d.languages ?? [],
                bio: d.bio, proceduresPerformed: d.proceduresPerformed, email: d.email,
                teleconsultEnabled: d.teleconsultEnabled ?? false, timezone: 'Asia/Kolkata',
            })),
        });
        return { imported: rows.length, errors: [], data: await this.dashboard(userId) };
    }
    async importPackages(userId, file) {
        const app = await this.mine(userId);
        const { rows, errors } = this.bulk.parse('packages', file);
        if (errors.length)
            return { imported: 0, errors, data: await this.dashboard(userId) };
        const packages = rows.map((p) => ({ name: p.name, priceUsd: p.priceUsd, included: p.included ?? [], notes: p.notes ?? null }));
        const procedures = packages.map((p) => p.name);
        const from = Math.min(...packages.map((p) => p.priceUsd));
        const data = { packages: packages, procedures, quotedPriceUsd: app.quotedPriceUsd ?? from };
        await this.prisma.hospitalApplication.update({ where: { id: app.id }, data });
        if (app.publishedHospitalId) {
            await this.prisma.hospital.update({ where: { id: app.publishedHospitalId }, data: { ...data, procedures: procedures } });
        }
        return { imported: rows.length, errors: [], data: await this.dashboard(userId) };
    }
    async doctorOfMine(userId, doctorId) {
        const app = await this.mine(userId);
        const doc = await this.prisma.onboardingDoctor.findUnique({ where: { id: doctorId } });
        if (!doc || doc.applicationId !== app.id)
            throw new common_1.NotFoundException('Doctor not found');
        return doc;
    }
    async updateDoctor(userId, doctorId, dto) {
        await this.doctorOfMine(userId, doctorId);
        await this.prisma.onboardingDoctor.update({ where: { id: doctorId }, data: { ...dto, languages: dto.languages ?? undefined } });
        return this.dashboard(userId);
    }
    async setDoctorLeave(userId, doctorId, onLeave) {
        const doc = await this.doctorOfMine(userId, doctorId);
        const status = onLeave ? client_1.OnboardingDoctorStatus.ON_LEAVE
            : isAccredited(await this.mine(userId)) ? client_1.OnboardingDoctorStatus.APPROVED : client_1.OnboardingDoctorStatus.IN_REVIEW;
        await this.prisma.onboardingDoctor.update({ where: { id: doc.id }, data: { status } });
        return this.dashboard(userId);
    }
    async removeDoctor(userId, doctorId) {
        await this.doctorOfMine(userId, doctorId);
        await this.prisma.onboardingDoctor.delete({ where: { id: doctorId } });
        return this.dashboard(userId);
    }
    async sendAvailabilityLink(userId, doctorId) {
        if (!(await this.video.enabled())) {
            throw new common_1.BadRequestException('Video consultations are currently unavailable.');
        }
        const doc = await this.doctorOfMine(userId, doctorId);
        const token = doc.availabilityToken || tok(24);
        if (!doc.availabilityToken)
            await this.prisma.onboardingDoctor.update({ where: { id: doc.id }, data: { availabilityToken: token } });
        await this.notify.sendAvailabilityLink({ name: doc.name, email: doc.email }, token);
        return { sent: true };
    }
    async setPricing(userId, dto) {
        const app = await this.mine(userId);
        await this.prisma.hospitalApplication.update({
            where: { id: app.id },
            data: {
                quotedPriceUsd: dto.quotedPriceUsd, patientsPerYear: dto.patientsPerYear, imageUrl: dto.imageUrl,
                procedures: dto.procedures ?? [],
                specialties: dto.specialties ?? undefined,
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
    async setServices(userId, dto) {
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
    async generateNarrative(userId) {
        const app = await this.mine(userId);
        const reviews = app.publishedHospitalId
            ? await this.prisma.review.findMany({ where: { hospitalId: app.publishedHospitalId }, select: { text: true, rating: true, nationality: true }, take: 6, orderBy: { createdAt: 'desc' } })
            : [];
        const jci = app.accreditations.some((a) => a.body === client_1.AccreditationBody.JCI && a.status === client_1.DocStatus.VERIFIED);
        const n = await this.enrich.suggestNarrative({ name: app.legalName, city: app.city, jciAccredited: jci, reviews });
        await this.prisma.hospitalApplication.update({
            where: { id: app.id },
            data: { included: n.included, notIncluded: n.notIncluded, pros: n.pros, cons: n.cons, localBenchmarkUsd: n.localBenchmarkUsd ?? undefined },
        });
        return this.dashboard(userId);
    }
    async dashboardReviews(userId, opts = {}) {
        const app = await this.prisma.hospitalApplication.findUnique({ where: { ownerUserId: userId }, select: { publishedHospitalId: true } });
        const hospitalId = app?.publishedHospitalId;
        if (!hospitalId)
            return { reviews: [], stats: { total: 0, avgRating: null, regions: [] } };
        const where = { hospitalId };
        if (opts.rating)
            where.rating = { gte: opts.rating };
        if (opts.region)
            where.region = opts.region;
        if (opts.verified != null)
            where.verified = opts.verified;
        const reviews = await this.prisma.review.findMany({
            where, orderBy: [{ verified: 'desc' }, { reviewDate: 'desc' }], take: 100,
            select: { id: true, reviewerName: true, nationality: true, region: true, rating: true, procedure: true, reviewDate: true, text: true, textEn: true, verified: true },
        });
        const all = await this.prisma.review.findMany({ where: { hospitalId }, select: { rating: true, region: true } });
        const avgRating = all.length ? Number((all.reduce((s, r) => s + (r.rating || 0), 0) / all.length).toFixed(1)) : null;
        const regions = [...new Set(all.map((r) => r.region).filter(Boolean))];
        return { reviews, stats: { total: all.length, avgRating, regions } };
    }
    async goLive(userId) {
        const app = await this.mine(userId);
        if (app.status === client_1.OnboardingStatus.LIVE)
            throw new common_1.BadRequestException('Already live.');
        if (app.doctors.length === 0)
            throw new common_1.BadRequestException('Add at least one doctor first.');
        if (await this.video.enabled()) {
            if (!app.doctors.some((d) => d.teleconsultEnabled && d.windows.length > 0)) {
                throw new common_1.BadRequestException('Set up teleconsultation availability for at least one doctor.');
            }
        }
        const nabh = app.accreditations.some((a) => a.body === client_1.AccreditationBody.NABH && a.status === client_1.DocStatus.VERIFIED);
        const jci = app.accreditations.some((a) => a.body === client_1.AccreditationBody.JCI && a.status === client_1.DocStatus.VERIFIED);
        const hospitalId = app.publishedHospitalId || slugId(app.legalName);
        const narrative = {
            localBenchmarkUsd: app.localBenchmarkUsd ?? undefined,
            included: app.included?.length ? app.included : undefined,
            notIncluded: app.notIncluded?.length ? app.notIncluded : undefined,
            pros: app.pros ?? undefined,
            cons: app.cons ?? undefined,
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
        let primary = null;
        for (const d of app.doctors.filter((x) => x.status !== client_1.OnboardingDoctorStatus.ON_LEAVE)) {
            const surgeonId = d.publishedSurgeonId || `doc-${(0, crypto_1.randomBytes)(8).toString('hex')}`;
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
            if (!d.publishedSurgeonId)
                await this.prisma.onboardingDoctor.update({ where: { id: d.id }, data: { publishedSurgeonId: surgeonId } });
            if (!primary)
                primary = surgeonId;
        }
        await this.prisma.hospital.update({ where: { id: hospitalId }, data: { surgeonId: primary ?? undefined } });
        await this.prisma.hospitalApplication.update({ where: { id: app.id }, data: { status: client_1.OnboardingStatus.LIVE, publishedHospitalId: hospitalId } });
        void this.finalizeHospital(userId, hospitalId, app);
        return this.dashboard(userId);
    }
    async finalizeHospital(userId, hospitalId, app) {
        try {
            const mapped = await this.mapExistingReviews(hospitalId, app.legalName, app.city, app.address);
            await this.refreshRating(hospitalId);
            const count = await this.prisma.review.count({ where: { hospitalId } });
            if (count === 0) {
                this.scrape.scrapeOneHospital(hospitalId, `onboarding:${userId}`, ONBOARDING_REVIEW_TARGET).catch(() => undefined);
            }
            const h = await this.prisma.hospital.findUnique({ where: { id: hospitalId } });
            const includedEmpty = !h?.included || (Array.isArray(h.included) && h.included.length === 0);
            const prosEmpty = !h?.pros || (Array.isArray(h.pros) && h.pros.length === 0);
            if (h && includedEmpty && prosEmpty) {
                const jci = !!app.accreditations?.some((a) => a.body === 'JCI' && a.status === 'VERIFIED');
                const reviews = await this.prisma.review.findMany({ where: { hospitalId }, select: { text: true, rating: true, nationality: true }, take: 6 });
                const n = await this.enrich.suggestNarrative({ name: app.legalName, city: app.city, jciAccredited: jci, overallRating: h.overallRating, reviews });
                await this.prisma.hospital.update({
                    where: { id: hospitalId },
                    data: { included: n.included, notIncluded: n.notIncluded, pros: n.pros, cons: n.cons, localBenchmarkUsd: h.localBenchmarkUsd ?? n.localBenchmarkUsd ?? undefined },
                });
                await this.prisma.hospitalApplication.update({
                    where: { id: app.id },
                    data: { included: n.included, notIncluded: n.notIncluded, pros: n.pros, cons: n.cons, localBenchmarkUsd: h.localBenchmarkUsd ?? n.localBenchmarkUsd ?? undefined },
                }).catch(() => undefined);
            }
            void mapped;
        }
        catch { }
    }
    async mapExistingReviews(newHospitalId, name, city, address) {
        const norm = (s) => (s || '').toLowerCase()
            .replace(/\b(pvt|ltd|private|limited|hospitals?|healthcare|medical|centre|center|institute|clinic|the|of|research)\b/g, ' ')
            .replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
        const target = norm(name);
        if (!target)
            return 0;
        const nameTok = new Set(target.split(' ').filter(Boolean));
        const claimed = new Set([...nameTok, ...norm(`${city ?? ''} ${address ?? ''}`).split(' ').filter(Boolean)]);
        const cityN = (city || '').toLowerCase().trim();
        const candidates = await this.prisma.hospital.findMany({ where: { id: { not: newHospitalId } }, select: { id: true, name: true, city: true } });
        const matches = candidates.filter((c) => {
            const cTok = norm(c.name).split(' ').filter(Boolean);
            if (!cTok.length)
                return false;
            const sharesName = cTok.some((t) => nameTok.has(t));
            const noStrayBranch = cTok.every((t) => claimed.has(t));
            const sameCity = !cityN || (c.city || '').toLowerCase().includes(cityN) || cityN.includes((c.city || '').toLowerCase());
            return sharesName && noStrayBranch && sameCity;
        });
        if (!matches.length)
            return 0;
        const moved = await this.prisma.review.updateMany({ where: { hospitalId: { in: matches.map((m) => m.id) } }, data: { hospitalId: newHospitalId } });
        return moved.count;
    }
    async refreshRating(hospitalId) {
        const agg = await this.prisma.review.aggregate({ where: { hospitalId }, _avg: { rating: true }, _count: true });
        if (agg._count) {
            await this.prisma.hospital.update({
                where: { id: hospitalId },
                data: { overallRating: agg._avg.rating != null ? Number(agg._avg.rating.toFixed(1)) : undefined },
            });
        }
    }
    async setPassword(userId, password) {
        await this.prisma.user.update({ where: { id: userId }, data: { password: await bcrypt.hash(password, 12) } });
        return { updated: true };
    }
    async availabilityByToken(token) {
        const doc = await this.prisma.onboardingDoctor.findUnique({
            where: { availabilityToken: token },
            select: {
                id: true, name: true, specialty: true, timezone: true, teleconsultEnabled: true,
                windows: { orderBy: [{ weekday: 'asc' }, { start: 'asc' }] },
                application: { select: { legalName: true } },
                teleconsults: {
                    where: { status: 'SCHEDULED' },
                    orderBy: { scheduledAt: 'asc' },
                    select: { id: true, scheduledAt: true, patient: { select: { name: true } } },
                },
            },
        });
        if (!doc)
            throw new common_1.NotFoundException('Invalid or expired link');
        return { ...doc, videoEnabled: await this.video.enabled() };
    }
    async setAvailability(token, dto) {
        const doc = await this.prisma.onboardingDoctor.findUnique({ where: { availabilityToken: token }, select: { id: true } });
        if (!doc)
            throw new common_1.NotFoundException('Invalid or expired link');
        for (const w of dto.windows)
            if (w.end <= w.start)
                throw new common_1.BadRequestException('Each window must end after it starts.');
        await this.prisma.$transaction([
            this.prisma.availabilityWindow.deleteMany({ where: { doctorId: doc.id } }),
            this.prisma.availabilityWindow.createMany({ data: dto.windows.map((w) => ({ doctorId: doc.id, weekday: w.weekday, start: w.start, end: w.end })) }),
            this.prisma.onboardingDoctor.update({ where: { id: doc.id }, data: { teleconsultEnabled: true, ...(dto.timezone ? { timezone: dto.timezone } : {}) } }),
        ]);
        return this.availabilityByToken(token);
    }
    async listApplications(status) {
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
        const counts = { ALL: 0 };
        for (const g of grouped) {
            counts[g.status] = g._count;
            counts.ALL += g._count;
        }
        return { applications, counts };
    }
    async getForAdmin(id) {
        const app = await this.prisma.hospitalApplication.findUnique({ where: { id }, include: APP_INCLUDE });
        if (!app)
            throw new common_1.NotFoundException('Application not found');
        const { sessionToken, ...rest } = app;
        return rest;
    }
    async reviewDoc(docId, dto, adminId) {
        const doc = await this.prisma.onboardingDocument.findUnique({ where: { id: docId } });
        if (!doc)
            throw new common_1.NotFoundException('Document not found');
        return this.prisma.onboardingDocument.update({ where: { id: docId }, data: { status: dto.status, note: dto.note, reviewedBy: adminId, reviewedAt: new Date() } });
    }
    async adminResendOtp(id) {
        const app = await this.prisma.hospitalApplication.findUnique({ where: { id }, include: { contact: true } });
        if (!app)
            throw new common_1.NotFoundException('Application not found');
        if (!app.contact)
            throw new common_1.BadRequestException('No authorised contact captured yet — the hospital must finish the Details step.');
        if (app.contact.emailVerifiedAt)
            throw new common_1.BadRequestException('This contact is already verified.');
        const emailOtp = otp();
        await this.prisma.authorisedContact.update({
            where: { applicationId: id },
            data: { emailOtp, emailOtpExp: new Date(Date.now() + 10 * 60 * 1000), emailOtpTries: 0 },
        });
        await this.notify.sendEmailOtp(app.contact.workEmail, emailOtp);
        return this.getForAdmin(id);
    }
    async adminResendCredentials(id) {
        const app = await this.prisma.hospitalApplication.findUnique({ where: { id }, include: { contact: true, agreement: true } });
        if (!app)
            throw new common_1.NotFoundException('Application not found');
        if (!app.contact)
            throw new common_1.BadRequestException('No authorised contact captured yet.');
        if (!app.agreement)
            throw new common_1.BadRequestException('The hospital must e-sign the commission agreement first.');
        const email = app.contact.workEmail;
        const oneTimePassword = tok(6);
        const password = await bcrypt.hash(oneTimePassword, 12);
        if (app.ownerUserId) {
            await this.prisma.user.update({ where: { id: app.ownerUserId }, data: { password } });
        }
        else {
            const clash = await this.prisma.user.findUnique({ where: { email } });
            if (clash)
                throw new common_1.BadRequestException('An account already exists for this email.');
            const user = await this.prisma.user.create({
                data: { email, name: app.contact.name, role: 'HOSPITAL', country: 'India', password, emailVerifiedAt: new Date() },
            });
            await this.prisma.hospitalApplication.update({
                where: { id }, data: { ownerUserId: user.id, sessionToken: null, status: client_1.OnboardingStatus.PROVISIONED },
            });
        }
        await this.notify.sendCredentials(email, app.contact.whatsapp, email, oneTimePassword);
        return this.getForAdmin(id);
    }
    async setApplicationStatus(id, status) {
        const app = await this.prisma.hospitalApplication.findUnique({ where: { id } });
        if (!app)
            throw new common_1.NotFoundException('Application not found');
        await this.prisma.hospitalApplication.update({ where: { id }, data: { status } });
        return this.getForAdmin(id);
    }
    async setPriority(id, priority) {
        const app = await this.prisma.hospitalApplication.findUnique({ where: { id } });
        if (!app)
            throw new common_1.NotFoundException('Application not found');
        await this.prisma.hospitalApplication.update({ where: { id }, data: { priority } });
        if (app.publishedHospitalId) {
            await this.prisma.hospital.update({ where: { id: app.publishedHospitalId }, data: { priority } });
        }
        return this.getForAdmin(id);
    }
    async docFile(docId, userId, isAdmin) {
        const doc = await this.prisma.onboardingDocument.findUnique({ where: { id: docId }, include: { application: { select: { ownerUserId: true } } } });
        if (!doc)
            throw new common_1.NotFoundException('Document not found');
        if (!isAdmin && doc.application.ownerUserId !== userId)
            throw new common_1.ForbiddenException('Not your document');
        return { path: (0, path_1.join)(docs_storage_1.HOSPITAL_DOCS_DIR, doc.fileUrl), name: doc.originalName || doc.fileUrl };
    }
};
exports.PartnerService = PartnerService;
exports.PartnerService = PartnerService = PartnerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        notification_service_1.NotificationService,
        accreditation_service_1.AccreditationService,
        video_service_1.VideoService,
        enrichment_service_1.EnrichmentService,
        scrape_service_1.ScrapeService,
        bulk_import_service_1.BulkImportService])
], PartnerService);
//# sourceMappingURL=partner.service.js.map