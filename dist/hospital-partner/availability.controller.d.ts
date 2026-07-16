import { StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { PartnerService } from './partner.service';
import { TeleconsultService } from './teleconsult.service';
import { SetAvailabilityDto, QuoteDto, TeleconsultDocDto } from './dto/partner.dto';
export declare class AvailabilityController {
    private readonly svc;
    private readonly tele;
    constructor(svc: PartnerService, tele: TeleconsultService);
    get(token: string): Promise<{
        id: string;
        name: string;
        application: {
            legalName: string;
        };
        specialty: string;
        teleconsultEnabled: boolean;
        timezone: string;
        windows: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            doctorId: string;
            weekday: number;
            start: string;
            end: string;
            recurring: boolean;
            source: import(".prisma/client").$Enums.AvailabilitySource;
        }[];
        teleconsults: {
            id: string;
            scheduledAt: Date;
            patient: {
                name: string;
            };
        }[];
    }>;
    set(token: string, dto: SetAvailabilityDto): Promise<{
        id: string;
        name: string;
        application: {
            legalName: string;
        };
        specialty: string;
        teleconsultEnabled: boolean;
        timezone: string;
        windows: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            doctorId: string;
            weekday: number;
            start: string;
            end: string;
            recurring: boolean;
            source: import(".prisma/client").$Enums.AvailabilitySource;
        }[];
        teleconsults: {
            id: string;
            scheduledAt: Date;
            patient: {
                name: string;
            };
        }[];
    }>;
    consults(token: string): Promise<{
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
            email: string;
        };
    }[]>;
    video(token: string, teleconsultId: string): Promise<import("./video.service").VideoToken>;
    quote(token: string, id: string, dto: QuoteDto): Promise<{
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
            email: string;
        };
    }[]>;
    complete(token: string, id: string): Promise<{
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
            email: string;
        };
    }[]>;
    endCall(token: string, id: string): Promise<{
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
            email: string;
        };
    }[]>;
    addDoc(token: string, id: string, file: Express.Multer.File, dto: TeleconsultDocDto): Promise<{
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
            email: string;
        };
    }[]>;
    docFile(token: string, docId: string, res: Response): Promise<StreamableFile>;
}
