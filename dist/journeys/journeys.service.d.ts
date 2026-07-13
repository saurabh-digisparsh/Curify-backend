import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
declare const WRITABLE: readonly ["title", "status", "treatment", "city", "urgency", "homeCountry", "description", "travelDate", "step", "reportId", "analysis", "stayOrGo", "hospitalId", "tripPlan"];
type Writable = Partial<Record<(typeof WRITABLE)[number], any>>;
type ChatSender = 'PATIENT' | 'HOSPITAL' | 'SYSTEM';
type ChatKind = 'TEXT' | 'REPORT' | 'QUOTE_REQUEST' | 'QUOTE';
export interface ChatMsg {
    id: string;
    sender: ChatSender;
    kind: ChatKind;
    body: string;
    reportId?: string;
    amountUsd?: number;
    at: string;
}
export declare class JourneysService {
    private prisma;
    private ai;
    constructor(prisma: PrismaService, ai: AiService);
    private getMessages;
    private newMsg;
    private appendMessage;
    getChat(userId: string, id: string): Promise<{
        messages: ChatMsg[];
        hospitalId: string;
    }>;
    addPatientMessage(userId: string, id: string, dto: {
        body?: string;
        kind?: ChatKind;
        reportId?: string;
    }): Promise<{
        messages: ChatMsg[];
    }>;
    addHospitalMessage(id: string, dto: {
        body?: string;
        kind?: ChatKind;
        amountUsd?: number;
    }): Promise<{
        messages: ChatMsg[];
    }>;
    listChats(): Promise<{
        journeyId: string;
        patient: any;
        hospital: string;
        treatment: string;
        messageCount: number;
        lastMessage: string;
        lastAt: string;
        awaitingReply: boolean;
    }[]>;
    getChatForStaff(id: string): Promise<{
        messages: ChatMsg[];
        patient: any;
        treatment: string;
    }>;
    analyzeChat(userId: string, id: string): Promise<{
        summary: any;
        agreedQuoteUsd: any;
        inclusions: any;
        tripPlan: any;
    }>;
    private pick;
    list(userId: string, opts?: {
        page?: number;
        pageSize?: number;
    }): Promise<{
        treatment: string | null;
        id: string;
        travelDate: Date | null;
        city: string | null;
        urgency: string | null;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        userId: string;
        reportId: string | null;
        hospitalId: string | null;
        status: string;
        title: string | null;
        homeCountry: string | null;
        step: string;
        analysis: import("@prisma/client/runtime/library").JsonValue | null;
        stayOrGo: import("@prisma/client/runtime/library").JsonValue | null;
        tripPlan: import("@prisma/client/runtime/library").JsonValue | null;
        urgent: boolean;
        hospitalChat: import("@prisma/client/runtime/library").JsonValue | null;
    }[] | {
        journeys: {
            treatment: string | null;
            id: string;
            travelDate: Date | null;
            city: string | null;
            urgency: string | null;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            userId: string;
            reportId: string | null;
            hospitalId: string | null;
            status: string;
            title: string | null;
            homeCountry: string | null;
            step: string;
            analysis: import("@prisma/client/runtime/library").JsonValue | null;
            stayOrGo: import("@prisma/client/runtime/library").JsonValue | null;
            tripPlan: import("@prisma/client/runtime/library").JsonValue | null;
            urgent: boolean;
            hospitalChat: import("@prisma/client/runtime/library").JsonValue | null;
        }[];
        total: number;
        page: number;
        pageCount: number;
    }>;
    get(userId: string, id: string): Promise<{
        treatment: string | null;
        id: string;
        travelDate: Date | null;
        city: string | null;
        urgency: string | null;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        userId: string;
        reportId: string | null;
        hospitalId: string | null;
        status: string;
        title: string | null;
        homeCountry: string | null;
        step: string;
        analysis: import("@prisma/client/runtime/library").JsonValue | null;
        stayOrGo: import("@prisma/client/runtime/library").JsonValue | null;
        tripPlan: import("@prisma/client/runtime/library").JsonValue | null;
        urgent: boolean;
        hospitalChat: import("@prisma/client/runtime/library").JsonValue | null;
    }>;
    create(userId: string, body: Writable): import(".prisma/client").Prisma.Prisma__JourneyClient<{
        treatment: string | null;
        id: string;
        travelDate: Date | null;
        city: string | null;
        urgency: string | null;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        userId: string;
        reportId: string | null;
        hospitalId: string | null;
        status: string;
        title: string | null;
        homeCountry: string | null;
        step: string;
        analysis: import("@prisma/client/runtime/library").JsonValue | null;
        stayOrGo: import("@prisma/client/runtime/library").JsonValue | null;
        tripPlan: import("@prisma/client/runtime/library").JsonValue | null;
        urgent: boolean;
        hospitalChat: import("@prisma/client/runtime/library").JsonValue | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    update(userId: string, id: string, body: Writable): Promise<{
        treatment: string | null;
        id: string;
        travelDate: Date | null;
        city: string | null;
        urgency: string | null;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        userId: string;
        reportId: string | null;
        hospitalId: string | null;
        status: string;
        title: string | null;
        homeCountry: string | null;
        step: string;
        analysis: import("@prisma/client/runtime/library").JsonValue | null;
        stayOrGo: import("@prisma/client/runtime/library").JsonValue | null;
        tripPlan: import("@prisma/client/runtime/library").JsonValue | null;
        urgent: boolean;
        hospitalChat: import("@prisma/client/runtime/library").JsonValue | null;
    }>;
    publicTracking(id: string): Promise<{
        treatment: string;
        procedure: any;
        homeCountry: string;
        departureCity: any;
        travelDate: any;
        hospitalName: string;
        hospitalCity: any;
        hospitalPhone: string;
        hospitalEmail: string;
        step: string;
        status: string;
    }>;
    remove(userId: string, id: string): Promise<{
        ok: boolean;
    }>;
}
export {};
