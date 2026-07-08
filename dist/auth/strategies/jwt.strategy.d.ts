import { Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
declare const JwtStrategy_base: new (...args: any[]) => Strategy;
export declare class JwtStrategy extends JwtStrategy_base {
    private prisma;
    constructor(prisma: PrismaService);
    validate(payload: {
        sub: string;
        email: string;
    }): Promise<{
        id: string;
        name: string | null;
        email: string;
        verifyToken: string | null;
        country: string | null;
        phone: string | null;
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
}
export {};
