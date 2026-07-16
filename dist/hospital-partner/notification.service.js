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
exports.NotificationService = void 0;
exports.buildIcs = buildIcs;
const common_1 = require("@nestjs/common");
const mail_service_1 = require("../auth/mail.service");
function icsStamp(d) {
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}
function buildIcs(o) {
    const end = new Date(o.start.getTime() + o.minutes * 60_000);
    const esc = (s) => s.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
    return [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Curify//Teleconsult//EN', 'CALSCALE:GREGORIAN', 'METHOD:REQUEST',
        'BEGIN:VEVENT',
        `UID:${o.uid}@curify.health`,
        `DTSTAMP:${icsStamp(o.start)}`,
        `DTSTART:${icsStamp(o.start)}`,
        `DTEND:${icsStamp(end)}`,
        `SUMMARY:${esc(o.summary)}`,
        `DESCRIPTION:${esc(o.description)}`,
        `URL:${o.url}`,
        'LOCATION:Online video call',
        'STATUS:CONFIRMED',
        'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
}
let NotificationService = class NotificationService {
    constructor(mail) {
        this.mail = mail;
        this.logger = new common_1.Logger('Notifications');
    }
    base() { return process.env.FRONTEND_URL || 'http://localhost:5173'; }
    async whatsapp(to, message) {
        if (!process.env.WHATSAPP_API_URL) {
            this.logger.warn(`📱 [DEV] WhatsApp → ${to}: ${message}`);
            return;
        }
        this.logger.log(`📱 WhatsApp → ${to} (via provider)`);
    }
    card(heading, body, cta, note) {
        return `
      <div style="font-family:Inter,system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#0F172A">${heading}</h2>
        <p style="color:#475569;line-height:1.6">${body}</p>
        ${cta ? `<p style="margin:20px 0"><a href="${cta.url}" style="background:#0066CC;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;display:inline-block">${cta.label}</a></p>` : ''}
        ${note ? `<p style="color:#94A3B8;font-size:12px;line-height:1.5">${note}</p>` : ''}
      </div>`;
    }
    async sendEmailOtp(email, otp) {
        await this.mail.send(email, `${otp} is your Curify partner verification code`, this.card('Verify your email', 'Enter this code to continue your Curify hospital application:', undefined, `Your code: <b style="color:#0066CC;letter-spacing:4px">${otp}</b> — expires in 10 minutes.`), `OTP ${otp}`);
    }
    async sendWhatsappOtp(whatsapp, otp) {
        await this.whatsapp(whatsapp, `Your Curify verification code is ${otp} (valid 10 min).`);
    }
    async sendCredentials(email, whatsapp, loginId, oneTimePassword) {
        const url = `${this.base()}/login`;
        await this.mail.send(email, 'Your Curify hospital dashboard is ready', this.card('Welcome to Curify 🎉', `Your hospital dashboard is live. Sign in with the credentials below and set your own password on first sign-in.<br/><br/><b>Login ID:</b> ${loginId}<br/><b>One-time password:</b> ${oneTimePassword}`, { label: 'Sign in to your dashboard', url }, 'For security, change this password immediately after signing in.'), `login ${loginId} / ${oneTimePassword} → ${url}`);
        await this.whatsapp(whatsapp, `Curify dashboard ready. Login ID: ${loginId}, one-time password: ${oneTimePassword}. Sign in: ${url}`);
    }
    async sendAvailabilityLink(doctor, token) {
        const url = `${this.base()}/availability/${token}`;
        if (doctor.email) {
            await this.mail.send(doctor.email, 'Set your teleconsultation availability', this.card(`Hello Dr. ${doctor.name} 👋`, 'Set the weekly times you are available for video consultations with international patients. You can edit this anytime.', { label: 'Set your availability', url }, 'This link is personal to you — please don’t forward it beyond your coordinator.'), `availability link → ${url}`);
        }
        if (doctor.whatsapp)
            await this.whatsapp(doctor.whatsapp, `Set your Curify teleconsult availability: ${url}`);
    }
    async sendTeleconsultBooked(p) {
        const minutes = p.minutes ?? 30;
        const base = this.base();
        const patientUrl = `${base}/teleconsult/${p.teleconsultId}`;
        const doctorUrl = p.doctor.availabilityToken ? `${base}/availability/${p.doctor.availabilityToken}` : base;
        const fmt = (tz) => new Intl.DateTimeFormat('en-US', {
            weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
            hour: 'numeric', minute: '2-digit', timeZoneName: 'short', ...(tz ? { timeZone: tz } : {}),
        }).format(p.scheduledAt);
        if (p.patient.email) {
            const ics = buildIcs({ uid: p.teleconsultId, start: p.scheduledAt, minutes, summary: `Video consultation with Dr. ${p.doctor.name}`, description: `Join your Curify video consultation: ${patientUrl}`, url: patientUrl });
            await this.mail.send(p.patient.email, 'Your Curify video consultation is booked', this.card('Your consultation is confirmed ✅', `You're booked for a video consultation with <b>Dr. ${p.doctor.name}</b> on <b>${fmt()}</b> (your local time).<br/><br/>Join from the button below at the scheduled time. The calendar invite is attached.`, { label: 'Join / manage consultation', url: patientUrl }, 'Add the attached invite to your calendar so you get a reminder.'), `consult ${fmt()} → ${patientUrl}`, [{ filename: 'consultation.ics', content: ics, contentType: 'text/calendar' }]);
        }
        if (p.doctor.email) {
            const ics = buildIcs({ uid: `${p.teleconsultId}-doc`, start: p.scheduledAt, minutes, summary: `Teleconsult with a Curify patient`, description: `Open your Curify availability page to join: ${doctorUrl}`, url: doctorUrl });
            await this.mail.send(p.doctor.email, 'New teleconsultation booked', this.card(`Hello Dr. ${p.doctor.name} 👋`, `A patient has booked a video consultation with you on <b>${fmt(p.doctor.timezone)}</b>${p.doctor.timezone ? ` (${p.doctor.timezone})` : ''}.<br/><br/>Join from your availability page at the scheduled time. The calendar invite is attached.`, { label: 'Open your consultations', url: doctorUrl }, 'This link is personal to you — please don’t forward it.'), `consult ${fmt(p.doctor.timezone)} → ${doctorUrl}`, [{ filename: 'consultation.ics', content: ics, contentType: 'text/calendar' }]);
        }
    }
};
exports.NotificationService = NotificationService;
exports.NotificationService = NotificationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [mail_service_1.MailService])
], NotificationService);
//# sourceMappingURL=notification.service.js.map