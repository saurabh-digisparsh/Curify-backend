import { OnboardingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from './notification.service';
import { AccreditationService } from './accreditation.service';
import { VideoService } from './video.service';
import { EnrichmentService } from '../admin/enrichment.service';
import { ScrapeService } from '../admin/scrape.service';
import { BulkImportService } from './bulk-import.service';
import { ApplyDto, ContactDto, VerifyOtpDto, AccreditationDto, UploadDocDto, AgreementDto, DoctorDto, PricingDto, ServicesDto, SetAvailabilityDto, ReviewDocDto } from './dto/partner.dto';
export declare class PartnerService {
    private prisma;
    private notify;
    private accred;
    private video;
    private enrich;
    private scrape;
    private bulk;
    private readonly logger;
    constructor(prisma: PrismaService, notify: NotificationService, accred: AccreditationService, video: VideoService, enrich: EnrichmentService, scrape: ScrapeService, bulk: BulkImportService);
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
    private enrichApplication;
    private mine;
    dashboard(userId: string): Promise<any>;
    addDoctor(userId: string, dto: DoctorDto): Promise<any>;
    importDoctors(userId: string, file: Express.Multer.File): Promise<{
        imported: number;
        errors: import("./bulk-import.service").ImportError[];
        data: any;
    }>;
    importPackages(userId: string, file: Express.Multer.File): Promise<{
        imported: number;
        errors: import("./bulk-import.service").ImportError[];
        data: any;
    }>;
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
            text: string;
            procedure: string;
            rating: number;
            reviewerName: string;
            nationality: string;
            reviewDate: Date;
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
        videoEnabled: boolean;
        specialty: string;
        timezone: string;
        id: string;
        name: string;
        teleconsults: {
            id: string;
            patient: {
                name: string;
            };
            scheduledAt: Date;
        }[];
        teleconsultEnabled: boolean;
        application: {
            legalName: string;
        };
        windows: {
            id: string;
            end: string;
            createdAt: Date;
            updatedAt: Date;
            source: import(".prisma/client").$Enums.AvailabilitySource;
            doctorId: string;
            weekday: number;
            start: string;
            recurring: boolean;
        }[];
    }>;
    setAvailability(token: string, dto: SetAvailabilityDto): Promise<{
        videoEnabled: boolean;
        specialty: string;
        timezone: string;
        id: string;
        name: string;
        teleconsults: {
            id: string;
            patient: {
                name: string;
            };
            scheduledAt: Date;
        }[];
        teleconsultEnabled: boolean;
        application: {
            legalName: string;
        };
        windows: {
            id: string;
            end: string;
            createdAt: Date;
            updatedAt: Date;
            source: import(".prisma/client").$Enums.AvailabilitySource;
            doctorId: string;
            weekday: number;
            start: string;
            recurring: boolean;
        }[];
    }>;
    listApplications(status?: OnboardingStatus): Promise<{
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
    getForAdmin(id: string): Promise<any>;
    reviewDoc(docId: string, dto: ReviewDocDto, adminId: string): Promise<{
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
    adminResendOtp(id: string): Promise<any>;
    adminResendCredentials(id: string): Promise<any>;
    setApplicationStatus(id: string, status: OnboardingStatus): Promise<any>;
    setPriority(id: string, priority: boolean): Promise<any>;
    docFile(docId: string, userId: string, isAdmin: boolean): Promise<{
        path: string;
        name: string;
    }>;
}
