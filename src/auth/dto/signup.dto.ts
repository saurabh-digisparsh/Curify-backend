import { IsEmail, IsString, MinLength, IsOptional, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SignupDto {
  @ApiProperty({ example: 'amara@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Amara Okonkwo' })
  @IsString()
  name: string;

  // Strong password policy: ≥12 chars with upper, lower, number and symbol.
  @ApiProperty({ example: 'Str0ng!Passw0rd', minLength: 12 })
  @IsString()
  @MinLength(12)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message: 'Password must be at least 12 characters and include uppercase, lowercase, a number and a symbol.',
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
}
