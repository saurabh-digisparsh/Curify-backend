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
exports.JourneysService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const ai_service_1 = require("../ai/ai.service");
const travel_1 = require("../common/travel");
const WRITABLE = [
    'title', 'status', 'treatment', 'city', 'urgency', 'homeCountry', 'description',
    'travelDate', 'step', 'reportId', 'analysis', 'stayOrGo', 'hospitalId', 'tripPlan',
];
let JourneysService = class JourneysService {
    constructor(prisma, ai) {
        this.prisma = prisma;
        this.ai = ai;
    }
    pick(body) {
        const data = {};
        for (const k of WRITABLE)
            if (body[k] !== undefined)
                data[k] = body[k];
        if (data.travelDate != null) {
            const d = new Date(data.travelDate);
            if (Number.isNaN(d.getTime()))
                delete data.travelDate;
            else {
                data.travelDate = d;
                data.urgent = (0, travel_1.deriveUrgent)(d);
            }
        }
        return data;
    }
    async list(userId, opts) {
        if (!opts) {
            return this.prisma.journey.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' } });
        }
        const page = Math.max(1, Number(opts.page) || 1);
        const pageSize = Math.min(50, Math.max(1, Number(opts.pageSize) || 10));
        const where = { userId };
        const [total, journeys] = await Promise.all([
            this.prisma.journey.count({ where }),
            this.prisma.journey.findMany({
                where, orderBy: { updatedAt: 'desc' },
                skip: (page - 1) * pageSize, take: pageSize,
            }),
        ]);
        return { journeys, total, page, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
    }
    async get(userId, id) {
        const journey = await this.prisma.journey.findFirst({ where: { id, userId } });
        if (!journey)
            throw new common_1.NotFoundException('Journey not found');
        return journey;
    }
    create(userId, body) {
        return this.prisma.journey.create({ data: { userId, ...this.pick(body) } });
    }
    async update(userId, id, body) {
        await this.get(userId, id);
        return this.prisma.journey.update({ where: { id }, data: this.pick(body) });
    }
    async publicTracking(id) {
        const j = await this.prisma.journey.findUnique({ where: { id } });
        if (!j)
            throw new common_1.NotFoundException('Journey not found');
        const tp = j.tripPlan || {};
        const ti = tp.travelInfo || {};
        let hospital = null;
        if (j.hospitalId) {
            hospital = await this.prisma.hospital.findUnique({
                where: { id: j.hospitalId },
                select: { name: true, city: true, intlOfficePhone: true, intlOfficeEmail: true },
            });
        }
        return {
            treatment: j.treatment,
            procedure: j.analysis?.diagnosis?.condition || j.treatment || null,
            homeCountry: j.homeCountry,
            departureCity: ti.departureCity ?? null,
            travelDate: ti.travelDate ?? null,
            hospitalName: hospital?.name ?? null,
            hospitalCity: hospital?.city ?? tp.city ?? null,
            hospitalPhone: hospital?.intlOfficePhone ?? null,
            hospitalEmail: hospital?.intlOfficeEmail ?? null,
            step: j.step,
            status: j.status,
        };
    }
    async remove(userId, id) {
        await this.get(userId, id);
        await this.prisma.journey.delete({ where: { id } });
        return { ok: true };
    }
};
exports.JourneysService = JourneysService;
exports.JourneysService = JourneysService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, ai_service_1.AiService])
], JourneysService);
//# sourceMappingURL=journeys.service.js.map