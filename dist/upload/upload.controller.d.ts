import { StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { UploadService } from './upload.service';
export declare class UploadController {
    private uploadService;
    constructor(uploadService: UploadService);
    upload(file: Express.Multer.File, body: {
        description?: string;
        treatment?: string;
        country?: string;
        urgency?: string;
    }, req: any): Promise<{
        success: boolean;
        reportId: string;
        reportRef: string;
        status: string;
    }>;
    uploadMulti(files: Express.Multer.File[], body: {
        description?: string;
        treatment?: string;
        country?: string;
        urgency?: string;
        previousReportId?: string;
    }, req: any): Promise<{
        success: boolean;
        reportId: string;
        reportRef: string;
        status: string;
    }>;
    reanalyze(id: string, req: any): Promise<{
        success: boolean;
        reportId: string;
        reportRef: string;
        status: string;
    }>;
    getAnalysis(id: string, req: any): Promise<any>;
    listFiles(req: any): Promise<{
        journeyId: string | null;
        title: string;
        treatment: string | null;
        status: string | null;
        documents: any[];
    }[]>;
    file(reportId: string, index: string, req: any, res: Response): Promise<StreamableFile>;
}
