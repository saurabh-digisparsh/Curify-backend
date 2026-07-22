import { IsString, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Single-use token from the emailed reset link' })
  @IsString()
  token: string;

  // Same policy as signup — a reset must not be a way to weaken the password.
  @ApiProperty({ example: 'Str0ng!Pwd', minLength: 8 })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message: 'Password must be at least 8 characters and include uppercase, lowercase, a number and a symbol.',
  })
  password: string;
}
