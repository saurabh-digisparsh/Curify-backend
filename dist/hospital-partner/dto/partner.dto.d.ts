import { AccreditationBody, OnboardingDocType } from '@prisma/client';
export declare class BookTeleconsultDto {
    doctorId: string;
    scheduledAt: string;
    journeyId?: string;
}
export declare class QuoteDto {
    amount: number;
    currency?: string;
    note?: string;
}
export declare class TeleconsultDocDto {
    kind?: string;
}
export declare class ApplyDto {
    legalName: string;
    city: string;
    address?: string;
    registrationNo?: string;
    ownership?: string;
    website?: string;
    totalBeds?: number;
    icuBeds?: number;
    airportDistanceKm?: number;
    specialties: string[];
    insurers: string[];
    languages?: string[];
    intlFacilities?: string[];
}
export declare class ContactDto {
    name: string;
    designation?: string;
    workEmail: string;
    whatsapp: string;
}
export declare class VerifyOtpDto {
    channel: 'email' | 'whatsapp';
    code: string;
}
export declare class AccreditationDto {
    body: AccreditationBody;
    identifier?: string;
}
export declare class NotAccreditedDto {
    notAccredited: boolean;
}
export declare class UploadDocDto {
    type: OnboardingDocType;
    doctorId?: string;
}
export declare class AgreementDto {
    signatoryName: string;
    authorised: boolean;
}
export declare class SetPasswordDto {
    password: string;
}
export declare class DoctorDto {
    name: string;
    photoUrl?: string;
    qualifications?: string;
    specialty?: string;
    subspecialty?: string;
    yearsExperience?: number;
    registrationNo?: string;
    languages?: string[];
    bio?: string;
    proceduresPerformed?: number;
    email?: string;
    teleconsultEnabled?: boolean;
    timezone?: string;
}
export declare class DoctorLeaveDto {
    onLeave: boolean;
}
export declare class PricingDto {
    quotedPriceUsd?: number;
    patientsPerYear?: number;
    imageUrl?: string;
    procedures?: string[];
    specialties?: string[];
    localBenchmarkUsd?: number;
    included?: string[];
    notIncluded?: string[];
    pros?: string[];
    cons?: string[];
}
export declare class ServicesDto {
    languages?: string[];
    insurers?: string[];
    intlFacilities?: string[];
}
declare class WindowDto {
    weekday: number;
    start: string;
    end: string;
}
export declare class SetAvailabilityDto {
    windows: WindowDto[];
    timezone?: string;
}
export declare class ReviewDocDto {
    status: 'VERIFIED' | 'REJECTED';
    note?: string;
}
export {};
