import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
export declare class EnrichmentService {
    private prisma;
    private ai;
    private readonly logger;
    constructor(prisma: PrismaService, ai: AiService);
    enrichHospital(hospitalId: string, force?: boolean): Promise<boolean>;
    suggestNarrative(params: {
        name: string;
        city: string;
        country?: string;
        overallRating?: number | null;
        jciAccredited?: boolean;
        reviews?: {
            text: string;
            rating?: number | null;
            nationality?: string | null;
        }[];
    }): Promise<{
        included: string[];
        notIncluded: string[];
        pros: string[];
        cons: string[];
        localBenchmarkUsd: number | null;
    }>;
    enrichMissing(opts?: {
        force?: boolean;
        limit?: number;
    }): Promise<{
        total: number;
        enriched: number;
        failed: number;
    }>;
}
