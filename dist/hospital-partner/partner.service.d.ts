import { OnboardingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from './notification.service';
import { AccreditationService } from './accreditation.service';
import { EnrichmentService } from '../admin/enrichment.service';
import { ScrapeService } from '../admin/scrape.service';
import { ApplyDto, ContactDto, VerifyOtpDto, AccreditationDto, UploadDocDto, AgreementDto, DoctorDto, PricingDto, ServicesDto, SetAvailabilityDto, ReviewDocDto } from './dto/partner.dto';
export declare class PartnerService {
    private prisma;
    private notify;
    private accred;
    private enrich;
    private scrape;
    constructor(prisma: PrismaService, notify: NotificationService, accred: AccreditationService, enrich: EnrichmentService, scrape: ScrapeService);
    apply(dto: ApplyDto): Promise<{
        id: string;
        sessionToken: string;
        status: import(".prisma/client").$Enums.OnboardingStatus;
    }>;
    private bySession;
    getApplication(id: string, sessionToken: string): Promise<any>;
    private publicView;
    setContact(id: string, sessionToken: string, dto: ContactDto): Promise<{
        sent: boolean;
    }>;
    resendOtps(id: string, sessionToken: string): Promise<{
        sent: boolean;
    }>;
    verifyOtp(id: string, sessionToken: string, dto: VerifyOtpDto): Promise<{
        emailVerified: boolean;
        whatsappVerified: boolean;
        bothVerified: boolean;
    }>;
    private assertContactVerified;
    addAccreditation(id: string, sessionToken: string, dto: AccreditationDto): Promise<any>;
    lookupAccreditation(id: string, sessionToken: string): Promise<any>;
    markNotAccredited(id: string, sessionToken: string): Promise<any>;
    uploadDoc(id: string, sessionToken: string, file: Express.Multer.File, dto: UploadDocDto): Promise<any>;
    removeDoc(id: string, sessionToken: string, docId: string): Promise<any>;
    private docsSatisfied;
    signAgreement(id: string, sessionToken: string, dto: AgreementDto, ip?: string): Promise<any>;
    provision(id: string, sessionToken: string): Promise<{
        provisioned: boolean;
        loginId: string;
    }>;
    private mine;
    dashboard(userId: string): Promise<any>;
    addDoctor(userId: string, dto: DoctorDto): Promise<any>;
    private doctorOfMine;
    updateDoctor(userId: string, doctorId: string, dto: DoctorDto): Promise<any>;
    setDoctorLeave(userId: string, doctorId: string, onLeave: boolean): Promise<any>;
    removeDoctor(userId: string, doctorId: string): Promise<any>;
    sendAvailabilityLink(userId: string, doctorId: string): Promise<{
        sent: boolean;
    }>;
    setPricing(userId: string, dto: PricingDto): Promise<any>;
    setServices(userId: string, dto: ServicesDto): Promise<any>;
    generateNarrative(userId: string): Promise<any>;
    dashboardReviews(userId: string, opts?: {
        rating?: number;
        region?: string;
        verified?: boolean;
    }): Promise<{
        reviews: {
            id: string;
            reviewerName: string;
            nationality: string;
            procedure: string;
            rating: number;
            reviewDate: Date;
            text: string;
            textEn: string;
            region: string;
            verified: boolean;
        }[];
        stats: {
            total: number;
            avgRating: number;
            regions: string[];
        };
    }>;
    goLive(userId: string): Promise<any>;
    private finalizeHospital;
    private mapExistingReviews;
    private refreshRating;
    setPassword(userId: string, password: string): Promise<{
        updated: boolean;
    }>;
    availabilityByToken(token: string): Promise<{
        id: string;
        name: string;
        application: {
            legalName: string;
        };
        specialty: string;
        teleconsultEnabled: boolean;
        timezone: string;
        windows: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            doctorId: string;
            weekday: number;
            start: string;
            end: string;
            recurring: boolean;
            source: import(".prisma/client").$Enums.AvailabilitySource;
        }[];
        teleconsults: {
            id: string;
            scheduledAt: Date;
            patient: {
                name: string;
            };
        }[];
    }>;
    setAvailability(token: string, dto: SetAvailabilityDto): Promise<{
        id: string;
        name: string;
        application: {
            legalName: string;
        };
        specialty: string;
        teleconsultEnabled: boolean;
        timezone: string;
        windows: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            doctorId: string;
            weekday: number;
            start: string;
            end: string;
            recurring: boolean;
            source: import(".prisma/client").$Enums.AvailabilitySource;
        }[];
        teleconsults: {
            id: string;
            scheduledAt: Date;
            patient: {
                name: string;
            };
        }[];
    }>;
    listApplications(status?: OnboardingStatus): import(".prisma/client").Prisma.PrismaPromise<({
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
    getForAdmin(id: string): Promise<any>;
    reviewDoc(docId: string, dto: ReviewDocDto, adminId: string): Promise<{
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
    setApplicationStatus(id: string, status: OnboardingStatus): Promise<any>;
    setPriority(id: string, priority: boolean): Promise<any>;
    docFile(docId: string, userId: string, isAdmin: boolean): Promise<{
        path: string;
        name: string;
    }>;
}
