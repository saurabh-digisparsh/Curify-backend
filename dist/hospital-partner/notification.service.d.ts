import { MailService } from '../auth/mail.service';
export declare function buildIcs(o: {
    uid: string;
    start: Date;
    minutes: number;
    summary: string;
    description: string;
    url: string;
}): string;
export declare class NotificationService {
    private mail;
    private readonly logger;
    constructor(mail: MailService);
    private base;
    private whatsapp;
    private card;
    sendEmailOtp(email: string, otp: string): Promise<void>;
    sendWhatsappOtp(whatsapp: string, otp: string): Promise<void>;
    sendCredentials(email: string, whatsapp: string, loginId: string, oneTimePassword: string): Promise<void>;
    sendAvailabilityLink(doctor: {
        name: string;
        email?: string | null;
        whatsapp?: string | null;
    }, token: string): Promise<void>;
    sendTeleconsultBooked(p: {
        teleconsultId: string;
        scheduledAt: Date;
        minutes?: number;
        patient: {
            email?: string | null;
            name?: string | null;
        };
        doctor: {
            name: string;
            email?: string | null;
            availabilityToken?: string | null;
            timezone?: string | null;
        };
    }): Promise<void>;
    sendTeleconsultCancelled(p: {
        teleconsultId: string;
        scheduledAt: Date;
        reason?: string | null;
        patient: {
            email?: string | null;
            name?: string | null;
        };
        doctorName: string;
    }): Promise<void>;
}
