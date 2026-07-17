import { BookingsService } from './bookings.service';
export declare class BookingsController {
    private service;
    constructor(service: BookingsService);
    create(body: {
        reportId?: string;
        hospitalId: string;
        plan?: string;
        totalAmount?: number;
        currency?: string;
        paymentRef?: string;
        paymentMethod?: string;
        downPayment?: number;
        installments?: number;
    }, req: any): Promise<{
        bookingId: string;
        paymentRef: string;
        status: import(".prisma/client").$Enums.BookingStatus;
    }>;
    findOne(id: string, req: any): Promise<{
        hospital: {
            specialty: string | null;
            id: string;
            name: string;
            priority: boolean;
            country: string;
            city: string;
            createdAt: Date;
            fairnessScore: number | null;
            flag: string | null;
            imageUrl: string | null;
            jciAccredited: boolean;
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
            procedures: import("@prisma/client/runtime/library").JsonValue | null;
            packages: import("@prisma/client/runtime/library").JsonValue | null;
            intlOfficePhone: string | null;
            intlOfficeEmail: string | null;
            website: string | null;
            address: string | null;
            latitude: number | null;
            longitude: number | null;
            googleMapsUri: string | null;
            ownerUserId: string | null;
            approvalStatus: import(".prisma/client").$Enums.ApprovalStatus | null;
            nabhAccredited: boolean;
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
        travelDate: Date | null;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        status: import(".prisma/client").$Enums.BookingStatus;
        hospitalId: string;
        reportId: string | null;
        plan: import(".prisma/client").$Enums.Plan;
        totalAmount: number | null;
        currency: string;
        paymentRef: string | null;
        paymentMethod: string;
        downPayment: number | null;
        installments: number | null;
        surgeryDate: Date | null;
        notes: string | null;
    }>;
}
