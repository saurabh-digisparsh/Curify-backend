import { JourneysService } from './journeys.service';
export declare class JourneysController {
    private service;
    constructor(service: JourneysService);
    list(req: any, page?: string, pageSize?: string): Promise<{
        treatment: string | null;
        id: string;
        travelDate: Date | null;
        city: string | null;
        urgency: string | null;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        userId: string;
        status: string;
        title: string | null;
        hospitalId: string | null;
        reportId: string | null;
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
            status: string;
            title: string | null;
            hospitalId: string | null;
            reportId: string | null;
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
    get(req: any, id: string): Promise<{
        treatment: string | null;
        id: string;
        travelDate: Date | null;
        city: string | null;
        urgency: string | null;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        userId: string;
        status: string;
        title: string | null;
        hospitalId: string | null;
        reportId: string | null;
        homeCountry: string | null;
        step: string;
        analysis: import("@prisma/client/runtime/library").JsonValue | null;
        stayOrGo: import("@prisma/client/runtime/library").JsonValue | null;
        tripPlan: import("@prisma/client/runtime/library").JsonValue | null;
        urgent: boolean;
        hospitalChat: import("@prisma/client/runtime/library").JsonValue | null;
    }>;
    create(req: any, body: any): import(".prisma/client").Prisma.Prisma__JourneyClient<{
        treatment: string | null;
        id: string;
        travelDate: Date | null;
        city: string | null;
        urgency: string | null;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        userId: string;
        status: string;
        title: string | null;
        hospitalId: string | null;
        reportId: string | null;
        homeCountry: string | null;
        step: string;
        analysis: import("@prisma/client/runtime/library").JsonValue | null;
        stayOrGo: import("@prisma/client/runtime/library").JsonValue | null;
        tripPlan: import("@prisma/client/runtime/library").JsonValue | null;
        urgent: boolean;
        hospitalChat: import("@prisma/client/runtime/library").JsonValue | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    update(req: any, id: string, body: any): Promise<{
        treatment: string | null;
        id: string;
        travelDate: Date | null;
        city: string | null;
        urgency: string | null;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        userId: string;
        status: string;
        title: string | null;
        hospitalId: string | null;
        reportId: string | null;
        homeCountry: string | null;
        step: string;
        analysis: import("@prisma/client/runtime/library").JsonValue | null;
        stayOrGo: import("@prisma/client/runtime/library").JsonValue | null;
        tripPlan: import("@prisma/client/runtime/library").JsonValue | null;
        urgent: boolean;
        hospitalChat: import("@prisma/client/runtime/library").JsonValue | null;
    }>;
    remove(req: any, id: string): Promise<{
        ok: boolean;
    }>;
    getChat(req: any, id: string): Promise<{
        messages: import("./journeys.service").ChatMsg[];
        hospitalId: string;
    }>;
    postChat(req: any, id: string, body: {
        body?: string;
        kind?: any;
        reportId?: string;
    }): Promise<{
        messages: import("./journeys.service").ChatMsg[];
    }>;
    analyzeChat(req: any, id: string): Promise<{
        summary: any;
        agreedQuoteUsd: any;
        inclusions: any;
        tripPlan: any;
    }>;
}
