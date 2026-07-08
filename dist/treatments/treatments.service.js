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
exports.TreatmentsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const ai_service_1 = require("../ai/ai.service");
let TreatmentsService = class TreatmentsService {
    constructor(prisma, ai) {
        this.prisma = prisma;
        this.ai = ai;
    }
    list() {
        return this.prisma.treatment.findMany({
            where: { active: true },
            orderBy: { sortOrder: 'asc' },
            select: { slug: true, label: true, specialty: true },
        });
    }
    async classify(text) {
        const catalog = await this.prisma.treatment.findMany({
            where: { active: true },
            select: { slug: true, label: true, specialty: true },
        });
        const r = await this.ai.classifyTreatment({ text, catalog });
        if (r.slug) {
            const existing = catalog.find((c) => c.slug === r.slug);
            if (existing)
                return { ...existing, matched: true, created: false };
        }
        if (!r.label)
            throw new common_1.BadRequestException('Not a recognizable treatment');
        const added = await this.add(r.label, r.specialty);
        return { ...added, matched: false, created: true };
    }
    async add(label, specialty) {
        const slug = this.slugify(label);
        const existing = await this.prisma.treatment.findUnique({
            where: { slug },
            select: { slug: true, label: true, specialty: true },
        });
        if (existing)
            return existing;
        const max = await this.prisma.treatment.aggregate({ _max: { sortOrder: true } });
        return this.prisma.treatment.create({
            data: { slug, label, specialty, aiAdded: true, sortOrder: (max._max.sortOrder ?? 0) + 1 },
            select: { slug: true, label: true, specialty: true },
        });
    }
    slugify(label) {
        return (label
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 60) || 'treatment');
    }
};
exports.TreatmentsService = TreatmentsService;
exports.TreatmentsService = TreatmentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, ai_service_1.AiService])
], TreatmentsService);
//# sourceMappingURL=treatments.service.js.map