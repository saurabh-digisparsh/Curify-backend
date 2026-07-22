import { TripPlanService } from './trip-plan.service';
import { ServiceStatus } from './trip-services';
export declare class TripPlanController {
    private service;
    constructor(service: TripPlanService);
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
        label: string | null;
        price: number;
        destination: string;
        origin: string;
        airline: string;
        duration: string;
        stops: string | null;
        bookingUrl: string | null;
    }[]>;
    getInsurance(): Promise<{
        id: string;
        name: string;
        coverage: string;
        bookingUrl: string | null;
        tagline: string | null;
        pricePerDay: number;
        features: import("@prisma/client/runtime/library").JsonValue;
        recommended: boolean;
    }[]>;
    generate(body: {
        hospitalId: string;
        diagnosis: string;
        treatment: string;
        country: string;
        departureCity?: string;
        travelDate?: string;
        travelers?: number;
        stayNights?: number;
        accommodation?: string;
        treatmentCost?: number;
        treatmentCurrency?: string;
    }): Promise<any>;
    listServices(hospitalId: string, req: any): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        type: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        status: string;
        hospitalId: string;
        provider: string;
        meta: import("@prisma/client/runtime/library").JsonValue | null;
        proofPath: string | null;
    }[]>;
    setStatus(type: string, body: {
        hospitalId: string;
        status: ServiceStatus;
    }, req: any): import(".prisma/client").Prisma.Prisma__TripServiceStepClient<{
        id: string;
        type: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        status: string;
        hospitalId: string;
        provider: string;
        meta: import("@prisma/client/runtime/library").JsonValue | null;
        proofPath: string | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    uploadProof(type: string, file: Express.Multer.File, body: {
        hospitalId: string;
        visaNumber?: string;
        visaExpiry?: string;
        travelDate?: string;
    }, req: any): Promise<{
        id: string;
        type: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        status: string;
        hospitalId: string;
        provider: string;
        meta: import("@prisma/client/runtime/library").JsonValue | null;
        proofPath: string | null;
    }>;
}
