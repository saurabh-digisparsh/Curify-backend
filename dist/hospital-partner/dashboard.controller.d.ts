import { StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { PartnerService } from './partner.service';
import { TeleconsultService } from './teleconsult.service';
import { DoctorDto, DoctorLeaveDto, PricingDto, ServicesDto, SetPasswordDto } from './dto/partner.dto';
export declare class DashboardController {
    private readonly svc;
    private readonly tele;
    constructor(svc: PartnerService, tele: TeleconsultService);
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
    services(dto: ServicesDto, req: any): Promise<any>;
    generateNarrative(req: any): Promise<any>;
    reviews(req: any, rating?: string, region?: string, verified?: string): Promise<{
        reviews: {
            id: string;
            reviewerName: string;
            nationality: string;
            procedure: string;
            rating: number;
            reviewDate: Date;
            text: string;
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
            documents: {
                id: string;
                createdAt: Date;
                originalName: string;
                sender: import(".prisma/client").$Enums.TeleconsultDocSender;
                kind: string;
            }[];
            doctor: {
                id: string;
                name: string;
                specialty: string;
            };
            scheduledAt: Date;
            startedAt: Date;
            endedAt: Date;
            quoteAmount: number;
            quoteCurrency: string;
            quoteNote: string;
            quotedAt: Date;
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
