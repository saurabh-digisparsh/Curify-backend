import { Injectable, Logger } from '@nestjs/common';
import { MailService } from '../auth/mail.service';

// ── iCalendar (.ics) invite — plain text, no dependency ──────────────────────
/** UTC instant → iCal basic format YYYYMMDDTHHMMSSZ. */
function icsStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}
/** Build a single-event .ics a mail client / calendar can import. */
export function buildIcs(o: { uid: string; start: Date; minutes: number; summary: string; description: string; url: string }): string {
  const end = new Date(o.start.getTime() + o.minutes * 60_000);
  const esc = (s: string) => s.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
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

/**
 * Channel-agnostic notifications for hospital onboarding (BRD is WhatsApp-first).
 * Email goes through the existing MailService (SMTP-optional). WhatsApp goes
 * through a pluggable adapter: with no provider configured it logs the message
 * (dev), so every flow — dual OTP, credentials, availability links — is testable
 * now and a real WhatsApp Business API drops in behind `whatsapp()` later.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger('Notifications');
  constructor(private mail: MailService) {}

  private base() { return process.env.FRONTEND_URL || 'http://localhost:5173'; }

  /** Send a WhatsApp message. Stub: logs unless WHATSAPP_API_URL is configured. */
  private async whatsapp(to: string, message: string) {
    if (!process.env.WHATSAPP_API_URL) {
      this.logger.warn(`📱 [DEV] WhatsApp → ${to}: ${message}`);
      return;
    }
    // ponytail: real WhatsApp Business API wiring goes here (template send).
    this.logger.log(`📱 WhatsApp → ${to} (via provider)`);
  }

  private card(heading: string, body: string, cta?: { label: string; url: string }, note?: string) {
    return `
      <div style="font-family:Inter,system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#0F172A">${heading}</h2>
        <p style="color:#475569;line-height:1.6">${body}</p>
        ${cta ? `<p style="margin:20px 0"><a href="${cta.url}" style="background:#0066CC;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;display:inline-block">${cta.label}</a></p>` : ''}
        ${note ? `<p style="color:#94A3B8;font-size:12px;line-height:1.5">${note}</p>` : ''}
      </div>`;
  }

  /** FR-7: 6-digit OTP to the contact's email. */
  async sendEmailOtp(email: string, otp: string) {
    await this.mail.send(
      email,
      `${otp} is your Curify partner verification code`,
      this.card('Verify your email', 'Enter this code to continue your Curify hospital application:',
        undefined, `Your code: <b style="color:#0066CC;letter-spacing:4px">${otp}</b> — expires in 10 minutes.`),
      `OTP ${otp}`,
    );
  }

  /** FR-7: 6-digit OTP to the contact's WhatsApp. */
  async sendWhatsappOtp(whatsapp: string, otp: string) {
    await this.whatsapp(whatsapp, `Your Curify verification code is ${otp} (valid 10 min).`);
  }

  /** FR-18: deliver login ID + one-time password to email + WhatsApp. */
  async sendCredentials(email: string, whatsapp: string, loginId: string, oneTimePassword: string) {
    const url = `${this.base()}/login`;
    await this.mail.send(
      email,
      'Your Curify hospital dashboard is ready',
      this.card('Welcome to Curify 🎉',
        `Your hospital dashboard is live. Sign in with the credentials below and set your own password on first sign-in.<br/><br/><b>Login ID:</b> ${loginId}<br/><b>One-time password:</b> ${oneTimePassword}`,
        { label: 'Sign in to your dashboard', url },
        'For security, change this password immediately after signing in.'),
      `login ${loginId} / ${oneTimePassword} → ${url}`,
    );
    await this.whatsapp(whatsapp, `Curify dashboard ready. Login ID: ${loginId}, one-time password: ${oneTimePassword}. Sign in: ${url}`);
  }

  /** FR-26: private, single-doctor availability link. */
  async sendAvailabilityLink(doctor: { name: string; email?: string | null; whatsapp?: string | null }, token: string) {
    const url = `${this.base()}/availability/${token}`;
    if (doctor.email) {
      await this.mail.send(
        doctor.email,
        'Set your video consultation availability',
        this.card(`Hello Dr. ${doctor.name} 👋`,
          'Set the weekly times you are available for video consultations with international patients. You can edit this anytime.',
          { label: 'Set your availability', url },
          'This link is personal to you — please don’t forward it beyond your coordinator.'),
        `availability link → ${url}`,
      );
    }
    if (doctor.whatsapp) await this.whatsapp(doctor.whatsapp, `Set your Curify video consultation availability: ${url}`);
  }

  /**
   * A patient booked a video consultation — email BOTH sides their join link and
   * an .ics calendar invite (so each can add it to their own calendar in their own
   * timezone). Best-effort: mail failures are swallowed by MailService.
   */
  async sendTeleconsultBooked(p: {
    teleconsultId: string;
    scheduledAt: Date;
    minutes?: number;
    patient: { email?: string | null; name?: string | null };
    doctor: { name: string; email?: string | null; availabilityToken?: string | null; timezone?: string | null };
  }) {
    const minutes = p.minutes ?? 30;
    const base = this.base();
    const patientUrl = `${base}/teleconsult/${p.teleconsultId}`;
    const doctorUrl = p.doctor.availabilityToken ? `${base}/availability/${p.doctor.availabilityToken}` : base;
    // Rendered in the recipient's timezone where we know it; the .ics carries the
    // exact instant so every calendar shows it in local time regardless.
    const fmt = (tz?: string | null) =>
      new Intl.DateTimeFormat('en-US', {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit', timeZoneName: 'short', ...(tz ? { timeZone: tz } : {}),
      }).format(p.scheduledAt);

    // Patient email + invite
    if (p.patient.email) {
      const ics = buildIcs({ uid: p.teleconsultId, start: p.scheduledAt, minutes, summary: `Video consultation with Dr. ${p.doctor.name}`, description: `Join your Curify video consultation: ${patientUrl}`, url: patientUrl });
      await this.mail.send(
        p.patient.email,
        'Your Curify video consultation is booked',
        this.card('Your consultation is confirmed ✅',
          `You're booked for a video consultation with <b>Dr. ${p.doctor.name}</b> on <b>${fmt()}</b> (your local time).<br/><br/>Join from the button below at the scheduled time. The calendar invite is attached.`,
          { label: 'Join / manage consultation', url: patientUrl },
          'Add the attached invite to your calendar so you get a reminder.'),
        `consult ${fmt()} → ${patientUrl}`,
        [{ filename: 'consultation.ics', content: ics, contentType: 'text/calendar' }],
      );
    }

    // Doctor email + invite
    if (p.doctor.email) {
      const ics = buildIcs({ uid: `${p.teleconsultId}-doc`, start: p.scheduledAt, minutes, summary: `Video consultation with a Curify patient`, description: `Open your Curify availability page to join: ${doctorUrl}`, url: doctorUrl });
      await this.mail.send(
        p.doctor.email,
        'New video consultation booked',
        this.card(`Hello Dr. ${p.doctor.name} 👋`,
          `A patient has booked a video consultation with you on <b>${fmt(p.doctor.timezone)}</b>${p.doctor.timezone ? ` (${p.doctor.timezone})` : ''}.<br/><br/>Join from your availability page at the scheduled time. The calendar invite is attached.`,
          { label: 'Open your consultations', url: doctorUrl },
          'This link is personal to you — please don’t forward it.'),
        `consult ${fmt(p.doctor.timezone)} → ${doctorUrl}`,
        [{ filename: 'consultation.ics', content: ics, contentType: 'text/calendar' }],
      );
    }
  }

  /**
   * The DOCTOR called off a booked consultation — tell the patient immediately,
   * with the reason and the reassurance that their free consultation was handed
   * back (the allowance ignores cancelled consults, so rebooking costs nothing).
   */
  async sendTeleconsultCancelled(p: {
    teleconsultId: string;
    scheduledAt: Date;
    reason?: string | null;
    patient: { email?: string | null; name?: string | null };
    doctorName: string;
  }) {
    if (!p.patient.email) return;
    const url = `${this.base()}/dashboard/journeys`;
    const when = new Intl.DateTimeFormat('en-US', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    }).format(p.scheduledAt);
    await this.mail.send(
      p.patient.email,
      'Your Curify video consultation was cancelled',
      this.card('Your consultation was cancelled',
        `Dr. ${p.doctorName} had to cancel your video consultation scheduled for <b>${when}</b>.`
        + (p.reason ? `<br/><br/><b>Reason:</b> ${p.reason}` : '')
        + '<br/><br/>You have <b>not</b> been charged and this did not use one of your free consultations — pick a new time whenever you are ready.',
        { label: 'Book another time', url },
        'Sorry for the disruption — our care team can help if you would prefer a different doctor.'),
      `consult ${when} cancelled by doctor${p.reason ? ` — ${p.reason}` : ''}`,
    );
  }
}
