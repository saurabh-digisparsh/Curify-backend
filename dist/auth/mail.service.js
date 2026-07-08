"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailService = void 0;
const common_1 = require("@nestjs/common");
const nodemailer = require("nodemailer");
let MailService = class MailService {
    constructor() {
        this.transporter = null;
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
        }
        else {
            console.warn('📧 Mailer: no SMTP_HOST configured — verification links will be logged to console (dev mode)');
        }
    }
    async sendOtp(email, name, otp, token) {
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
        }
        catch (err) {
            console.error(`📧 SMTP send failed for ${email}: ${err.message}`);
            console.warn(`📧 [FALLBACK] OTP for ${email}: ${otp}  (link: ${url})`);
        }
    }
};
exports.MailService = MailService;
exports.MailService = MailService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], MailService);
//# sourceMappingURL=mail.service.js.map