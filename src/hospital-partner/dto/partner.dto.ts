import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray, IsBoolean, IsDateString, IsEmail, IsEnum, IsInt, IsNotEmpty, IsNumber,
  IsOptional, IsString, Matches, MaxLength, Min, MinLength,
} from 'class-validator';
import { AccreditationBody, OnboardingDocType } from '@prisma/client';

// Patient books a video teleconsult with an onboarding doctor.
export class BookTeleconsultDto {
  @ApiProperty() @IsString() @IsNotEmpty() doctorId: string;
  @ApiProperty({ description: 'ISO-8601 datetime' }) @IsDateString() scheduledAt: string;
  // The journey this consult belongs to — enforces one active consult per journey.
  @ApiPropertyOptional() @IsOptional() @IsString() journeyId?: string;
}

// Doctor records the price quotation given to the patient during a teleconsult.
export class QuoteDto {
  @ApiProperty() @IsInt() @Min(0) amount: number;
  @ApiPropertyOptional({ example: 'USD' }) @IsOptional() @IsString() currency?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}

// Multipart body field for a shared consult document (its type/kind).
export class TeleconsultDocDto {
  @ApiPropertyOptional({ example: 'Prescription' }) @IsOptional() @IsString() kind?: string;
}

// ── FR-1–4: public application (hospital profile) ─────────────────────────────
export class ApplyDto {
  @ApiProperty() @IsString() @MinLength(2) legalName: string;
  @ApiProperty() @IsString() city: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() registrationNo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ownership?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() website?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) totalBeds?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) icuBeds?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) airportDistanceKm?: number;
  // FR-4: at least one specialty and one insurer/self-pay option required.
  @ApiProperty({ type: [String] }) @IsArray() @IsString({ each: true }) specialties: string[];
  @ApiProperty({ type: [String] }) @IsArray() @IsString({ each: true }) insurers: string[];
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) languages?: string[];
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) intlFacilities?: string[];
}

// ── FR-5/6: authorised contact ────────────────────────────────────────────────
export class ContactDto {
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^[A-Za-z .]+$/, { message: 'designation: letters only' }) designation?: string;
  @ApiProperty() @IsEmail() workEmail: string;
  @ApiProperty() @IsString() @Matches(/^\+?[0-9 ]{7,20}$/, { message: 'WhatsApp-capable number required' }) whatsapp: string;
}

// ── FR-7/8: OTP verification (per channel) ────────────────────────────────────
export class VerifyOtpDto {
  @ApiProperty({ enum: ['email', 'whatsapp'] }) @IsEnum(['email', 'whatsapp'] as any) channel: 'email' | 'whatsapp';
  @ApiProperty({ example: '123456' }) @Matches(/^\d{6}$/, { message: 'code must be 6 digits' }) code: string;
}

// ── FR-9–13: accreditation ────────────────────────────────────────────────────
export class AccreditationDto {
  @ApiProperty({ enum: AccreditationBody }) @IsEnum(AccreditationBody) body: AccreditationBody;
  @ApiPropertyOptional() @IsOptional() @IsString() identifier?: string;
}
export class NotAccreditedDto {
  @ApiProperty() @IsBoolean() notAccredited: boolean;
}

// ── FR-11: document upload (body fields; file is multipart) ───────────────────
export class UploadDocDto {
  @ApiProperty({ enum: OnboardingDocType }) @IsEnum(OnboardingDocType) type: OnboardingDocType;
  @ApiPropertyOptional() @IsOptional() @IsString() doctorId?: string;
}

// ── FR-14–16: agreement e-signature ───────────────────────────────────────────
export class AgreementDto {
  @ApiProperty({ example: 'Dr. A. Rahman' }) @IsString() @MinLength(2) signatoryName: string;
  @ApiProperty({ description: 'authorisation checkbox' }) @IsBoolean() authorised: boolean;
}

// ── FR-19: set password on first sign-in (uses the provisioned login) ─────────
export class SetPasswordDto {
  @ApiProperty() @IsString() @MinLength(12) @MaxLength(128) password: string;
}

// ── FR-21: doctor (dashboard) ─────────────────────────────────────────────────
export class DoctorDto {
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() photoUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() qualifications?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() specialty?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() subspecialty?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) yearsExperience?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() registrationNo?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) languages?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() bio?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) proceduresPerformed?: number;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() teleconsultEnabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() timezone?: string; // IANA
}

export class DoctorLeaveDto {
  @ApiProperty() @IsBoolean() onLeave: boolean;
}

// ── FR-21 (pricing & capacity) ────────────────────────────────────────────────
export class PricingDto {
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) quotedPriceUsd?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) patientsPerYear?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() imageUrl?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) procedures?: string[];
  // Editable from the Treatments screen. Omitted by the Pricing form (left untouched).
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) specialties?: string[];
  // Package narrative shown on the patient comparison card (AI-seeded, editable).
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) localBenchmarkUsd?: number;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) included?: string[];
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) notIncluded?: string[];
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) pros?: string[];
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) cons?: string[];
}

// ── Patient services (languages, insurers/TPAs, international facilities) ──────
export class ServicesDto {
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) languages?: string[];
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) insurers?: string[];
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) intlFacilities?: string[];
}

// ── FR-27: availability windows (public token page) ───────────────────────────
class WindowDto {
  @ApiProperty({ minimum: 0, maximum: 6 }) @IsInt() @Min(0) weekday: number;
  @ApiProperty({ example: '09:00' }) @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) start: string;
  @ApiProperty({ example: '12:00' }) @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) end: string;
}
export class SetAvailabilityDto {
  @ApiProperty({ type: [WindowDto] }) @IsArray() windows: WindowDto[];
  @ApiPropertyOptional() @IsOptional() @IsString() timezone?: string;
}

// ── admin exception review ────────────────────────────────────────────────────
export class ReviewDocDto {
  @ApiProperty({ enum: ['VERIFIED', 'REJECTED'] }) @IsEnum(['VERIFIED', 'REJECTED'] as any) status: 'VERIFIED' | 'REJECTED';
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}
