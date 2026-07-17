import { PrismaService } from '../prisma/prisma.service';
import { VideoService } from './video.service';
import { NotificationService } from './notification.service';
import { BookTeleconsultDto, QuoteDto } from './dto/partner.dto';
type Win = {
    weekday: number;
    start: string;
    end: string;
};
export declare function zonedWallToUtc(y: number, m0: number, d: number, hh: number, mm: number, timeZone: string): Date;
export declare function slotStarts(start: string, end: string): Generator<[number, number]>;
export declare function computeSlots(timeZone: string, windows: Win[], bookedMs: Set<number>): string[];
export declare class TeleconsultService {
    private prisma;
    private video;
    private notif;
    constructor(prisma: PrismaService, video: VideoService, notif: NotificationService);
    private bookedMs;
    availableSlots(doctorId: string): Promise<string[]>;
    book(userId: string, dto: BookTeleconsultDto): Promise<{
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
    cancel(userId: string, id: string): Promise<{
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
    acceptQuote(userId: string, id: string): Promise<{
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
    mine(userId: string): import(".prisma/client").Prisma.PrismaPromise<{
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
    patientVideoToken(userId: string, id: string): Promise<import("./video.service").VideoToken>;
    patientAddDoc(userId: string, id: string, file: Express.Multer.File, kind?: string): Promise<{
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
    doctorVideoToken(availabilityToken: string, id: string): Promise<import("./video.service").VideoToken>;
    private doctorTcOrThrow;
    doctorConsults(token: string): Promise<{
        id: string;
        scheduledAt: Date;
        status: import(".prisma/client").$Enums.TeleconsultStatus;
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
        doctor: {
            id: string;
            name: string;
            specialty: string;
        };
        documents: {
            id: string;
            createdAt: Date;
            sender: import(".prisma/client").$Enums.TeleconsultDocSender;
            kind: string;
            originalName: string;
        }[];
    }[]>;
    setQuote(token: string, id: string, dto: QuoteDto): Promise<{
        id: string;
        scheduledAt: Date;
        status: import(".prisma/client").$Enums.TeleconsultStatus;
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
        doctor: {
            id: string;
            name: string;
            specialty: string;
        };
        documents: {
            id: string;
            createdAt: Date;
            sender: import(".prisma/client").$Enums.TeleconsultDocSender;
            kind: string;
            originalName: string;
        }[];
    }[]>;
    doctorComplete(token: string, id: string): Promise<{
        id: string;
        scheduledAt: Date;
        status: import(".prisma/client").$Enums.TeleconsultStatus;
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
        doctor: {
            id: string;
            name: string;
            specialty: string;
        };
        documents: {
            id: string;
            createdAt: Date;
            sender: import(".prisma/client").$Enums.TeleconsultDocSender;
            kind: string;
            originalName: string;
        }[];
    }[]>;
    doctorEndCall(token: string, id: string): Promise<{
        id: string;
        scheduledAt: Date;
        status: import(".prisma/client").$Enums.TeleconsultStatus;
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
        doctor: {
            id: string;
            name: string;
            specialty: string;
        };
        documents: {
            id: string;
            createdAt: Date;
            sender: import(".prisma/client").$Enums.TeleconsultDocSender;
            kind: string;
            originalName: string;
        }[];
    }[]>;
    doctorAddDoc(token: string, id: string, file: Express.Multer.File, kind?: string): Promise<{
        id: string;
        scheduledAt: Date;
        status: import(".prisma/client").$Enums.TeleconsultStatus;
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
        doctor: {
            id: string;
            name: string;
            specialty: string;
        };
        documents: {
            id: string;
            createdAt: Date;
            sender: import(".prisma/client").$Enums.TeleconsultDocSender;
            kind: string;
            originalName: string;
        }[];
    }[]>;
    hospitalConsults(userId: string): Promise<{
        consults: {
            id: string;
            scheduledAt: Date;
            status: import(".prisma/client").$Enums.TeleconsultStatus;
            startedAt: Date;
            endedAt: Date;
            quoteAmount: number;
            quoteCurrency: string;
            quoteNote: string;
            quotedAt: Date;
            patient: {
                name: string;
            };
            doctor: {
                id: string;
                name: string;
                specialty: string;
            };
            documents: {
                id: string;
                createdAt: Date;
                sender: import(".prisma/client").$Enums.TeleconsultDocSender;
                kind: string;
                originalName: string;
            }[];
        }[];
        stats: {
            total: number;
            scheduled: number;
            live: number;
            completed: number;
        };
    }>;
    private docOrThrow;
    private path;
    docFileForHospital(docId: string, userId: string): Promise<{
        path: string;
        name: string;
    }>;
    docFileForDoctor(docId: string, token: string): Promise<{
        path: string;
        name: string;
    }>;
    docFileForPatient(docId: string, userId: string): Promise<{
        path: string;
        name: string;
    }>;
}
export {};
