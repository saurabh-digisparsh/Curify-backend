import { IsEmail, IsOptional, IsString, MaxLength, IsDateString } from 'class-validator';

/**
 * Anonymous chat lead from the intake flow. The global ValidationPipe runs
 * whitelist + forbidNonWhitelisted, so ONLY these fields are accepted — which is
 * also the compliance guarantee: there is no field here for the free-text symptom
 * description (PHI), so it can never be persisted on an unauthenticated record.
 */
export class UpsertInquiryDto {
  @IsEmail()
  email: string;

  @IsOptional() @IsString() @MaxLength(120)
  name?: string;

  @IsOptional() @IsString() @MaxLength(40)
  phone?: string;

  @IsOptional() @IsString() @MaxLength(80)
  country?: string;

  @IsOptional() @IsString() @MaxLength(80)
  treatment?: string;

  @IsOptional() @IsString() @MaxLength(80)
  city?: string;

  @IsOptional() @IsString() @MaxLength(40)
  urgency?: string;

  @IsOptional() @IsDateString()
  travelDate?: string;

  @IsOptional() @IsString() @MaxLength(120)
  insurance?: string; // "Yes — <provider>", "No", or "Not sure"
}
