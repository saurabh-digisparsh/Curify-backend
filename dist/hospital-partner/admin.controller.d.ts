import { OnboardingStatus } from '@prisma/client';
import { PartnerService } from './partner.service';
import { ReviewDocDto } from './dto/partner.dto';
export declare class PartnerAdminController {
    private readonly svc;
    constructor(svc: PartnerService);
    list(status?: OnboardingStatus): import(".prisma/client").Prisma.PrismaPromise<({
        contact: {
            name: string;
            workEmail: string;
        };
        _count: {
            documents: number;
            doctors: number;
        };
    } & {
        id: string;
        legalName: string;
        city: string;
        address: string | null;
        registrationNo: string | null;
        ownership: string | null;
        website: string | null;
        totalBeds: number | null;
        icuBeds: number | null;
        airportDistanceKm: number | null;
        specialties: string[];
        insurers: string[];
        languages: string[];
        intlFacilities: string[];
        quotedPriceUsd: number | null;
        patientsPerYear: number | null;
        imageUrl: string | null;
        procedures: string[];
        localBenchmarkUsd: number | null;
        included: string[];
        notIncluded: string[];
        pros: import("@prisma/client/runtime/library").JsonValue | null;
        cons: import("@prisma/client/runtime/library").JsonValue | null;
        status: import(".prisma/client").$Enums.OnboardingStatus;
        priority: boolean;
        notAccredited: boolean;
        sessionToken: string | null;
        createdAt: Date;
        updatedAt: Date;
        ownerUserId: string | null;
        publishedHospitalId: string | null;
    })[]>;
    get(id: string): Promise<any>;
    reviewDoc(docId: string, dto: ReviewDocDto, req: any): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.DocStatus;
        createdAt: Date;
        updatedAt: Date;
        applicationId: string;
        doctorId: string | null;
        type: import(".prisma/client").$Enums.OnboardingDocType;
        autoClassifiedType: import(".prisma/client").$Enums.OnboardingDocType | null;
        fileUrl: string;
        originalName: string | null;
        note: string | null;
        reviewedBy: string | null;
        reviewedAt: Date | null;
    }>;
    setStatus(id: string, body: {
        status: OnboardingStatus;
    }): Promise<any>;
    setPriority(id: string, body: {
        priority: boolean;
    }): Promise<any>;
}
