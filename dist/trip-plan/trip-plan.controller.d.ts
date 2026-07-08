import { TripPlanService } from './trip-plan.service';
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
        destination: string;
        origin: string;
        airline: string;
        price: number;
        duration: string;
        stops: string | null;
        bookingUrl: string | null;
    }[]>;
    getInsurance(): Promise<{
        name: string;
        id: string;
        bookingUrl: string | null;
        tagline: string | null;
        pricePerDay: number;
        coverage: string;
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
        passport?: string;
        visaHelp?: string;
        accommodation?: string;
        notes?: string;
    }): Promise<any>;
}
