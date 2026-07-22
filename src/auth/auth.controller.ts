import { Controller, Post, Get, Patch, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { ProfileDto } from './dto/profile.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // Tight per-IP limits on credential endpoints to blunt brute-force / credential
  // stuffing / signup abuse (well below the global 120/min default).
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @ApiOperation({ summary: 'Register a new patient account' })
  @Post('signup')
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({ summary: 'Login with email & password' })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // Throttled to blunt email-enumeration; the signup form already reveals the same
  // "already registered" state, so this exposes nothing new — it just does it earlier.
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Check whether an account already exists for an email (chat intake early-exit)' })
  @Post('check-email')
  checkEmail(@Body() body: { email?: string }) {
    return this.authService.emailExists(String(body?.email || '').toLowerCase());
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Request() req) {
    return this.authService.getMe(req.user.id);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Record medical-document (PHI) consent for the current user' })
  @UseGuards(JwtAuthGuard)
  @Post('consent')
  consent(@Request() req) {
    return this.authService.recordConsent(req.user.id);
  }

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Verify email from the signup link' })
  @Get('verify-email')
  verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(String(token || ''));
  }

  @Throttle({ default: { ttl: 60_000, limit: 8 } })
  @ApiOperation({ summary: 'Verify a 6-digit OTP and auto-login' })
  @Post('verify-otp')
  verifyOtp(@Body() body: { email?: string; otp?: string }) {
    return this.authService.verifyOtp(
      String(body?.email || '').toLowerCase(),
      String(body?.otp || '').replace(/\D/g, '').slice(0, 6),
    );
  }

  @Throttle({ default: { ttl: 300_000, limit: 3 } })
  @ApiOperation({ summary: 'Resend the verification code' })
  @Post('resend-verification')
  resend(@Body() body: { email?: string }) {
    return this.authService.resendVerification(String(body?.email || '').toLowerCase());
  }

  // Tight limit: this endpoint sends mail to an attacker-supplied address.
  @Throttle({ default: { ttl: 300_000, limit: 3 } })
  @ApiOperation({ summary: 'Email a password-reset link' })
  @Post('forgot-password')
  forgotPassword(@Body() body: { email?: string }) {
    return this.authService.forgotPassword(String(body?.email || '').toLowerCase());
  }

  @Throttle({ default: { ttl: 300_000, limit: 5 } })
  @ApiOperation({ summary: 'Set a new password using a reset token' })
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update own profile (name / country / phone)' })
  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  profile(@Request() req, @Body() dto: ProfileDto) {
    return this.authService.updateProfile(req.user.id, dto);
  }
}
