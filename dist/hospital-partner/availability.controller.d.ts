import { StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { PartnerService } from './partner.service';
import { TeleconsultService } from './teleconsult.service';
import { SetAvailabilityDto, QuoteDto, TeleconsultDocDto, CancelTeleconsultDto } from './dto/partner.dto';
export declare class AvailabilityController {
    private readonly svc;
    private readonly tele;
    constructor(svc: PartnerService, tele: TeleconsultService);
    get(token: string): Promise<{
        videoEnabled: boolean;
        specialty: string;
        timezone: string;
        id: string;
        name: string;
        teleconsults: {
            id: string;
            scheduledAt: Date;
            patient: {
                name: string;
            };
        }[];
        teleconsultEnabled: boolean;
        application: {
            legalName: string;
        };
        windows: {
            id: string;
            end: string;
            createdAt: Date;
            updatedAt: Date;
            source: import(".prisma/client").$Enums.AvailabilitySource;
            doctorId: string;
            weekday: number;
            start: string;
            recurring: boolean;
        }[];
    }>;
    set(token: string, dto: SetAvailabilityDto): Promise<{
        videoEnabled: boolean;
        specialty: string;
        timezone: string;
        id: string;
        name: string;
        teleconsults: {
            id: string;
            scheduledAt: Date;
            patient: {
                name: string;
            };
        }[];
        teleconsultEnabled: boolean;
        application: {
            legalName: string;
        };
        windows: {
            id: string;
            end: string;
            createdAt: Date;
            updatedAt: Date;
            source: import(".prisma/client").$Enums.AvailabilitySource;
            doctorId: string;
            weekday: number;
            start: string;
            recurring: boolean;
        }[];
    }>;
    consults(token: string): Promise<{
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
            email: string;
        };
    }[]>;
    video(token: string, teleconsultId: string): Promise<{
        endsAt: string;
        provider: "jitsi";
        domain: string;
        roomName: string;
        jwt: string;
        displayName: string;
    }>;
    quote(token: string, id: string, dto: QuoteDto): Promise<{
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
            email: string;
        };
    }[]>;
    cancel(token: string, id: string, dto: CancelTeleconsultDto): Promise<{
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
            email: string;
        };
    }[]>;
    complete(token: string, id: string): Promise<{
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
            email: string;
        };
    }[]>;
    endCall(token: string, id: string): Promise<{
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
            email: string;
        };
    }[]>;
    addDoc(token: string, id: string, file: Express.Multer.File, dto: TeleconsultDocDto): Promise<{
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
            email: string;
        };
    }[]>;
    docFile(token: string, docId: string, res: Response): Promise<StreamableFile>;
}
