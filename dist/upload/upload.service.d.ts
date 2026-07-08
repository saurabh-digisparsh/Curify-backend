import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
export declare class UploadService {
    private prisma;
    private ai;
    private readonly logger;
    constructor(prisma: PrismaService, ai: AiService);
    private extractPdfText;
    analyzeAndStore(params: {
        userId?: string;
        file?: Express.Multer.File;
        files?: Express.Multer.File[];
        description?: string;
        treatment?: string;
        country?: string;
        urgency?: string;
    }): Promise<{
        success: boolean;
        reportId: string;
        reportRef: string;
        analysis: any;
    }>;
    getReport(id: string, requesterId: string, isAdmin?: boolean): Promise<any>;
}
