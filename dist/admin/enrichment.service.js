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
var EnrichmentService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnrichmentService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const ai_service_1 = require("../ai/ai.service");
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);
function computeFairness(quoted, benchmark) {
    if (!quoted || !benchmark)
        return null;
    const markup = ((quoted - benchmark) / benchmark) * 100;
    return Math.max(45, Math.min(99, Math.round(100 - markup)));
}
let EnrichmentService = EnrichmentService_1 = class EnrichmentService {
    constructor(prisma, ai) {
        this.prisma = prisma;
        this.ai = ai;
        this.logger = new common_1.Logger(EnrichmentService_1.name);
    }
    async enrichHospital(hospitalId, force = false) {
        const h = await this.prisma.hospital.findUnique({ where: { id: hospitalId } });
        if (!h)
            return false;
        if (h.quotedPriceUsd != null && !force)
            return false;
        const reviews = await this.prisma.review.findMany({
            where: { hospitalId },
            select: { text: true, rating: true, nationality: true },
            take: 6,
            orderBy: { createdAt: 'desc' },
        });
        const data = await this.ai.generateHospitalEnrichment({
            name: h.name, city: h.city, country: h.country,
            overallRating: h.overallRating, jciAccredited: h.jciAccredited, reviews,
        });
        if (!data?.quotedPriceUsd)
            throw new Error('AI returned no price');
        let surgeonId;
        if (data.surgeon?.name) {
            const s = data.surgeon;
            const id = `srg-${slugify(s.name)}`;
            const num = (v) => (Number.isFinite(v) ? v : null);
            const stats = {
                title: s.title ?? null,
                specialization: s.specialization ?? null,
                yearsExperience: num(s.yearsExperience) != null ? Math.round(s.yearsExperience) : null,
                totalProcedures: num(s.totalProcedures) != null ? Math.round(s.totalProcedures) : null,
                successRate: num(s.successRate),
                complications: num(s.complications),
                patientRating: num(s.patientRating),
                avgSurgeryTime: s.avgSurgeryTime ?? null,
                nextAvailable: s.nextAvailable ?? null,
                publications: num(s.publications) != null ? Math.round(s.publications) : null,
                education: Array.isArray(s.education) ? s.education : undefined,
                languages: Array.isArray(s.languages) ? s.languages : undefined,
                awards: Array.isArray(s.awards) ? s.awards : undefined,
            };
            await this.prisma.surgeon.upsert({
                where: { id },
                create: { id, name: s.name, hospital: h.name, country: 'India', ...stats },
                update: { ...stats },
            });
            surgeonId = id;
        }
        const quoted = Math.round(data.quotedPriceUsd);
        const localPrice = data.localPriceUsd ? Math.round(data.localPriceUsd) : null;
        const benchmark = data.localBenchmarkUsd ? Math.round(data.localBenchmarkUsd) : localPrice;
        await this.prisma.hospital.update({
            where: { id: hospitalId },
            data: {
                specialty: data.specialty ?? undefined,
                procedures: Array.isArray(data.procedures) ? data.procedures : undefined,
                quotedPriceUsd: quoted,
                localPriceUsd: localPrice,
                localBenchmarkUsd: benchmark,
                included: Array.isArray(data.included) ? data.included : undefined,
                notIncluded: Array.isArray(data.notIncluded) ? data.notIncluded : undefined,
                pros: Array.isArray(data.pros) ? data.pros : undefined,
                cons: Array.isArray(data.cons) ? data.cons : undefined,
                fairnessScore: computeFairness(quoted, benchmark) ?? undefined,
                surgeonId,
            },
        });
        return true;
    }
    async suggestNarrative(params) {
        const data = await this.ai.generateHospitalEnrichment({
            name: params.name, city: params.city, country: params.country || 'India',
            overallRating: params.overallRating ?? null, jciAccredited: params.jciAccredited ?? false,
            reviews: params.reviews ?? [],
        });
        return {
            included: Array.isArray(data?.included) ? data.included : [],
            notIncluded: Array.isArray(data?.notIncluded) ? data.notIncluded : [],
            pros: Array.isArray(data?.pros) ? data.pros : [],
            cons: Array.isArray(data?.cons) ? data.cons : [],
            localBenchmarkUsd: data?.localBenchmarkUsd ? Math.round(data.localBenchmarkUsd) : null,
            quotedPriceUsd: data?.quotedPriceUsd ? Math.round(data.quotedPriceUsd) : null,
        };
    }
    async enrichMissing(opts = {}) {
        const where = opts.force ? {} : { quotedPriceUsd: null };
        const hospitals = await this.prisma.hospital.findMany({ where, select: { id: true, name: true } });
        const todo = opts.limit ? hospitals.slice(0, opts.limit) : hospitals;
        this.logger.log(`Enriching ${todo.length} hospitals (force=${!!opts.force})`);
        let enriched = 0, failed = 0;
        for (const h of todo) {
            try {
                await this.enrichHospital(h.id, opts.force);
                enriched++;
            }
            catch (e) {
                failed++;
                this.logger.warn(`enrich failed for ${h.name}: ${e.message}`);
            }
            await new Promise((r) => setTimeout(r, 350));
        }
        this.logger.log(`Enrichment done: enriched=${enriched} failed=${failed}`);
        return { total: todo.length, enriched, failed };
    }
};
exports.EnrichmentService = EnrichmentService;
exports.EnrichmentService = EnrichmentService = EnrichmentService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, ai_service_1.AiService])
], EnrichmentService);
//# sourceMappingURL=enrichment.service.js.map