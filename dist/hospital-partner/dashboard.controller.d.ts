import { StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { PartnerService } from './partner.service';
import { TeleconsultService } from './teleconsult.service';
import { BulkImportService, ImportKind } from './bulk-import.service';
import { DoctorDto, DoctorLeaveDto, PricingDto, ServicesDto, SetPasswordDto } from './dto/partner.dto';
export declare class DashboardController {
    private readonly svc;
    private readonly tele;
    private readonly bulk;
    constructor(svc: PartnerService, tele: TeleconsultService, bulk: BulkImportService);
    dashboard(req: any): Promise<any>;
    setPassword(dto: SetPasswordDto, req: any): Promise<{
        updated: boolean;
    }>;
    addDoctor(dto: DoctorDto, req: any): Promise<any>;
    updateDoctor(id: string, dto: DoctorDto, req: any): Promise<any>;
    leave(id: string, dto: DoctorLeaveDto, req: any): Promise<any>;
    removeDoctor(id: string, req: any): Promise<any>;
    link(id: string, req: any): Promise<{
        sent: boolean;
    }>;
    pricing(dto: PricingDto, req: any): Promise<any>;
    templateAll(format: string | undefined, res: Response): Promise<string | StreamableFile>;
    importAll(file: Express.Multer.File, req: any): Promise<{
        imported: number;
        errors: import("./bulk-import.service").ImportError[];
        data: any;
        detail: any;
    } | {
        imported: number;
        errors: any[];
        data: any;
        detail: {
            profile: number;
            doctors: number;
            doctorsSkipped: number;
            packages: number;
        };
    }>;
    template(kind: ImportKind, res: Response): string;
    importProfile(file: Express.Multer.File, req: any): Promise<{
        imported: number;
        errors: import("./bulk-import.service").ImportError[];
        data: any;
    }>;
    importDoctors(file: Express.Multer.File, req: any): Promise<{
        imported: number;
        errors: import("./bulk-import.service").ImportError[];
        data: any;
    }>;
    importPackages(file: Express.Multer.File, req: any): Promise<{
        imported: number;
        errors: import("./bulk-import.service").ImportError[];
        data: any;
    }>;
    services(dto: ServicesDto, req: any): Promise<any>;
    generateNarrative(req: any): Promise<any>;
    reviews(req: any, rating?: string, region?: string, verified?: string): Promise<{
        reviews: {
            id: string;
            text: string;
            procedure: string;
            rating: number;
            reviewerName: string;
            nationality: string;
            reviewDate: Date;
            textEn: string;
            region: string;
            verified: boolean;
        }[];
        stats: {
            total: number;
            avgRating: number;
            regions: string[];
        };
    }>;
    goLive(req: any): Promise<any>;
    teleconsults(req: any): Promise<{
        consults: {
            id: string;
            status: import(".prisma/client").$Enums.TeleconsultStatus;
            startedAt: Date;
            documents: {
                id: string;
                sender: import(".prisma/client").$Enums.TeleconsultDocSender;
                createdAt: Date;
                kind: string;
                originalName: string;
            }[];
            scheduledAt: Date;
            doctor: {
                specialty: string;
                id: string;
                name: string;
            };
            endedAt: Date;
            quoteAmount: number;
            quoteCurrency: string;
            quoteNote: string;
            quotedAt: Date;
            cancelledBy: string;
            cancelReason: string;
            patient: {
                name: string;
            };
        }[];
        stats: {
            total: number;
            scheduled: number;
            live: number;
            completed: number;
        };
    }>;
    teleDocFile(docId: string, req: any, res: Response): Promise<StreamableFile>;
    docFile(docId: string, req: any, res: Response): Promise<StreamableFile>;
}
