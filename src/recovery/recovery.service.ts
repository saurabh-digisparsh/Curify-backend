import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';

const STATIC_INSURANCE = {
  status: 'Ready to Submit',
  submitted: null,
  amount: '$1,200',
  insurer: 'Contact your travel insurer',
  claimId: null,
  documents: ['Discharge Summary', 'Operative Report', 'Hospital Invoice', "Doctor's Letter of Medical Necessity", 'Receipts for all medical expenses'],
};

@Injectable()
export class RecoveryService {
  constructor(private prisma: PrismaService, private ai: AiService) {}

  async getProtocol(procedure: string) {
    return this.prisma.recoveryProtocol.findFirst({
      where: { procedure: { contains: procedure, mode: 'insensitive' } },
    });
  }

  async generate(params: { diagnosis: string; treatment: string; hospital: string; surgeon: string }) {
    // Try DB protocol first
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

    // AI fallback
    const recovery = await this.ai.generateRecoveryPlan(params);

    // Cache the AI result as a new protocol
    try {
      await this.prisma.recoveryProtocol.create({
        data: {
          procedure: params.treatment,
          checkIns: (recovery as any).checkIns ?? [],
          tips: (recovery as any).tips ?? [],
          handoff: (recovery as any).handoff ?? {},
        },
      });
    } catch { /* ignore */ }

    return { ...recovery, insuranceClaim: STATIC_INSURANCE, source: 'ai' };
  }
}
