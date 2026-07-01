import { BookingsService } from './bookings.service';
export declare class BookingsController {
    private service;
    constructor(service: BookingsService);
    create(body: {
        userId?: string;
        reportId?: string;
        hospitalId: string;
        plan?: string;
        totalAmount?: number;
        currency?: string;
        paymentRef?: string;
    }): Promise<{
        bookingId: string;
        paymentRef: string;
        status: import(".prisma/client").$Enums.BookingStatus;
    }>;
    findOne(id: string): Promise<{
        hospital: {
            id: string;
            name: string;
            country: string;
            createdAt: Date;
            city: string;
            flag: string | null;
            imageUrl: string | null;
            jciAccredited: boolean;
            fairnessScore: number | null;
            overallRating: number | null;
            quotedPriceUsd: number | null;
            localPriceUsd: number | null;
            localBenchmarkUsd: number | null;
            included: import("@prisma/client/runtime/library").JsonValue | null;
            notIncluded: import("@prisma/client/runtime/library").JsonValue | null;
            pros: import("@prisma/client/runtime/library").JsonValue | null;
            cons: import("@prisma/client/runtime/library").JsonValue | null;
            mysteryShopperScore: number | null;
            patientsPerYear: number | null;
            internationalPercent: string | null;
            surgeonId: string | null;
            specialty: string | null;
            procedures: import("@prisma/client/runtime/library").JsonValue | null;
            intlOfficePhone: string | null;
            intlOfficeEmail: string | null;
            website: string | null;
            address: string | null;
            latitude: number | null;
            longitude: number | null;
            googleMapsUri: string | null;
        };
        statusUpdates: {
            id: string;
            createdAt: Date;
            status: string;
            bookingId: string;
            message: string;
            icon: string;
            postedBy: string | null;
        }[];
        milestones: {
            id: string;
            label: string;
            bookingId: string;
            sequence: number;
            done: boolean;
            active: boolean;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        reportId: string | null;
        hospitalId: string;
        plan: import(".prisma/client").$Enums.Plan;
        status: import(".prisma/client").$Enums.BookingStatus;
        totalAmount: number | null;
        currency: string;
        paymentRef: string | null;
        travelDate: Date | null;
        surgeryDate: Date | null;
        notes: string | null;
    }>;
}
