import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
export declare class TreatmentsService {
    private prisma;
    private ai;
    constructor(prisma: PrismaService, ai: AiService);
    list(): import(".prisma/client").Prisma.PrismaPromise<{
        specialty: string;
        slug: string;
        label: string;
    }[]>;
    classify(text: string): Promise<{
        matched: boolean;
        created: boolean;
        specialty: string;
        slug: string;
        label: string;
    }>;
    private add;
    private slugify;
}
