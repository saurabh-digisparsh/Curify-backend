import { Injectable, ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from './mail.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { InquiriesService } from '../inquiries/inquiries.service';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService, private mail: MailService, private inquiries: InquiriesService) {}

  /** Mint a fresh 6-digit OTP + link token pair and email them. Shared by
   *  signup and resend so both use the same OTP verification. */
  private async issueOtp(user: { id: string; email: string; name: string | null }) {
    const otp = String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
    const verifyToken = randomBytes(32).toString('hex');
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        verifyOtp: otp,
        verifyOtpExp: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        verifyOtpTries: 0,
        verifyToken,
        verifyTokenExp: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    await this.mail.sendOtp(user.email, user.name, otp, verifyToken);
  }

  async signup(dto: SignupDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email already registered');

    const hashed = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        password: hashed,
        country: dto.country,
        phone: dto.phone,
        // Consent is timestamped server-side at account creation, never trusted
        // from a client-supplied date.
        medicalConsentAt: dto.medicalConsent ? new Date() : null,
      },
    });

    // NOTE: the chat lead is NOT converted here. An unverified signup is not yet a
    // real user (it can't even log in — see login()), so it stays a chat lead until
    // the email OTP/link is confirmed (see verifyOtp / verifyEmail).
    await this.issueOtp(user);
    // No session token here — the email must be verified (OTP) first.
    return { requiresVerification: true, email: user.email, message: 'Verification code sent — check your inbox.' };
  }

  /** Verify a 6-digit OTP and AUTO-LOGIN (returns a session). Powers both the
   *  in-chat OTP prompt and the sign-up verify screen — smooth, no relogin. */
  async verifyOtp(email: string, otp: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.verifyOtp || !user.verifyOtpExp) {
      throw new BadRequestException('No verification pending for this email. Request a new code.');
    }
    if (user.verifyOtpExp < new Date()) {
      throw new BadRequestException('This code has expired — request a new one.');
    }
    if (user.verifyOtpTries >= 6) {
      throw new BadRequestException('Too many attempts — request a new code.');
    }
    if (String(otp).trim() !== user.verifyOtp) {
      await this.prisma.user.update({ where: { id: user.id }, data: { verifyOtpTries: { increment: 1 } } });
      throw new BadRequestException('Incorrect code — please try again.');
    }
    const verified = await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date(), verifyOtp: null, verifyOtpExp: null, verifyToken: null, verifyTokenExp: null },
    });
    // Email confirmed → NOW they're a real user: convert the chat lead (best-effort).
    await this.inquiries.markConverted(verified.email, verified.id).catch(() => {});
    const { password, ...userData } = verified;
    return { user: userData, token: this.signToken(verified.id, verified.email), verified: true };
  }

  /** Consume a verification link (single-use; expired/used tokens get a friendly error). */
  async verifyEmail(token: string) {
    if (!token || token.length < 32) throw new BadRequestException('Invalid verification link');
    const user = await this.prisma.user.findUnique({ where: { verifyToken: token } });
    if (!user) throw new BadRequestException('This verification link is invalid or was already used.');
    if (user.verifyTokenExp && user.verifyTokenExp < new Date()) {
      throw new BadRequestException('This verification link has expired — request a new one.');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date(), verifyOtp: null, verifyOtpExp: null, verifyToken: null, verifyTokenExp: null },
    });
    // Email confirmed via link → convert the chat lead now (not at signup).
    await this.inquiries.markConverted(user.email, user.id).catch(() => {});
    return { verified: true, email: user.email };
  }

  /** Re-issue a verification code. Responds identically whether or not the
   *  account exists / is already verified, so it cannot probe for emails. */
  async resendVerification(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && !user.emailVerifiedAt) {
      await this.issueOtp(user);
    }
    return { message: 'If that account needs verification, a code has been sent.' };
  }

  /** Start a reset: mail a single-use link. Like resendVerification, the reply
   *  is identical whether or not the account exists — no email enumeration. */
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user) {
      const resetToken = randomBytes(32).toString('hex');
      await this.prisma.user.update({
        where: { id: user.id },
        data: { resetToken, resetTokenExp: new Date(Date.now() + 60 * 60 * 1000) },
      });
      await this.mail.sendPasswordReset(user.email, user.name, resetToken);
    }
    return { message: 'If an account exists for that email, a reset link has been sent.' };
  }

  /** Consume a reset link and set the new password (single-use). */
  async resetPassword(token: string, password: string) {
    if (!token || token.length < 32) throw new BadRequestException('Invalid reset link');
    const user = await this.prisma.user.findUnique({ where: { resetToken: token } });
    if (!user) throw new BadRequestException('This reset link is invalid or was already used.');
    if (!user.resetTokenExp || user.resetTokenExp < new Date()) {
      throw new BadRequestException('This reset link has expired — request a new one.');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: await bcrypt.hash(password, 12),
        resetToken: null,
        resetTokenExp: null,
        // Receiving the mail proves the address — an unverified account that
        // resets is verified by the same act, and can log in immediately.
        emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
      },
    });
    return { message: 'Password updated — you can sign in now.' };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    // Every account must verify its email before the first password login.
    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException('Please verify your email first — check your inbox for the verification link.');
    }

    const { password, ...userData } = user;
    return { user: userData, token: this.signToken(user.id, user.email) };
  }

  /** Self-service profile update (name / country / phone — never email/role here). */
  async updateProfile(userId: string, dto: { name?: string; country?: string; phone?: string }) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.country !== undefined ? { country: dto.country } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
      },
    });
    const { password, ...userData } = user;
    return userData;
  }

  /** Stamp medical-document consent for an existing (pre-consent) account. Idempotent. */
  async recordConsent(userId: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { medicalConsentAt: new Date() },
    });
    return { medicalConsentAt: user.medicalConsentAt };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const { password, ...userData } = user;
    return userData;
  }

  private signToken(userId: string, email: string) {
    return this.jwt.sign(
      { sub: userId, email },
      { secret: process.env.JWT_SECRET, expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
    );
  }
}
