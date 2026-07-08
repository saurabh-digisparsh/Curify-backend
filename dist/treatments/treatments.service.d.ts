import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
export declare class TreatmentsService {
    private prisma;
    private ai;
    constructor(prisma: PrismaService, ai: AiService);
    list(): import(".prisma/client").Prisma.PrismaPromise<{
        slug: string;
        label: string;
        specialty: string;
    }[]>;
    classify(text: string): Promise<{
        matched: boolean;
        created: boolean;
        slug: string;
        label: string;
        specialty: string;
    }>;
    private add;
    private slugify;
}
