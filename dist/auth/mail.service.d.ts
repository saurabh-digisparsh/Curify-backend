export declare class MailService {
    private transporter;
    constructor();
    sendOtp(email: string, name: string | null, otp: string, token: string): Promise<void>;
}
