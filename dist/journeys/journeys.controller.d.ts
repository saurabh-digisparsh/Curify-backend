import { JourneysService } from './journeys.service';
export declare class JourneysController {
    private service;
    constructor(service: JourneysService);
    list(req: any, page?: string, pageSize?: string): Promise<{
        id: string;
        userId: string;
        title: string | null;
        status: string;
        treatment: string | null;
        city: string | null;
        urgency: string | null;
        homeCountry: string | null;
        description: string | null;
        step: string;
        reportId: string | null;
        analysis: import("@prisma/client/runtime/library").JsonValue | null;
        stayOrGo: import("@prisma/client/runtime/library").JsonValue | null;
        hospitalId: string | null;
        tripPlan: import("@prisma/client/runtime/library").JsonValue | null;
        hospitalChat: import("@prisma/client/runtime/library").JsonValue | null;
        createdAt: Date;
        updatedAt: Date;
    }[] | {
        journeys: {
            id: string;
            userId: string;
            title: string | null;
            status: string;
            treatment: string | null;
            city: string | null;
            urgency: string | null;
            homeCountry: string | null;
            description: string | null;
            step: string;
            reportId: string | null;
            analysis: import("@prisma/client/runtime/library").JsonValue | null;
            stayOrGo: import("@prisma/client/runtime/library").JsonValue | null;
            hospitalId: string | null;
            tripPlan: import("@prisma/client/runtime/library").JsonValue | null;
            hospitalChat: import("@prisma/client/runtime/library").JsonValue | null;
            createdAt: Date;
            updatedAt: Date;
        }[];
        total: number;
        page: number;
        pageCount: number;
    }>;
    get(req: any, id: string): Promise<{
        id: string;
        userId: string;
        title: string | null;
        status: string;
        treatment: string | null;
        city: string | null;
        urgency: string | null;
        homeCountry: string | null;
        description: string | null;
        step: string;
        reportId: string | null;
        analysis: import("@prisma/client/runtime/library").JsonValue | null;
        stayOrGo: import("@prisma/client/runtime/library").JsonValue | null;
        hospitalId: string | null;
        tripPlan: import("@prisma/client/runtime/library").JsonValue | null;
        hospitalChat: import("@prisma/client/runtime/library").JsonValue | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    create(req: any, body: any): import(".prisma/client").Prisma.Prisma__JourneyClient<{
        id: string;
        userId: string;
        title: string | null;
        status: string;
        treatment: string | null;
        city: string | null;
        urgency: string | null;
        homeCountry: string | null;
        description: string | null;
        step: string;
        reportId: string | null;
        analysis: import("@prisma/client/runtime/library").JsonValue | null;
        stayOrGo: import("@prisma/client/runtime/library").JsonValue | null;
        hospitalId: string | null;
        tripPlan: import("@prisma/client/runtime/library").JsonValue | null;
        hospitalChat: import("@prisma/client/runtime/library").JsonValue | null;
        createdAt: Date;
        updatedAt: Date;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    update(req: any, id: string, body: any): Promise<{
        id: string;
        userId: string;
        title: string | null;
        status: string;
        treatment: string | null;
        city: string | null;
        urgency: string | null;
        homeCountry: string | null;
        description: string | null;
        step: string;
        reportId: string | null;
        analysis: import("@prisma/client/runtime/library").JsonValue | null;
        stayOrGo: import("@prisma/client/runtime/library").JsonValue | null;
        hospitalId: string | null;
        tripPlan: import("@prisma/client/runtime/library").JsonValue | null;
        hospitalChat: import("@prisma/client/runtime/library").JsonValue | null;
        createdAt: Date;
        updatedAt: Date;
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
