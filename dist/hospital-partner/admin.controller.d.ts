import { OnboardingStatus } from '@prisma/client';
import { PartnerService } from './partner.service';
import { ReviewDocDto } from './dto/partner.dto';
export declare class PartnerAdminController {
    private readonly svc;
    constructor(svc: PartnerService);
    list(status?: OnboardingStatus): Promise<{
        applications: ({
            contact: {
                name: string;
                emailVerifiedAt: Date;
                workEmail: string;
                whatsapp: string;
            };
            accreditations: {
                status: import(".prisma/client").$Enums.DocStatus;
                body: import(".prisma/client").$Enums.AccreditationBody;
            }[];
            agreement: {
                signatoryName: string;
                signedAt: Date;
            };
            _count: {
                doctors: number;
                documents: number;
            };
        } & {
            id: string;
            priority: boolean;
            city: string;
            createdAt: Date;
            updatedAt: Date;
            status: import(".prisma/client").$Enums.OnboardingStatus;
            imageUrl: string | null;
            quotedPriceUsd: number | null;
            localBenchmarkUsd: number | null;
            included: string[];
            notIncluded: string[];
            pros: import("@prisma/client/runtime/library").JsonValue | null;
            cons: import("@prisma/client/runtime/library").JsonValue | null;
            patientsPerYear: number | null;
            procedures: string[];
            packages: import("@prisma/client/runtime/library").JsonValue | null;
            website: string | null;
            address: string | null;
            ownerUserId: string | null;
            languages: string[];
            legalName: string;
            registrationNo: string | null;
            ownership: string | null;
            totalBeds: number | null;
            icuBeds: number | null;
            airportDistanceKm: number | null;
            specialties: string[];
            insurers: string[];
            intlFacilities: string[];
            notAccredited: boolean;
            sessionToken: string | null;
            publishedHospitalId: string | null;
        })[];
        counts: Record<string, number>;
    }>;
    get(id: string): Promise<any>;
    reviewDoc(docId: string, dto: ReviewDocDto, req: any): Promise<{
        id: string;
        type: import(".prisma/client").$Enums.OnboardingDocType;
        createdAt: Date;
        updatedAt: Date;
        status: import(".prisma/client").$Enums.DocStatus;
        applicationId: string;
        note: string | null;
        reviewedBy: string | null;
        reviewedAt: Date | null;
        doctorId: string | null;
        autoClassifiedType: import(".prisma/client").$Enums.OnboardingDocType | null;
        fileUrl: string;
        originalName: string | null;
    }>;
    setStatus(id: string, body: {
        status: OnboardingStatus;
    }): Promise<any>;
    resendOtp(id: string): Promise<any>;
    resendCredentials(id: string): Promise<any>;
    setPriority(id: string, body: {
        priority: boolean;
    }): Promise<any>;
}
