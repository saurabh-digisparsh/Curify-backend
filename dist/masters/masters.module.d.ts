import { PrismaService } from '../prisma/prisma.service';
export declare class MastersService {
    private prisma;
    constructor(prisma: PrismaService);
    getAll(): Promise<{
        specialties: string[];
        qualifications: string[];
        languages: string[];
        timezones: {
            name: string;
            label: string;
        }[];
    }>;
}
export declare class MastersController {
    private readonly svc;
    constructor(svc: MastersService);
    all(): Promise<{
        specialties: string[];
        qualifications: string[];
        languages: string[];
        timezones: {
            name: string;
            label: string;
        }[];
    }>;
}
export declare class MastersModule {
}
