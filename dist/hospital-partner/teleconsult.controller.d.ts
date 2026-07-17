import { StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { TeleconsultService } from './teleconsult.service';
import { BookTeleconsultDto, TeleconsultDocDto } from './dto/partner.dto';
export declare class TeleconsultController {
    private readonly svc;
    constructor(svc: TeleconsultService);
    mine(req: any): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        scheduledAt: Date;
        status: import(".prisma/client").$Enums.TeleconsultStatus;
        startedAt: Date;
        endedAt: Date;
        quoteAmount: number;
        quoteCurrency: string;
        quoteNote: string;
        quotedAt: Date;
        quoteAcceptedAt: Date;
        doctor: {
            id: string;
            name: string;
            specialty: string;
            application: {
                legalName: string;
            };
        };
        documents: {
            id: string;
            createdAt: Date;
            sender: import(".prisma/client").$Enums.TeleconsultDocSender;
            kind: string;
            originalName: string;
        }[];
        journeyId: string;
    }[]>;
    slots(doctorId: string): Promise<string[]>;
    book(req: any, dto: BookTeleconsultDto): Promise<{
        id: string;
        scheduledAt: Date;
        status: import(".prisma/client").$Enums.TeleconsultStatus;
        startedAt: Date;
        endedAt: Date;
        quoteAmount: number;
        quoteCurrency: string;
        quoteNote: string;
        quotedAt: Date;
        quoteAcceptedAt: Date;
        doctor: {
            id: string;
            name: string;
            specialty: string;
            application: {
                legalName: string;
            };
        };
        documents: {
            id: string;
            createdAt: Date;
            sender: import(".prisma/client").$Enums.TeleconsultDocSender;
            kind: string;
            originalName: string;
        }[];
        journeyId: string;
    }>;
    video(req: any, id: string): Promise<import("./video.service").VideoToken>;
    cancel(req: any, id: string): Promise<{
        id: string;
        scheduledAt: Date;
        status: import(".prisma/client").$Enums.TeleconsultStatus;
        startedAt: Date;
        endedAt: Date;
        quoteAmount: number;
        quoteCurrency: string;
        quoteNote: string;
        quotedAt: Date;
        quoteAcceptedAt: Date;
        doctor: {
            id: string;
            name: string;
            specialty: string;
            application: {
                legalName: string;
            };
        };
        documents: {
            id: string;
            createdAt: Date;
            sender: import(".prisma/client").$Enums.TeleconsultDocSender;
            kind: string;
            originalName: string;
        }[];
        journeyId: string;
    }[]>;
    acceptQuote(req: any, id: string): Promise<{
        id: string;
        scheduledAt: Date;
        status: import(".prisma/client").$Enums.TeleconsultStatus;
        startedAt: Date;
        endedAt: Date;
        quoteAmount: number;
        quoteCurrency: string;
        quoteNote: string;
        quotedAt: Date;
        quoteAcceptedAt: Date;
        doctor: {
            id: string;
            name: string;
            specialty: string;
            application: {
                legalName: string;
            };
        };
        documents: {
            id: string;
            createdAt: Date;
            sender: import(".prisma/client").$Enums.TeleconsultDocSender;
            kind: string;
            originalName: string;
        }[];
        journeyId: string;
    }[]>;
    addDoc(req: any, id: string, file: Express.Multer.File, dto: TeleconsultDocDto): Promise<{
        id: string;
        scheduledAt: Date;
        status: import(".prisma/client").$Enums.TeleconsultStatus;
        startedAt: Date;
        endedAt: Date;
        quoteAmount: number;
        quoteCurrency: string;
        quoteNote: string;
        quotedAt: Date;
        quoteAcceptedAt: Date;
        doctor: {
            id: string;
            name: string;
            specialty: string;
            application: {
                legalName: string;
            };
        };
        documents: {
            id: string;
            createdAt: Date;
            sender: import(".prisma/client").$Enums.TeleconsultDocSender;
            kind: string;
            originalName: string;
        }[];
        journeyId: string;
    }[]>;
    docFile(req: any, docId: string, res: Response): Promise<StreamableFile>;
}
