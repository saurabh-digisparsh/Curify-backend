export declare class MailService {
    private transporter;
    constructor();
    sendOtp(email: string, name: string | null, otp: string, token: string): Promise<void>;
    send(to: string, subject: string, html: string, devHint?: string, attachments?: {
        filename: string;
        content: string;
        contentType?: string;
    }[]): Promise<void>;
}
