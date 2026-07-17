import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

/**
 * Minimal mailer for auth emails. SMTP comes from env (optional in dev):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM, FRONTEND_URL
 * Without SMTP_HOST the mail is not sent — the verification link is logged to
 * the server console instead, so local signup flows stay testable.
 */
@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    if (process.env.SMTP_HOST) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      });
      console.log(`📧 Mailer: SMTP ${process.env.SMTP_HOST}`);
    } else {
      console.warn('📧 Mailer: no SMTP_HOST configured — verification links will be logged to console (dev mode)');
    }
  }

  /** Send the 6-digit verification code (with a fallback verify-link too). */
  async sendOtp(email: string, name: string | null, otp: string, token: string) {
    const base = process.env.FRONTEND_URL || 'http://localhost:5173';
    const url = `${base}/verify-email?token=${token}`;

    if (!this.transporter) {
      console.warn(`📧 [DEV] OTP for ${email}: ${otp}  (link: ${url})`);
      return;
    }
    try {
      await this.transporter.sendMail({
        from: process.env.MAIL_FROM || 'Curify <no-reply@curify.health>',
        to: email,
        subject: `${otp} is your Curify verification code`,
        html: `
          <div style="font-family:Inter,system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="color:#0F172A">Welcome to Curify${name ? `, ${name}` : ''} 👋</h2>
            <p style="color:#475569;line-height:1.6">Enter this code to verify your email and continue your medical journey:</p>
            <div style="font-size:34px;font-weight:800;letter-spacing:10px;color:#0066CC;background:#E8F4FD;border-radius:12px;text-align:center;padding:18px 0;margin:18px 0">${otp}</div>
            <p style="color:#94A3B8;font-size:12px;line-height:1.5">This code expires in 10 minutes. You can also <a href="${url}" style="color:#0066CC">verify with one click</a>. If you didn't create a Curify account, ignore this email.</p>
          </div>`,
      });
      console.log(`📧 OTP email sent to ${email}`);
    } catch (err: any) {
      // Never let a mail outage break signup — log the code as fallback.
      console.error(`📧 SMTP send failed for ${email}: ${err.message}`);
      console.warn(`📧 [FALLBACK] OTP for ${email}: ${otp}  (link: ${url})`);
    }
  }

  /** Send the password-reset link. Rides on send() so the no-SMTP dev fallback
   *  (link logged to console) works here exactly as it does for signup. */
  async sendPasswordReset(email: string, name: string | null, token: string) {
    const base = process.env.FRONTEND_URL || 'http://localhost:5173';
    const url = `${base}/reset-password?token=${token}`;
    await this.send(
      email,
      'Reset your Curify password',
      `
        <div style="font-family:Inter,system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="color:#0F172A">Reset your password${name ? `, ${name}` : ''}</h2>
          <p style="color:#475569;line-height:1.6">Click the button below to choose a new password:</p>
          <p style="text-align:center;margin:24px 0">
            <a href="${url}" style="display:inline-block;background:#0066CC;color:#fff;text-decoration:none;font-weight:700;border-radius:10px;padding:14px 28px">Reset password</a>
          </p>
          <p style="color:#94A3B8;font-size:12px;line-height:1.5">This link expires in 1 hour and can be used once. If you didn't request a password reset, ignore this email — your password stays unchanged.</p>
        </div>`,
      `reset link: ${url}`,
    );
  }

  /** Generic transactional email used by NotificationService (onboarding OTPs,
   *  credentials, availability links). SMTP-optional: without SMTP_HOST the
   *  subject + a plain-text hint are logged so dev flows stay testable. */
  async send(
    to: string, subject: string, html: string, devHint?: string,
    attachments?: { filename: string; content: string; contentType?: string }[],
  ) {
    if (!this.transporter) {
      console.warn(`📧 [DEV] "${subject}" → ${to}${devHint ? `  (${devHint})` : ''}`);
      return;
    }
    try {
      await this.transporter.sendMail({
        from: process.env.MAIL_FROM || 'Curify <no-reply@curify.health>',
        to, subject, html, attachments,
      });
      console.log(`📧 "${subject}" sent to ${to}`);
    } catch (err: any) {
      console.error(`📧 SMTP send failed for ${to}: ${err.message}`);
      if (devHint) console.warn(`📧 [FALLBACK] ${to}: ${devHint}`);
    }
  }
}
