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
exports.RecoveryService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const ai_service_1 = require("../ai/ai.service");
const STATIC_INSURANCE = {
    status: 'Ready to Submit',
    submitted: null,
    amount: '$1,200',
    insurer: 'Contact your travel insurer',
    claimId: null,
    documents: ['Discharge Summary', 'Operative Report', 'Hospital Invoice', "Doctor's Letter of Medical Necessity", 'Receipts for all medical expenses'],
};
let RecoveryService = class RecoveryService {
    constructor(prisma, ai) {
        this.prisma = prisma;
        this.ai = ai;
    }
    async getProtocol(procedure) {
        return this.prisma.recoveryProtocol.findFirst({
            where: { procedure: { contains: procedure, mode: 'insensitive' } },
        });
    }
    async generate(params) {
        const protocol = await this.getProtocol(params.treatment);
        if (protocol) {
            return {
                checkIns: protocol.checkIns,
                tips: protocol.tips,
                handoff: protocol.handoff,
                insuranceClaim: STATIC_INSURANCE,
                source: 'protocol',
            };
        }
        const recovery = await this.ai.generateRecoveryPlan(params);
        try {
            await this.prisma.recoveryProtocol.create({
                data: {
                    procedure: params.treatment,
                    checkIns: recovery.checkIns ?? [],
                    tips: recovery.tips ?? [],
                    handoff: recovery.handoff ?? {},
                },
            });
        }
        catch { }
        return { ...recovery, insuranceClaim: STATIC_INSURANCE, source: 'ai' };
    }
};
exports.RecoveryService = RecoveryService;
exports.RecoveryService = RecoveryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, ai_service_1.AiService])
], RecoveryService);
//# sourceMappingURL=recovery.service.js.map