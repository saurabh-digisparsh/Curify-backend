import { IsEmail, IsString, MinLength, IsOptional, Matches, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SignupDto {
  @ApiProperty({ example: 'amara@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Amara Okonkwo' })
  @IsString()
  name: string;

  // Strong password policy: ≥8 chars with upper, lower, number and symbol.
  @ApiProperty({ example: 'Str0ng!Pwd', minLength: 8 })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message: 'Password must be at least 8 characters and include uppercase, lowercase, a number and a symbol.',
  })
  password: string;

  @ApiProperty({ example: 'Nigeria', required: false })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({ example: '+234 800 000 0000', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  // Consent to store/process medical documents (PHI) — captured in the chat
  // flow's signup card before the first report upload; timestamped server-side.
  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  medicalConsent?: boolean;
}
