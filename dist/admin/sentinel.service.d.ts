import { OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
export type SentinelHit = 'RATE_LIMIT' | 'BLOCKED';
export declare class SentinelService implements OnModuleInit {
    private prisma;
    private readonly logger;
    private readonly blocked;
    constructor(prisma: PrismaService);
    onModuleInit(): Promise<void>;
    isBlocked(ip: string): boolean;
    record(type: SentinelHit, meta: {
        ip: string;
        path?: string;
        method?: string;
        userAgent?: string;
    }): Promise<void>;
    block(ip: string, reason?: string, by?: string): Promise<{
        id: string;
        ip: string;
        lastPath: string | null;
        lastMethod: string | null;
        lastUserAgent: string | null;
        rateLimitHits: number;
        blockedHits: number;
        totalHits: number;
        blocked: boolean;
        blockReason: string | null;
        blockedBy: string | null;
        blockedAt: Date | null;
        firstSeen: Date;
        lastSeen: Date;
    }>;
    unblock(ip: string): Promise<{
        id: string;
        ip: string;
        lastPath: string | null;
        lastMethod: string | null;
        lastUserAgent: string | null;
        rateLimitHits: number;
        blockedHits: number;
        totalHits: number;
        blocked: boolean;
        blockReason: string | null;
        blockedBy: string | null;
        blockedAt: Date | null;
        firstSeen: Date;
        lastSeen: Date;
    }>;
    overview(): Promise<{
        stats: {
            watched: number;
            blocked: number;
            rateLimitHits: number;
        };
        events: {
            id: string;
            ip: string;
            lastPath: string | null;
            lastMethod: string | null;
            lastUserAgent: string | null;
            rateLimitHits: number;
            blockedHits: number;
            totalHits: number;
            blocked: boolean;
            blockReason: string | null;
            blockedBy: string | null;
            blockedAt: Date | null;
            firstSeen: Date;
            lastSeen: Date;
        }[];
    }>;
}
