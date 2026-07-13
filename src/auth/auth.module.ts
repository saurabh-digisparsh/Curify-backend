import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { MailService } from './mail.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { InquiriesModule } from '../inquiries/inquiries.module';

@Module({
  imports: [
    InquiriesModule, // markConverted() when a pre-signup chat lead signs up
    PassportModule,
    JwtModule.register({
      // JWT_SECRET is required (validated at boot in main.ts) — no insecure fallback.
      secret: process.env.JWT_SECRET as string,
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
    }),
  ],
  providers: [AuthService, MailService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
