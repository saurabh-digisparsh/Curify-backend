import { StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { TeleconsultService } from './teleconsult.service';
import { BookTeleconsultDto, TeleconsultDocDto } from './dto/partner.dto';
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
        journeyId: string;
        scheduledAt: Date;
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
    }[]>;
    slots(doctorId: string): Promise<string[]>;
    book(req: any, dto: BookTeleconsultDto): Promise<{
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
        journeyId: string;
        scheduledAt: Date;
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
    }>;
    video(req: any, id: string): Promise<import("./video.service").VideoToken>;
    cancel(req: any, id: string): Promise<{
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
        journeyId: string;
        scheduledAt: Date;
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
        journeyId: string;
        scheduledAt: Date;
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
        journeyId: string;
        scheduledAt: Date;
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
    }[]>;
    docFile(req: any, docId: string, res: Response): Promise<StreamableFile>;
}
