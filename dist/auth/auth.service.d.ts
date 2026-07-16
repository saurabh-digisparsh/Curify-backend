import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from './mail.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { InquiriesService } from '../inquiries/inquiries.service';
export declare class AuthService {
    private prisma;
    private jwt;
    private mail;
    private inquiries;
    constructor(prisma: PrismaService, jwt: JwtService, mail: MailService, inquiries: InquiriesService);
    private issueOtp;
    signup(dto: SignupDto): Promise<{
        requiresVerification: boolean;
        email: string;
        message: string;
    }>;
    verifyOtp(email: string, otp: string): Promise<{
        user: {
            id: string;
            name: string | null;
            email: string;
            phone: string | null;
            country: string | null;
            verifyToken: string | null;
            role: import(".prisma/client").$Enums.Role;
            medicalConsentAt: Date | null;
            emailVerifiedAt: Date | null;
            verifyTokenExp: Date | null;
            verifyOtp: string | null;
            verifyOtpExp: Date | null;
            verifyOtpTries: number;
            createdAt: Date;
            updatedAt: Date;
        };
        token: string;
        verified: boolean;
    }>;
    verifyEmail(token: string): Promise<{
        verified: boolean;
        email: string;
    }>;
    resendVerification(email: string): Promise<{
        message: string;
    }>;
    login(dto: LoginDto): Promise<{
        user: {
            id: string;
            name: string | null;
            email: string;
            phone: string | null;
            country: string | null;
            verifyToken: string | null;
            role: import(".prisma/client").$Enums.Role;
            medicalConsentAt: Date | null;
            emailVerifiedAt: Date | null;
            verifyTokenExp: Date | null;
            verifyOtp: string | null;
            verifyOtpExp: Date | null;
            verifyOtpTries: number;
            createdAt: Date;
            updatedAt: Date;
        };
        token: string;
    }>;
    updateProfile(userId: string, dto: {
        name?: string;
        country?: string;
        phone?: string;
    }): Promise<{
        id: string;
        name: string | null;
        email: string;
        phone: string | null;
        country: string | null;
        verifyToken: string | null;
        role: import(".prisma/client").$Enums.Role;
        medicalConsentAt: Date | null;
        emailVerifiedAt: Date | null;
        verifyTokenExp: Date | null;
        verifyOtp: string | null;
        verifyOtpExp: Date | null;
        verifyOtpTries: number;
        createdAt: Date;
        updatedAt: Date;
    }>;
    recordConsent(userId: string): Promise<{
        medicalConsentAt: Date;
    }>;
    getMe(userId: string): Promise<{
        id: string;
        name: string | null;
        email: string;
        phone: string | null;
        country: string | null;
        verifyToken: string | null;
        role: import(".prisma/client").$Enums.Role;
        medicalConsentAt: Date | null;
        emailVerifiedAt: Date | null;
        verifyTokenExp: Date | null;
        verifyOtp: string | null;
        verifyOtpExp: Date | null;
        verifyOtpTries: number;
        createdAt: Date;
        updatedAt: Date;
    }>;
    private signToken;
}
