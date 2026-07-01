import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { YouTubeService } from './youtube.service';
import { RegionKey } from './leads.config';
export interface GenerateParams {
    regions?: RegionKey[];
    queryGroups?: string[];
    maxSearches?: number;
    minScore?: number;
    aiClassify?: boolean;
    order?: 'date' | 'relevance';
    global?: boolean;
    targetCount?: number;
    trigger?: 'manual' | 'scheduled';
}
export declare class LeadsService {
    private prisma;
    private yt;
    private ai;
    private readonly logger;
    private readonly cancelled;
    constructor(prisma: PrismaService, yt: YouTubeService, ai: AiService);
    sources(): {
        key: string;
        label: string;
        enabled: boolean;
    }[];
    list(params: {
        page?: number;
        pageSize?: number;
        source?: string;
        region?: string;
        status?: string;
        type?: 'video' | 'short';
        minScore?: number;
        aiOnly?: boolean;
        persona?: string;
        q?: string;
        sort?: string;
    }): Promise<{
        items: {
            query: string | null;
            id: string;
            source: import(".prisma/client").$Enums.LeadSource;
            externalId: string;
            title: string;
            description: string | null;
            url: string;
            thumbnailUrl: string | null;
            channelId: string | null;
            channelTitle: string | null;
            publishedAt: Date | null;
            isShort: boolean;
            region: import(".prisma/client").$Enums.LeadRegion;
            regionCode: string | null;
            lang: string | null;
            viewCount: number | null;
            likeCount: number | null;
            commentCount: number | null;
            intentScore: number;
            matchedKeywords: Prisma.JsonValue | null;
            transcript: string | null;
            aiLead: boolean | null;
            aiConfidence: number | null;
            aiPersona: string | null;
            aiProcedure: string | null;
            aiSummary: string | null;
            category: import(".prisma/client").$Enums.LeadCategory | null;
            categoryReason: string | null;
            categorizedAt: Date | null;
            status: import(".prisma/client").$Enums.LeadStatus;
            notes: string | null;
            createdAt: Date;
            updatedAt: Date;
        }[];
        total: number;
        page: number;
        pageSize: number;
        pageCount: number;
    }>;
    stats(): Promise<{
        total: number;
        byStatus: {
            [k: string]: number;
        };
        byRegion: {
            [k: string]: number;
        };
        quota: {
            configured: boolean;
            day: string;
            used: number;
            cap: number;
            remaining: number;
        };
        lastJob: {
            error: string | null;
            id: string;
            source: import(".prisma/client").$Enums.LeadSource;
            status: string;
            createdAt: Date;
            trigger: string | null;
            params: Prisma.JsonValue | null;
            quotaUsed: number;
            found: number;
            created: number;
            updated: number;
            aiClassified: number;
            startedAt: Date | null;
            finishedAt: Date | null;
        };
    }>;
    update(id: string, data: {
        status?: string;
        notes?: string;
    }): Promise<{
        query: string | null;
        id: string;
        source: import(".prisma/client").$Enums.LeadSource;
        externalId: string;
        title: string;
        description: string | null;
        url: string;
        thumbnailUrl: string | null;
        channelId: string | null;
        channelTitle: string | null;
        publishedAt: Date | null;
        isShort: boolean;
        region: import(".prisma/client").$Enums.LeadRegion;
        regionCode: string | null;
        lang: string | null;
        viewCount: number | null;
        likeCount: number | null;
        commentCount: number | null;
        intentScore: number;
        matchedKeywords: Prisma.JsonValue | null;
        transcript: string | null;
        aiLead: boolean | null;
        aiConfidence: number | null;
        aiPersona: string | null;
        aiProcedure: string | null;
        aiSummary: string | null;
        category: import(".prisma/client").$Enums.LeadCategory | null;
        categoryReason: string | null;
        categorizedAt: Date | null;
        status: import(".prisma/client").$Enums.LeadStatus;
        notes: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    remove(id: string): Promise<{
        ok: boolean;
    }>;
    listJobs(): Prisma.PrismaPromise<{
        error: string | null;
        id: string;
        source: import(".prisma/client").$Enums.LeadSource;
        status: string;
        createdAt: Date;
        trigger: string | null;
        params: Prisma.JsonValue | null;
        quotaUsed: number;
        found: number;
        created: number;
        updated: number;
        aiClassified: number;
        startedAt: Date | null;
        finishedAt: Date | null;
    }[]>;
    cancel(id: string): Promise<{
        ok: boolean;
        reason: string;
        cancelled?: undefined;
    } | {
        ok: boolean;
        cancelled: boolean;
        reason?: undefined;
    }>;
    allJobs(): Promise<({
        kind: "youtube";
        id: string;
        platform: string;
        label: string;
        mode: string;
        status: string;
        trigger: string;
        found: number;
        saved: number;
        updated: number;
        error: string;
        createdAt: Date;
        startedAt: Date;
        finishedAt: Date;
    } | {
        kind: "brightdata";
        id: string;
        platform: import(".prisma/client").$Enums.CapturePlatform;
        label: import(".prisma/client").$Enums.CapturePlatform;
        mode: string;
        status: string;
        trigger: string;
        found: number;
        saved: number;
        updated: number;
        error: string;
        createdAt: Date;
        startedAt: Date;
        finishedAt: Date;
    })[]>;
    youtubeJobDetails(jobId: string): Promise<{
        job: {
            error: string | null;
            id: string;
            source: import(".prisma/client").$Enums.LeadSource;
            status: string;
            createdAt: Date;
            trigger: string | null;
            params: Prisma.JsonValue | null;
            quotaUsed: number;
            found: number;
            created: number;
            updated: number;
            aiClassified: number;
            startedAt: Date | null;
            finishedAt: Date | null;
        };
        kind: string;
        summary: {
            total: number;
            accepted: number;
            rejected: number;
            belowFloorSkipped: number;
        };
        results: {
            source: string;
            title: string;
            score: number;
            outcome: string;
            reason: string;
            phases: {
                name: string;
                status: string;
                detail: string;
            }[];
            persona: string;
            procedure: string;
        }[];
    }>;
    listCaptured(params: {
        page?: number;
        pageSize?: number;
        source?: string;
        qualified?: boolean;
        scored?: boolean;
        minScore?: number;
        dropReason?: string;
        q?: string;
        sort?: string;
    }): Promise<{
        items: {
            query: string | null;
            id: string;
            source: import(".prisma/client").$Enums.LeadSource;
            externalId: string;
            title: string;
            description: string | null;
            url: string;
            thumbnailUrl: string | null;
            channelId: string | null;
            channelTitle: string | null;
            publishedAt: Date | null;
            isShort: boolean;
            region: import(".prisma/client").$Enums.LeadRegion;
            regionCode: string | null;
            lang: string | null;
            viewCount: number | null;
            likeCount: number | null;
            commentCount: number | null;
            intentScore: number;
            matchedKeywords: Prisma.JsonValue | null;
            aiLead: boolean | null;
            aiConfidence: number | null;
            aiPersona: string | null;
            aiProcedure: string | null;
            aiSummary: string | null;
            scored: boolean;
            qualified: boolean;
            dropReason: string | null;
            lastJobId: string | null;
            timesSeen: number;
            firstSeenAt: Date;
            lastSeenAt: Date;
        }[];
        total: number;
        page: number;
        pageSize: number;
        pageCount: number;
    }>;
    capturedStats(): Promise<{
        total: number;
        scored: number;
        qualified: number;
        byDropReason: {
            [k: string]: number;
        };
        bySource: {
            [k: string]: number;
        };
    }>;
    private captureVideo;
    generate(params: GenerateParams): Promise<{
        error: string | null;
        id: string;
        source: import(".prisma/client").$Enums.LeadSource;
        status: string;
        createdAt: Date;
        trigger: string | null;
        params: Prisma.JsonValue | null;
        quotaUsed: number;
        found: number;
        created: number;
        updated: number;
        aiClassified: number;
        startedAt: Date | null;
        finishedAt: Date | null;
    }>;
    private runJob;
}
