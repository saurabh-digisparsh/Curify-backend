import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { ServiceType, ServiceStatus } from './trip-services';
export declare const FX_TO_USD: Record<string, number>;
export declare function quoteToUsd(amount: number, currency?: string): number;
export declare class TripPlanService {
    private prisma;
    private ai;
    constructor(prisma: PrismaService, ai: AiService);
    getTemplate(procedure: string, destination: string): Promise<{
        id: string;
        procedure: string;
        destination: string;
        timeline: import("@prisma/client/runtime/library").JsonValue;
        costs: import("@prisma/client/runtime/library").JsonValue;
        totalEstimate: string;
        travelTips: import("@prisma/client/runtime/library").JsonValue;
        insuranceAlert: string | null;
    }>;
    getFlights(origin: string, destination: string): Promise<{
        id: string;
        destination: string;
        origin: string;
        airline: string;
        price: number;
        duration: string;
        stops: string | null;
        label: string | null;
        bookingUrl: string | null;
    }[]>;
    getInsurance(): Promise<{
        id: string;
        name: string;
        bookingUrl: string | null;
        tagline: string | null;
        pricePerDay: number;
        coverage: string;
        features: import("@prisma/client/runtime/library").JsonValue;
        recommended: boolean;
    }[]>;
    private applyTreatmentCost;
    generate(params: {
        hospitalId: string;
        diagnosis: string;
        treatment: string;
        country: string;
        departureCity?: string;
        travelDate?: string;
        travelers?: number;
        stayNights?: number;
        passport?: string;
        visaHelp?: string;
        accommodation?: string;
        notes?: string;
        treatmentCost?: number;
        treatmentCurrency?: string;
    }): Promise<any>;
    listServices(userId: string, hospitalId: string): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        createdAt: Date;
        userId: string;
        hospitalId: string;
        type: string;
        provider: string;
        status: string;
        proofPath: string | null;
        meta: import("@prisma/client/runtime/library").JsonValue | null;
        updatedAt: Date;
    }[]>;
    setServiceStatus(userId: string, hospitalId: string, type: ServiceType, status: ServiceStatus): import(".prisma/client").Prisma.Prisma__TripServiceStepClient<{
        id: string;
        createdAt: Date;
        userId: string;
        hospitalId: string;
        type: string;
        provider: string;
        status: string;
        proofPath: string | null;
        meta: import("@prisma/client/runtime/library").JsonValue | null;
        updatedAt: Date;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    attachProof(userId: string, hospitalId: string, type: ServiceType, file: Express.Multer.File, fields: {
        visaNumber?: string;
        visaExpiry?: string;
        travelDate?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        userId: string;
        hospitalId: string;
        type: string;
        provider: string;
        status: string;
        proofPath: string | null;
        meta: import("@prisma/client/runtime/library").JsonValue | null;
        updatedAt: Date;
    }>;
    private upsertStep;
    private saveProof;
}
