import { Request } from 'express';
import { SentinelService } from './sentinel.service';
export declare class SentinelController {
    private readonly sentinel;
    constructor(sentinel: SentinelService);
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
    block(body: {
        ip: string;
        reason?: string;
    }, req: Request): Promise<{
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
    unblock(body: {
        ip: string;
    }): Promise<{
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
}
