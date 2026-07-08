import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** Self-service profile update — deliberately excludes email, password and role. */
export class ProfileDto {
  @ApiProperty({ example: 'Amara Okonkwo', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiProperty({ example: 'Nigeria', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string;

  @ApiProperty({ example: '+234 800 000 0000', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
}
