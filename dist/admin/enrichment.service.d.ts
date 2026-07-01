import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
export declare class EnrichmentService {
    private prisma;
    private ai;
    private readonly logger;
    constructor(prisma: PrismaService, ai: AiService);
    enrichHospital(hospitalId: string, force?: boolean): Promise<boolean>;
    enrichMissing(opts?: {
        force?: boolean;
        limit?: number;
    }): Promise<{
        total: number;
        enriched: number;
        failed: number;
    }>;
}
