import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
export declare class RecoveryService {
    private prisma;
    private ai;
    constructor(prisma: PrismaService, ai: AiService);
    getProtocol(procedure: string): Promise<{
        id: string;
        procedure: string;
        checkIns: import("@prisma/client/runtime/library").JsonValue;
        tips: import("@prisma/client/runtime/library").JsonValue;
        handoff: import("@prisma/client/runtime/library").JsonValue;
    }>;
    generate(params: {
        diagnosis: string;
        treatment: string;
        hospital: string;
        surgeon: string;
    }): Promise<any>;
}
