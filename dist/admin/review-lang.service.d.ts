import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
export declare class ReviewLangService {
    private prisma;
    private ai;
    private readonly logger;
    constructor(prisma: PrismaService, ai: AiService);
    private isCandidate;
    localizeReview(id: string): Promise<'translated' | 'english' | 'skip'>;
    localizeHospital(hospitalId: string): Promise<{
        translated: number;
        english: number;
    }>;
    localizeAll(opts?: {
        limit?: number;
    }): Promise<{
        total: number;
        translated: number;
        english: number;
        failed: number;
    }>;
}
