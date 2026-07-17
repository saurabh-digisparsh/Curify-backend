import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { ProfileDto } from './dto/profile.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
    signup(dto: SignupDto): Promise<{
        requiresVerification: boolean;
        email: string;
        message: string;
    }>;
    login(dto: LoginDto): Promise<{
        user: {
            id: string;
            name: string | null;
            email: string;
            country: string | null;
            phone: string | null;
            verifyToken: string | null;
            resetToken: string | null;
            role: import(".prisma/client").$Enums.Role;
            medicalConsentAt: Date | null;
            emailVerifiedAt: Date | null;
            verifyTokenExp: Date | null;
            verifyOtp: string | null;
            verifyOtpExp: Date | null;
            verifyOtpTries: number;
            resetTokenExp: Date | null;
            createdAt: Date;
            updatedAt: Date;
        };
        token: string;
    }>;
    getMe(req: any): Promise<{
        id: string;
        name: string | null;
        email: string;
        country: string | null;
        phone: string | null;
        verifyToken: string | null;
        resetToken: string | null;
        role: import(".prisma/client").$Enums.Role;
        medicalConsentAt: Date | null;
        emailVerifiedAt: Date | null;
        verifyTokenExp: Date | null;
        verifyOtp: string | null;
        verifyOtpExp: Date | null;
        verifyOtpTries: number;
        resetTokenExp: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    consent(req: any): Promise<{
        medicalConsentAt: Date;
    }>;
    verifyEmail(token: string): Promise<{
        verified: boolean;
        email: string;
    }>;
    verifyOtp(body: {
        email?: string;
        otp?: string;
    }): Promise<{
        user: {
            id: string;
            name: string | null;
            email: string;
            country: string | null;
            phone: string | null;
            verifyToken: string | null;
            resetToken: string | null;
            role: import(".prisma/client").$Enums.Role;
            medicalConsentAt: Date | null;
            emailVerifiedAt: Date | null;
            verifyTokenExp: Date | null;
            verifyOtp: string | null;
            verifyOtpExp: Date | null;
            verifyOtpTries: number;
            resetTokenExp: Date | null;
            createdAt: Date;
            updatedAt: Date;
        };
        token: string;
        verified: boolean;
    }>;
    resend(body: {
        email?: string;
    }): Promise<{
        message: string;
    }>;
    forgotPassword(body: {
        email?: string;
    }): Promise<{
        message: string;
    }>;
    resetPassword(dto: ResetPasswordDto): Promise<{
        message: string;
    }>;
    profile(req: any, dto: ProfileDto): Promise<{
        id: string;
        name: string | null;
        email: string;
        country: string | null;
        phone: string | null;
        verifyToken: string | null;
        resetToken: string | null;
        role: import(".prisma/client").$Enums.Role;
        medicalConsentAt: Date | null;
        emailVerifiedAt: Date | null;
        verifyTokenExp: Date | null;
        verifyOtp: string | null;
        verifyOtpExp: Date | null;
        verifyOtpTries: number;
        resetTokenExp: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
}
