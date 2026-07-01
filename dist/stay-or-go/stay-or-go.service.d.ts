import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
export declare class StayOrGoService {
    private prisma;
    private ai;
    constructor(prisma: PrismaService, ai: AiService);
    private toClientShape;
    analyze(params: {
        diagnosis: string;
        country: string;
        treatment: string;
        urgency: string;
    }): Promise<any>;
}
