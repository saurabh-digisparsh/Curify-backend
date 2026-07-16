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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeleconsultService = void 0;
exports.zonedWallToUtc = zonedWallToUtc;
exports.slotStarts = slotStarts;
exports.computeSlots = computeSlots;
const common_1 = require("@nestjs/common");
const path_1 = require("path");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const video_service_1 = require("./video.service");
const notification_service_1 = require("./notification.service");
const docs_storage_1 = require("./docs.storage");
const DOC_SELECT = {
    id: true, sender: true, kind: true, originalName: true, createdAt: true,
};
const TELECONSULT_SELECT = {
    id: true, scheduledAt: true, status: true, startedAt: true, endedAt: true, journeyId: true,
    quoteAmount: true, quoteCurrency: true, quoteNote: true, quotedAt: true, quoteAcceptedAt: true,
    doctor: { select: { id: true, name: true, specialty: true, application: { select: { legalName: true } } } },
    documents: { select: DOC_SELECT, orderBy: { createdAt: 'asc' } },
};
const MONITOR_SELECT = {
    id: true, scheduledAt: true, status: true, startedAt: true, endedAt: true,
    quoteAmount: true, quoteCurrency: true, quoteNote: true, quotedAt: true,
    patient: { select: { name: true } },
    doctor: { select: { id: true, name: true, specialty: true } },
    documents: { select: DOC_SELECT, orderBy: { createdAt: 'asc' } },
};
const DOCTOR_MONITOR_SELECT = {
    ...MONITOR_SELECT,
    patient: { select: { name: true, email: true } },
};
const SLOT_MINUTES = 30;
const HORIZON_DAYS = 14;
function tzYMD(date, timeZone) {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
    const g = (t) => Number(p.find((x) => x.type === t).value);
    return { y: g('year'), m: g('month'), d: g('day') };
}
function zonedWallToUtc(y, m0, d, hh, mm, timeZone) {
    const guess = Date.UTC(y, m0, d, hh, mm);
    const p = new Intl.DateTimeFormat('en-US', {
        timeZone, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(guess));
    const g = (t) => Number(p.find((x) => x.type === t).value);
    const wallAsUtc = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute'), g('second'));
    return new Date(guess - (wallAsUtc - guess));
}
function* slotStarts(start, end) {
    const toMin = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
    const e = toMin(end);
    for (let t = toMin(start); t + SLOT_MINUTES <= e; t += SLOT_MINUTES)
        yield [Math.floor(t / 60), t % 60];
}
function computeSlots(timeZone, windows, bookedMs) {
    if (windows.length === 0)
        return [];
    const now = Date.now();
    const seen = new Set();
    for (let day = 0; day < HORIZON_DAYS; day++) {
        const { y, m, d } = tzYMD(new Date(now + day * 86_400_000), timeZone);
        const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
        for (const w of windows) {
            if (w.weekday !== weekday)
                continue;
            for (const [hh, mm] of slotStarts(w.start, w.end)) {
                const inst = zonedWallToUtc(y, m - 1, d, hh, mm, timeZone);
                const t = inst.getTime();
                if (t <= now || bookedMs.has(t))
                    continue;
                seen.add(inst.toISOString());
            }
        }
    }
    return [...seen].sort();
}
let TeleconsultService = class TeleconsultService {
    constructor(prisma, video, notif) {
        this.prisma = prisma;
        this.video = video;
        this.notif = notif;
    }
    async bookedMs(doctorId) {
        const rows = await this.prisma.teleconsult.findMany({
            where: {
                doctorId, scheduledAt: { gte: new Date() },
                status: { in: [client_1.TeleconsultStatus.SCHEDULED, client_1.TeleconsultStatus.IN_PROGRESS] },
            },
            select: { scheduledAt: true },
        });
        return new Set(rows.map((r) => r.scheduledAt.getTime()));
    }
    async availableSlots(doctorId) {
        const doc = await this.prisma.onboardingDoctor.findFirst({
            where: { id: doctorId, teleconsultEnabled: true },
            select: { timezone: true, windows: { select: { weekday: true, start: true, end: true } } },
        });
        if (!doc)
            throw new common_1.NotFoundException('This doctor is not available for teleconsults.');
        return computeSlots(doc.timezone, doc.windows, await this.bookedMs(doctorId));
    }
    async book(userId, dto) {
        const doc = await this.prisma.onboardingDoctor.findFirst({
            where: { id: dto.doctorId, teleconsultEnabled: true },
            select: { id: true, name: true, email: true, timezone: true, availabilityToken: true, windows: { select: { weekday: true, start: true, end: true } } },
        });
        if (!doc)
            throw new common_1.NotFoundException('This doctor is not available for teleconsults.');
        if (dto.journeyId) {
            const existing = await this.prisma.teleconsult.findFirst({
                where: { journeyId: dto.journeyId, status: { in: [client_1.TeleconsultStatus.SCHEDULED, client_1.TeleconsultStatus.IN_PROGRESS] } },
                select: { id: true },
            });
            if (existing)
                throw new common_1.BadRequestException('You already have a consultation booked for this journey. Cancel it first to rebook.');
        }
        const wanted = new Date(dto.scheduledAt).toISOString();
        const open = computeSlots(doc.timezone, doc.windows, await this.bookedMs(doc.id));
        if (!open.includes(wanted))
            throw new common_1.BadRequestException('That time is no longer available. Please pick another slot.');
        const tc = await this.prisma.teleconsult.create({
            data: { patientId: userId, doctorId: doc.id, journeyId: dto.journeyId ?? null, scheduledAt: new Date(wanted) },
            select: TELECONSULT_SELECT,
        });
        const patient = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
        this.notif.sendTeleconsultBooked({
            teleconsultId: tc.id, scheduledAt: new Date(wanted),
            patient: { email: patient?.email, name: patient?.name },
            doctor: { name: doc.name, email: doc.email, availabilityToken: doc.availabilityToken, timezone: doc.timezone },
        }).catch(() => { });
        return tc;
    }
    async cancel(userId, id) {
        const tc = await this.prisma.teleconsult.findUnique({ where: { id }, select: { patientId: true, status: true } });
        if (!tc || tc.patientId !== userId)
            throw new common_1.NotFoundException('Consultation not found');
        if (tc.status === client_1.TeleconsultStatus.COMPLETED)
            throw new common_1.BadRequestException('This consultation is already completed.');
        await this.prisma.teleconsult.update({ where: { id }, data: { status: client_1.TeleconsultStatus.CANCELLED } });
        return this.mine(userId);
    }
    async acceptQuote(userId, id) {
        const tc = await this.prisma.teleconsult.findUnique({
            where: { id }, select: { patientId: true, quoteAmount: true, quoteAcceptedAt: true },
        });
        if (!tc || tc.patientId !== userId)
            throw new common_1.NotFoundException('Consultation not found');
        if (tc.quoteAmount == null)
            throw new common_1.BadRequestException('The doctor has not sent a quote yet.');
        if (!tc.quoteAcceptedAt) {
            await this.prisma.teleconsult.update({ where: { id }, data: { quoteAcceptedAt: new Date() } });
        }
        return this.mine(userId);
    }
    mine(userId) {
        return this.prisma.teleconsult.findMany({
            where: { patientId: userId },
            orderBy: { scheduledAt: 'asc' },
            select: TELECONSULT_SELECT,
        });
    }
    async patientVideoToken(userId, id) {
        const tc = await this.prisma.teleconsult.findUnique({
            where: { id },
            select: { patientId: true, status: true, roomName: true, patient: { select: { name: true } } },
        });
        if (!tc || tc.patientId !== userId)
            throw new common_1.NotFoundException('Consultation not found');
        if (tc.status !== client_1.TeleconsultStatus.SCHEDULED && tc.status !== client_1.TeleconsultStatus.IN_PROGRESS) {
            throw new common_1.BadRequestException('This consultation is not active.');
        }
        return this.video.mintJitsi(tc.roomName, { id: userId, name: tc.patient?.name || 'Patient' }, false);
    }
    async patientAddDoc(userId, id, file, kind) {
        if (!file)
            throw new common_1.BadRequestException('No file uploaded');
        const tc = await this.prisma.teleconsult.findUnique({ where: { id }, select: { patientId: true } });
        if (!tc || tc.patientId !== userId)
            throw new common_1.NotFoundException('Consultation not found');
        await this.prisma.teleconsultDocument.create({
            data: { teleconsultId: id, sender: client_1.TeleconsultDocSender.PATIENT, kind: kind || null, fileUrl: file.filename, originalName: file.originalname },
        });
        return this.mine(userId);
    }
    async doctorVideoToken(availabilityToken, id) {
        const doc = await this.prisma.onboardingDoctor.findUnique({
            where: { availabilityToken }, select: { id: true, name: true },
        });
        if (!doc)
            throw new common_1.NotFoundException('Invalid or expired link');
        const tc = await this.prisma.teleconsult.findUnique({
            where: { id }, select: { doctorId: true, status: true, roomName: true, startedAt: true },
        });
        if (!tc || tc.doctorId !== doc.id)
            throw new common_1.NotFoundException('Consultation not found');
        if (tc.status === client_1.TeleconsultStatus.COMPLETED || tc.status === client_1.TeleconsultStatus.CANCELLED) {
            throw new common_1.BadRequestException('This consultation is not active.');
        }
        if (tc.status === client_1.TeleconsultStatus.SCHEDULED) {
            await this.prisma.teleconsult.update({
                where: { id }, data: { status: client_1.TeleconsultStatus.IN_PROGRESS, startedAt: tc.startedAt ?? new Date() },
            });
        }
        return this.video.mintJitsi(tc.roomName, { id: doc.id, name: `Dr ${doc.name}` }, true);
    }
    async doctorTcOrThrow(token, id) {
        const doc = await this.prisma.onboardingDoctor.findUnique({ where: { availabilityToken: token }, select: { id: true } });
        if (!doc)
            throw new common_1.NotFoundException('Invalid or expired link');
        const tc = await this.prisma.teleconsult.findUnique({ where: { id }, select: { id: true, doctorId: true } });
        if (!tc || tc.doctorId !== doc.id)
            throw new common_1.NotFoundException('Consultation not found');
        return { doc, tc };
    }
    async doctorConsults(token) {
        const doc = await this.prisma.onboardingDoctor.findUnique({ where: { availabilityToken: token }, select: { id: true } });
        if (!doc)
            throw new common_1.NotFoundException('Invalid or expired link');
        return this.prisma.teleconsult.findMany({
            where: { doctorId: doc.id }, orderBy: { scheduledAt: 'desc' }, select: DOCTOR_MONITOR_SELECT,
        });
    }
    async setQuote(token, id, dto) {
        await this.doctorTcOrThrow(token, id);
        await this.prisma.teleconsult.update({
            where: { id },
            data: { quoteAmount: dto.amount, quoteCurrency: dto.currency || 'USD', quoteNote: dto.note ?? null, quotedAt: new Date() },
        });
        return this.doctorConsults(token);
    }
    async doctorComplete(token, id) {
        await this.doctorTcOrThrow(token, id);
        await this.prisma.teleconsult.update({
            where: { id }, data: { status: client_1.TeleconsultStatus.COMPLETED, endedAt: new Date() },
        });
        return this.doctorConsults(token);
    }
    async doctorEndCall(token, id) {
        await this.doctorTcOrThrow(token, id);
        const cur = await this.prisma.teleconsult.findUnique({ where: { id }, select: { status: true } });
        if (cur?.status === client_1.TeleconsultStatus.IN_PROGRESS) {
            await this.prisma.teleconsult.update({
                where: { id }, data: { status: client_1.TeleconsultStatus.COMPLETED, endedAt: new Date() },
            });
        }
        return this.doctorConsults(token);
    }
    async doctorAddDoc(token, id, file, kind) {
        if (!file)
            throw new common_1.BadRequestException('No file uploaded');
        await this.doctorTcOrThrow(token, id);
        await this.prisma.teleconsultDocument.create({
            data: { teleconsultId: id, sender: client_1.TeleconsultDocSender.DOCTOR, kind: kind || null, fileUrl: file.filename, originalName: file.originalname },
        });
        return this.doctorConsults(token);
    }
    async hospitalConsults(userId) {
        const app = await this.prisma.hospitalApplication.findUnique({ where: { ownerUserId: userId }, select: { id: true } });
        if (!app)
            throw new common_1.NotFoundException('No hospital application for this account.');
        const consults = await this.prisma.teleconsult.findMany({
            where: { doctor: { applicationId: app.id } },
            orderBy: { scheduledAt: 'desc' },
            select: MONITOR_SELECT,
        });
        const stats = {
            total: consults.length,
            scheduled: consults.filter((c) => c.status === client_1.TeleconsultStatus.SCHEDULED).length,
            live: consults.filter((c) => c.status === client_1.TeleconsultStatus.IN_PROGRESS).length,
            completed: consults.filter((c) => c.status === client_1.TeleconsultStatus.COMPLETED).length,
        };
        return { consults, stats };
    }
    async docOrThrow(docId) {
        const doc = await this.prisma.teleconsultDocument.findUnique({
            where: { id: docId },
            select: {
                fileUrl: true, originalName: true,
                teleconsult: { select: { patientId: true, doctor: { select: { availabilityToken: true, application: { select: { ownerUserId: true } } } } } },
            },
        });
        if (!doc)
            throw new common_1.NotFoundException('Document not found');
        return doc;
    }
    path(doc) {
        return { path: (0, path_1.join)(docs_storage_1.HOSPITAL_DOCS_DIR, doc.fileUrl), name: doc.originalName || doc.fileUrl };
    }
    async docFileForHospital(docId, userId) {
        const doc = await this.docOrThrow(docId);
        if (doc.teleconsult.doctor.application?.ownerUserId !== userId)
            throw new common_1.ForbiddenException('Not your document');
        return this.path(doc);
    }
    async docFileForDoctor(docId, token) {
        const doc = await this.docOrThrow(docId);
        if (doc.teleconsult.doctor.availabilityToken !== token)
            throw new common_1.ForbiddenException('Not your document');
        return this.path(doc);
    }
    async docFileForPatient(docId, userId) {
        const doc = await this.docOrThrow(docId);
        if (doc.teleconsult.patientId !== userId)
            throw new common_1.ForbiddenException('Not your document');
        return this.path(doc);
    }
};
exports.TeleconsultService = TeleconsultService;
exports.TeleconsultService = TeleconsultService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, video_service_1.VideoService, notification_service_1.NotificationService])
], TeleconsultService);
//# sourceMappingURL=teleconsult.service.js.map