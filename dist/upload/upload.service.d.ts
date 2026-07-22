import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
export declare const MAX_REANALYSIS = 2;
export declare const MAX_DOCUMENTS = 8;
export declare class UploadService {
    private prisma;
    private ai;
    private readonly logger;
    constructor(prisma: PrismaService, ai: AiService);
    private aiGate;
    private gated;
    private persistDocs;
    private loadDocs;
    private ocrPdf;
    private extractPdfText;
    analyzeAndStore(params: {
        userId?: string;
        file?: Express.Multer.File;
        files?: Express.Multer.File[];
        description?: string;
        treatment?: string;
        country?: string;
        urgency?: string;
        previousReportId?: string;
        reanalysisCount?: number;
    }): Promise<{
        success: boolean;
        reportId: string;
        reportRef: string;
        status: string;
    }>;
    reanalyze(reportId: string, userId: string, isAdmin?: boolean): Promise<{
        success: boolean;
        reportId: string;
        reportRef: string;
        status: string;
    }>;
    private runAnalysisJob;
    getReport(id: string, requesterId: string, isAdmin?: boolean): Promise<any>;
    private fileSize;
    listMyDocuments(userId: string): Promise<{
        journeyId: string | null;
        title: string;
        treatment: string | null;
        status: string | null;
        documents: any[];
    }[]>;
    documentFile(reportId: string, index: number, userId: string, isAdmin?: boolean): Promise<{
        path: string;
        name: string;
        mime: string;
    }>;
}
