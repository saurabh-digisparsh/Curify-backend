import { StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { TeleconsultService } from './teleconsult.service';
import { BookTeleconsultDto, TeleconsultDocDto, CancelTeleconsultDto } from './dto/partner.dto';
export declare class TeleconsultController {
    private readonly svc;
    constructor(svc: TeleconsultService);
    mine(req: any): import(".prisma/client").Prisma.PrismaPromise<{
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
        journeyId: string;
        doctor: {
            specialty: string;
            id: string;
            name: string;
            application: {
                legalName: string;
            };
        };
        endedAt: Date;
        quoteAmount: number;
        quoteCurrency: string;
        quoteNote: string;
        quotedAt: Date;
        quoteAcceptedAt: Date;
        holdExpiresAt: Date;
        cancelledBy: string;
        cancelReason: string;
    }[]>;
    quota(req: any, journeyId?: string): Promise<{
        used: number;
        limit: number;
        remaining: number;
        requiresPayment: boolean;
        fee: number;
        currency: string;
    }>;
    slots(doctorId: string): Promise<string[]>;
    book(req: any, dto: BookTeleconsultDto): Promise<{
        requiresPayment: boolean;
        fee: number;
        currency: string;
        holdMinutes: number;
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
        journeyId: string;
        doctor: {
            specialty: string;
            id: string;
            name: string;
            application: {
                legalName: string;
            };
        };
        endedAt: Date;
        quoteAmount: number;
        quoteCurrency: string;
        quoteNote: string;
        quotedAt: Date;
        quoteAcceptedAt: Date;
        holdExpiresAt: Date;
        cancelledBy: string;
        cancelReason: string;
    } | {
        requiresPayment: boolean;
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
        journeyId: string;
        doctor: {
            specialty: string;
            id: string;
            name: string;
            application: {
                legalName: string;
            };
        };
        endedAt: Date;
        quoteAmount: number;
        quoteCurrency: string;
        quoteNote: string;
        quotedAt: Date;
        quoteAcceptedAt: Date;
        holdExpiresAt: Date;
        cancelledBy: string;
        cancelReason: string;
    }>;
    video(req: any, id: string): Promise<{
        endsAt: string;
        provider: "jitsi";
        domain: string;
        roomName: string;
        jwt: string;
        displayName: string;
    }>;
    cancel(req: any, id: string, dto: CancelTeleconsultDto): Promise<{
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
        journeyId: string;
        doctor: {
            specialty: string;
            id: string;
            name: string;
            application: {
                legalName: string;
            };
        };
        endedAt: Date;
        quoteAmount: number;
        quoteCurrency: string;
        quoteNote: string;
        quotedAt: Date;
        quoteAcceptedAt: Date;
        holdExpiresAt: Date;
        cancelledBy: string;
        cancelReason: string;
    }[]>;
    acceptQuote(req: any, id: string): Promise<{
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
        journeyId: string;
        doctor: {
            specialty: string;
            id: string;
            name: string;
            application: {
                legalName: string;
            };
        };
        endedAt: Date;
        quoteAmount: number;
        quoteCurrency: string;
        quoteNote: string;
        quotedAt: Date;
        quoteAcceptedAt: Date;
        holdExpiresAt: Date;
        cancelledBy: string;
        cancelReason: string;
    }[]>;
    addDoc(req: any, id: string, file: Express.Multer.File, dto: TeleconsultDocDto): Promise<{
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
        journeyId: string;
        doctor: {
            specialty: string;
            id: string;
            name: string;
            application: {
                legalName: string;
            };
        };
        endedAt: Date;
        quoteAmount: number;
        quoteCurrency: string;
        quoteNote: string;
        quotedAt: Date;
        quoteAcceptedAt: Date;
        holdExpiresAt: Date;
        cancelledBy: string;
        cancelReason: string;
    }[]>;
    docFile(req: any, docId: string, res: Response): Promise<StreamableFile>;
}
