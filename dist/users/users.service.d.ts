import { PrismaService } from '../prisma/prisma.service';
export declare class UsersService {
    private prisma;
    constructor(prisma: PrismaService);
    findById(id: string): Promise<{
        id: string;
        name: string | null;
        email: string;
        password: string;
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
    findByEmail(email: string): Promise<{
        id: string;
        name: string | null;
        email: string;
        password: string;
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
