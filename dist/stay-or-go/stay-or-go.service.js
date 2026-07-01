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
exports.StayOrGoService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const ai_service_1 = require("../ai/ai.service");
let StayOrGoService = class StayOrGoService {
    constructor(prisma, ai) {
        this.prisma = prisma;
        this.ai = ai;
    }
    toClientShape(raw) {
        if (!raw)
            return raw;
        if (raw.home && raw.abroad)
            return raw;
        const asList = (v) => Array.isArray(v) ? v.filter(Boolean) : v ? [String(v)] : [];
        return {
            home: {
                country: raw.homeCountry,
                waitTime: raw.homeWaitTime,
                cost: raw.homeCost,
                successRate: raw.homeSuccessRate,
                accredited: raw.homeQuality,
                risks: asList(raw.homeRisk),
            },
            abroad: {
                waitTime: raw.indiaWaitTime,
                cost: raw.indiaCost,
                successRate: raw.indiaSuccessRate,
                accredited: raw.indiaQuality,
                benefits: asList(raw.summary),
            },
            timeline: Array.isArray(raw.riskTimeline) ? raw.riskTimeline : [],
            recommendation: raw.recommendation,
            recommendationReason: raw.reasoning,
            source: raw.source ?? 'template',
        };
    }
    async analyze(params) {
        const template = await this.prisma.stayOrGoTemplate.findFirst({
            where: {
                procedure: { contains: params.treatment, mode: 'insensitive' },
                homeCountry: { contains: params.country, mode: 'insensitive' },
            },
        });
        if (template) {
            return this.toClientShape({ ...template, source: 'template' });
        }
        const aiResult = await this.ai.generateStayOrGo(params);
        try {
            await this.prisma.stayOrGoTemplate.create({
                data: {
                    procedure: params.treatment,
                    homeCountry: params.country,
                    homeCost: aiResult.home?.cost ?? '',
                    homeWaitTime: aiResult.home?.waitTime ?? '',
                    homeSuccessRate: aiResult.home?.successRate ?? '',
                    homeRisk: (aiResult.home?.risks ?? []).join('; '),
                    homeQuality: aiResult.home?.accredited ?? 'Variable',
                    indiaCost: aiResult.abroad?.cost ?? '',
                    indiaWaitTime: aiResult.abroad?.waitTime ?? '',
                    indiaSuccessRate: aiResult.abroad?.successRate ?? '',
                    indiaRisk: 'Low',
                    indiaQuality: aiResult.abroad?.accredited ?? 'World-class',
                    recommendation: aiResult.recommendation ?? 'go',
                    reasoning: aiResult.recommendationReason ?? '',
                    summary: aiResult.abroad?.benefits ?? [],
                    riskTimeline: aiResult.timeline ?? [],
                },
            });
        }
        catch {
        }
        return this.toClientShape({ ...aiResult, source: 'ai' });
    }
};
exports.StayOrGoService = StayOrGoService;
exports.StayOrGoService = StayOrGoService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, ai_service_1.AiService])
], StayOrGoService);
//# sourceMappingURL=stay-or-go.service.js.map