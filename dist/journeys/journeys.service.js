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
const WRITABLE = [
    'title', 'status', 'treatment', 'city', 'urgency', 'homeCountry', 'description',
    'step', 'reportId', 'analysis', 'stayOrGo', 'hospitalId', 'tripPlan',
];
let JourneysService = class JourneysService {
    constructor(prisma, ai) {
        this.prisma = prisma;
        this.ai = ai;
    }
    getMessages(j) {
        return j?.hospitalChat?.messages ?? [];
    }
    newMsg(p) {
        return { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, at: new Date().toISOString(), kind: 'TEXT', ...p };
    }
    async appendMessage(id, current, msg) {
        const messages = [...current, msg];
        await this.prisma.journey.update({ where: { id }, data: { hospitalChat: { messages } } });
        return messages;
    }
    async getChat(userId, id) {
        const j = await this.get(userId, id);
        return { messages: this.getMessages(j), hospitalId: j.hospitalId };
    }
    async addPatientMessage(userId, id, dto) {
        const j = await this.get(userId, id);
        const kind = dto.kind || 'TEXT';
        let body = (dto.body || '').trim();
        if (kind === 'QUOTE_REQUEST' && !body)
            body = 'I would like a detailed all-inclusive price quotation for my treatment, please.';
        if (kind === 'REPORT' && !body)
            body = 'Shared my medical report for your review.';
        if (!body)
            throw new common_1.BadRequestException('Message cannot be empty');
        const msg = this.newMsg({ sender: 'PATIENT', kind, body, ...(dto.reportId ? { reportId: dto.reportId } : {}) });
        return { messages: await this.appendMessage(id, this.getMessages(j), msg) };
    }
    async addHospitalMessage(id, dto) {
        const j = await this.prisma.journey.findUnique({ where: { id } });
        if (!j)
            throw new common_1.NotFoundException('Journey not found');
        const kind = dto.kind || 'TEXT';
        let body = (dto.body || '').trim();
        if (kind === 'QUOTE' && !body && dto.amountUsd)
            body = `Here is your all-inclusive quotation: $${dto.amountUsd.toLocaleString()}.`;
        if (!body)
            throw new common_1.BadRequestException('Message cannot be empty');
        const msg = this.newMsg({ sender: 'HOSPITAL', kind, body, ...(dto.amountUsd != null ? { amountUsd: dto.amountUsd } : {}) });
        return { messages: await this.appendMessage(id, this.getMessages(j), msg) };
    }
    async listChats() {
        const journeys = await this.prisma.journey.findMany({
            orderBy: { updatedAt: 'desc' }, take: 200,
            include: { user: { select: { name: true, email: true } } },
        });
        const withChat = journeys.filter((j) => this.getMessages(j).length > 0);
        const hids = [...new Set(withChat.map((j) => j.hospitalId).filter(Boolean))];
        const hospitals = hids.length ? await this.prisma.hospital.findMany({ where: { id: { in: hids } }, select: { id: true, name: true } }) : [];
        const hmap = new Map(hospitals.map((h) => [h.id, h.name]));
        return withChat.map((j) => {
            const msgs = this.getMessages(j);
            const last = msgs[msgs.length - 1];
            return {
                journeyId: j.id,
                patient: j.user?.name || j.user?.email || 'Patient',
                hospital: j.hospitalId ? (hmap.get(j.hospitalId) || 'Hospital') : 'Hospital',
                treatment: j.treatment,
                messageCount: msgs.length,
                lastMessage: last?.body || '',
                lastAt: last?.at || j.updatedAt.toISOString(),
                awaitingReply: last?.sender === 'PATIENT',
            };
        });
    }
    async getChatForStaff(id) {
        const j = await this.prisma.journey.findUnique({ where: { id }, include: { user: { select: { name: true, email: true } } } });
        if (!j)
            throw new common_1.NotFoundException('Journey not found');
        return { messages: this.getMessages(j), patient: j.user?.name || j.user?.email, treatment: j.treatment };
    }
    async analyzeChat(userId, id) {
        const j = await this.get(userId, id);
        const msgs = this.getMessages(j);
        if (msgs.length === 0)
            throw new common_1.BadRequestException('There is no chat to analyze yet.');
        const transcript = msgs.map((m) => `${m.sender}: ${m.body}${m.amountUsd ? ` [quote $${m.amountUsd}]` : ''}`).join('\n');
        const result = await this.ai.analyzeHospitalChat({ transcript, treatment: j.treatment || '' });
        const tp = j.tripPlan || {};
        if (result?.agreedQuoteUsd) {
            tp.costs = { ...(tp.costs || {}), surgery: { item: 'Surgery (agreed with hospital)', amount: result.agreedQuoteUsd, note: 'Quoted in hospital chat' } };
            tp.totalEstimate = Object.values(tp.costs).reduce((s, c) => s + (Number(c.amount) || 0), 0);
            tp.chatSummary = result.summary;
            await this.prisma.journey.update({ where: { id }, data: { tripPlan: tp } });
        }
        return { summary: result?.summary || '', agreedQuoteUsd: result?.agreedQuoteUsd || null, inclusions: result?.inclusions || [], tripPlan: tp };
    }
    pick(body) {
        const data = {};
        for (const k of WRITABLE)
            if (body[k] !== undefined)
                data[k] = body[k];
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