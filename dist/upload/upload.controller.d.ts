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
    }, req: any): Promise<{
        success: boolean;
        reportId: string;
        reportRef: string;
        status: string;
    }>;
    getAnalysis(id: string, req: any): Promise<any>;
}
