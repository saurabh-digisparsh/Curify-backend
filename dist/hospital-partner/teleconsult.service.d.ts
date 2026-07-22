import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../admin/settings/settings.service';
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
    private settings;
    private readonly log;
    constructor(prisma: PrismaService, video: VideoService, notif: NotificationService, settings: SettingsService);
    private bookedMs;
    availableSlots(doctorId: string): Promise<string[]>;
    quota(userId: string, journeyId?: string): Promise<{
        used: number;
        limit: number;
        remaining: number;
        requiresPayment: boolean;
        fee: number;
        currency: string;
    }>;
    book(userId: string, dto: BookTeleconsultDto): Promise<{
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
    activatePaidConsult(teleconsultId: string, paymentId: string): Promise<boolean>;
    cancel(userId: string, id: string, reason?: string): Promise<{
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
    acceptQuote(userId: string, id: string): Promise<{
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
    mine(userId: string): import(".prisma/client").Prisma.PrismaPromise<{
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
    private assertJoinWindowOpen;
    private callDeadline;
    patientVideoToken(userId: string, id: string): Promise<{
        endsAt: string;
        provider: "jitsi";
        domain: string;
        roomName: string;
        jwt: string;
        displayName: string;
    }>;
    patientAddDoc(userId: string, id: string, file: Express.Multer.File, kind?: string): Promise<{
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
    doctorVideoToken(availabilityToken: string, id: string): Promise<{
        endsAt: string;
        provider: "jitsi";
        domain: string;
        roomName: string;
        jwt: string;
        displayName: string;
    }>;
    private doctorTcOrThrow;
    doctorConsults(token: string): Promise<{
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
    setQuote(token: string, id: string, dto: QuoteDto): Promise<{
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
    doctorCancel(token: string, id: string, reason?: string): Promise<{
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
    doctorComplete(token: string, id: string): Promise<{
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
    doctorEndCall(token: string, id: string): Promise<{
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
    doctorAddDoc(token: string, id: string, file: Express.Multer.File, kind?: string): Promise<{
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
    hospitalConsults(userId: string): Promise<{
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
