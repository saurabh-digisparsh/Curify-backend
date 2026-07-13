import { LeadsService, GenerateParams } from './leads.service';
import { BrightDataService, CollectParams } from './brightdata.service';
export declare class LeadsController {
    private readonly leads;
    private readonly brightData;
    constructor(leads: LeadsService, brightData: BrightDataService);
    config(): {
        sources: {
            key: string;
            label: string;
            enabled: boolean;
        }[];
        regions: {
            key: string;
            label: string;
        }[];
        queryGroups: string[];
        personas: {
            key: string;
            label: string;
        }[];
    };
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
            params: import("@prisma/client/runtime/library").JsonValue | null;
            id: string;
            createdAt: Date;
            status: string;
            created: number;
            updated: number;
            startedAt: Date | null;
            finishedAt: Date | null;
            trigger: string | null;
            source: import(".prisma/client").$Enums.LeadSource;
            quotaUsed: number;
            found: number;
            aiClassified: number;
        };
    }>;
    jobs(): import(".prisma/client").Prisma.PrismaPromise<{
        error: string | null;
        params: import("@prisma/client/runtime/library").JsonValue | null;
        id: string;
        createdAt: Date;
        status: string;
        created: number;
        updated: number;
        startedAt: Date | null;
        finishedAt: Date | null;
        trigger: string | null;
        source: import(".prisma/client").$Enums.LeadSource;
        quotaUsed: number;
        found: number;
        aiClassified: number;
    }[]>;
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
    cancelJob(kind: string, id: string): Promise<{
        ok: boolean;
        reason: string;
        cancelled?: undefined;
    } | {
        ok: boolean;
        cancelled: boolean;
        reason?: undefined;
    }>;
    jobDetails(kind: string, id: string): Promise<{
        job: {
            error: string | null;
            params: import("@prisma/client/runtime/library").JsonValue | null;
            id: string;
            createdAt: Date;
            status: string;
            created: number;
            updated: number;
            startedAt: Date | null;
            finishedAt: Date | null;
            trigger: string | null;
            source: import(".prisma/client").$Enums.LeadSource;
            quotaUsed: number;
            found: number;
            aiClassified: number;
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
    }> | Promise<{
        job: {
            error: string | null;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: string;
            mode: string;
            startedAt: Date | null;
            finishedAt: Date | null;
            trigger: string | null;
            platform: import(".prisma/client").$Enums.CapturePlatform;
            datasetId: string;
            snapshotId: string | null;
            inputs: import("@prisma/client/runtime/library").JsonValue;
            records: number;
            saved: number;
            creditsApprox: number;
        };
        kind: string;
        summary: {
            total: number;
            accepted: number;
            rejected: number;
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
        }[];
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
    captured(page?: string, pageSize?: string, source?: string, qualified?: string, scored?: string, minScore?: string, dropReason?: string, q?: string, sort?: string): Promise<{
        items: {
            query: string | null;
            id: string;
            description: string | null;
            region: import(".prisma/client").$Enums.LeadRegion;
            lang: string | null;
            title: string;
            source: import(".prisma/client").$Enums.LeadSource;
            viewCount: number | null;
            regionCode: string | null;
            channelId: string | null;
            channelTitle: string | null;
            publishedAt: Date | null;
            thumbnailUrl: string | null;
            isShort: boolean;
            likeCount: number | null;
            commentCount: number | null;
            aiProcedure: string | null;
            externalId: string;
            url: string;
            intentScore: number;
            matchedKeywords: import("@prisma/client/runtime/library").JsonValue | null;
            aiLead: boolean | null;
            aiConfidence: number | null;
            aiPersona: string | null;
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
    list(page?: string, pageSize?: string, source?: string, region?: string, status?: string, type?: 'video' | 'short', minScore?: string, aiOnly?: string, persona?: string, q?: string, sort?: string): Promise<{
        items: {
            query: string | null;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            status: import(".prisma/client").$Enums.LeadStatus;
            notes: string | null;
            region: import(".prisma/client").$Enums.LeadRegion;
            lang: string | null;
            title: string;
            category: import(".prisma/client").$Enums.LeadCategory | null;
            source: import(".prisma/client").$Enums.LeadSource;
            viewCount: number | null;
            regionCode: string | null;
            channelId: string | null;
            channelTitle: string | null;
            publishedAt: Date | null;
            thumbnailUrl: string | null;
            isShort: boolean;
            likeCount: number | null;
            commentCount: number | null;
            aiProcedure: string | null;
            externalId: string;
            url: string;
            intentScore: number;
            matchedKeywords: import("@prisma/client/runtime/library").JsonValue | null;
            transcript: string | null;
            aiLead: boolean | null;
            aiConfidence: number | null;
            aiPersona: string | null;
            aiSummary: string | null;
            categoryReason: string | null;
            categoryConfidence: number | null;
            categoryVotes: import("@prisma/client/runtime/library").JsonValue | null;
            needsReview: boolean;
            reviewedBy: string | null;
            reviewedAt: Date | null;
            categorizedAt: Date | null;
        }[];
        total: number;
        page: number;
        pageSize: number;
        pageCount: number;
    }>;
    generate(body: GenerateParams): Promise<{
        error: string | null;
        params: import("@prisma/client/runtime/library").JsonValue | null;
        id: string;
        createdAt: Date;
        status: string;
        created: number;
        updated: number;
        startedAt: Date | null;
        finishedAt: Date | null;
        trigger: string | null;
        source: import(".prisma/client").$Enums.LeadSource;
        quotaUsed: number;
        found: number;
        aiClassified: number;
    }>;
    update(id: string, body: {
        status?: string;
        notes?: string;
    }): Promise<{
        query: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        status: import(".prisma/client").$Enums.LeadStatus;
        notes: string | null;
        region: import(".prisma/client").$Enums.LeadRegion;
        lang: string | null;
        title: string;
        category: import(".prisma/client").$Enums.LeadCategory | null;
        source: import(".prisma/client").$Enums.LeadSource;
        viewCount: number | null;
        regionCode: string | null;
        channelId: string | null;
        channelTitle: string | null;
        publishedAt: Date | null;
        thumbnailUrl: string | null;
        isShort: boolean;
        likeCount: number | null;
        commentCount: number | null;
        aiProcedure: string | null;
        externalId: string;
        url: string;
        intentScore: number;
        matchedKeywords: import("@prisma/client/runtime/library").JsonValue | null;
        transcript: string | null;
        aiLead: boolean | null;
        aiConfidence: number | null;
        aiPersona: string | null;
        aiSummary: string | null;
        categoryReason: string | null;
        categoryConfidence: number | null;
        categoryVotes: import("@prisma/client/runtime/library").JsonValue | null;
        needsReview: boolean;
        reviewedBy: string | null;
        reviewedAt: Date | null;
        categorizedAt: Date | null;
    }>;
    remove(id: string): Promise<{
        ok: boolean;
    }>;
    brightDataStats(platform?: string): Promise<{
        total: number;
        softDeleted: number;
        spam: number;
        budget: {
            cap: number;
            spent: number;
            remaining: number;
            account: {
                configured: true;
                balance: number;
                pendingBalance: number;
                available: number;
            } | {
                configured: false;
            };
        };
        platform: string;
        byPlatform: {
            [k: string]: number;
        };
        byTemperature: {
            [k: string]: number;
        };
        byCategory: Record<string, number>;
    }>;
    brightDataJobs(): import(".prisma/client").Prisma.PrismaPromise<{
        error: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        mode: string;
        startedAt: Date | null;
        finishedAt: Date | null;
        trigger: string | null;
        platform: import(".prisma/client").$Enums.CapturePlatform;
        datasetId: string;
        snapshotId: string | null;
        inputs: import("@prisma/client/runtime/library").JsonValue;
        records: number;
        saved: number;
        creditsApprox: number;
    }[]>;
    analytics(bucket?: 'day' | 'month' | 'quarter' | 'year'): Promise<{
        total: number;
        categorized: number;
        uncategorized: number;
        categories: readonly ["LEAD", "PARTNER", "MARKETING", "NEWS", "OTHER"];
        byCategory: Record<string, number>;
        byPlatform: Record<string, Record<string, number>>;
        bucket: "day" | "month" | "quarter" | "year";
        series: any[];
        classify: {
            running: boolean;
            processed: number;
            total: number;
            updated: number;
            byCategory: Record<string, number>;
            error: string | null;
            startedAt: string | null;
            finishedAt: string | null;
        };
    }>;
    classify(body: {
        reclassify?: boolean;
        limit?: number;
    }): Promise<{
        ok: boolean;
        reason: string;
        progress: {
            running: boolean;
            processed: number;
            total: number;
            updated: number;
            byCategory: Record<string, number>;
            error: string | null;
            startedAt: string | null;
            finishedAt: string | null;
        };
        nothing?: undefined;
        started?: undefined;
    } | {
        ok: boolean;
        nothing: boolean;
        progress: {
            running: boolean;
            processed: number;
            total: number;
            updated: number;
            byCategory: Record<string, number>;
            error: string | null;
            startedAt: string | null;
            finishedAt: string | null;
        };
        reason?: undefined;
        started?: undefined;
    } | {
        ok: boolean;
        started: boolean;
        progress: {
            running: boolean;
            processed: number;
            total: number;
            updated: number;
            byCategory: Record<string, number>;
            error: string | null;
            startedAt: string | null;
            finishedAt: string | null;
        };
        reason?: undefined;
        nothing?: undefined;
    }>;
    classifyStatus(): {
        running: boolean;
        processed: number;
        total: number;
        updated: number;
        byCategory: Record<string, number>;
        error: string | null;
        startedAt: string | null;
        finishedAt: string | null;
    };
    rescore(): Promise<{
        scanned: number;
        updated: number;
    }>;
    resetReclassify(): Promise<any>;
    scorecard(): Promise<{
        total: number;
        accuracy: number;
        categories: string[];
        matrix: Record<string, Record<string, number>>;
        metrics: {
            category: string;
            support: number;
            precision: number;
            recall: number;
            f1: number;
        }[];
    }>;
    analyticsPosts(category?: string, platform?: string, q?: string, page?: string, pageSize?: string): Promise<{
        items: any[];
        total: number;
        page: number;
        pageSize: number;
        pageCount: number;
    }>;
    captures(page?: string, pageSize?: string, platform?: string, category?: string, temperature?: string, minSignals?: string, q?: string, includeDeleted?: string, includeSpam?: string, sort?: string, needsReview?: string): Promise<{
        items: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            procedures: import("@prisma/client/runtime/library").JsonValue | null;
            title: string | null;
            raw: import("@prisma/client/runtime/library").JsonValue;
            category: import(".prisma/client").$Enums.LeadCategory | null;
            externalId: string;
            url: string | null;
            intentScore: number;
            categoryReason: string | null;
            categoryConfidence: number | null;
            categoryVotes: import("@prisma/client/runtime/library").JsonValue | null;
            needsReview: boolean;
            reviewedBy: string | null;
            reviewedAt: Date | null;
            categorizedAt: Date | null;
            platform: import(".prisma/client").$Enums.CapturePlatform;
            datasetId: string | null;
            snapshotId: string | null;
            body: string | null;
            author: string | null;
            postedAt: Date | null;
            hasProcedure: boolean;
            hasCost: boolean;
            hasOrigin: boolean;
            signalCount: number;
            temperature: string | null;
            origins: import("@prisma/client/runtime/library").JsonValue | null;
            isSpam: boolean;
            aiCategory: import(".prisma/client").$Enums.LeadCategory | null;
            jobId: string | null;
            keyword: string | null;
            comments: import("@prisma/client/runtime/library").JsonValue | null;
            commentsStatus: string | null;
            commentsFetchedAt: Date | null;
            deletedAt: Date | null;
        }[];
        total: number;
        page: number;
        pageSize: number;
        pageCount: number;
    }>;
    collect(body: CollectParams): Promise<{
        error: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        mode: string;
        startedAt: Date | null;
        finishedAt: Date | null;
        trigger: string | null;
        platform: import(".prisma/client").$Enums.CapturePlatform;
        datasetId: string;
        snapshotId: string | null;
        inputs: import("@prisma/client/runtime/library").JsonValue;
        records: number;
        saved: number;
        creditsApprox: number;
    }>;
    capture(id: string): import(".prisma/client").Prisma.Prisma__SourceCaptureClient<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        procedures: import("@prisma/client/runtime/library").JsonValue | null;
        title: string | null;
        raw: import("@prisma/client/runtime/library").JsonValue;
        category: import(".prisma/client").$Enums.LeadCategory | null;
        externalId: string;
        url: string | null;
        intentScore: number;
        categoryReason: string | null;
        categoryConfidence: number | null;
        categoryVotes: import("@prisma/client/runtime/library").JsonValue | null;
        needsReview: boolean;
        reviewedBy: string | null;
        reviewedAt: Date | null;
        categorizedAt: Date | null;
        platform: import(".prisma/client").$Enums.CapturePlatform;
        datasetId: string | null;
        snapshotId: string | null;
        body: string | null;
        author: string | null;
        postedAt: Date | null;
        hasProcedure: boolean;
        hasCost: boolean;
        hasOrigin: boolean;
        signalCount: number;
        temperature: string | null;
        origins: import("@prisma/client/runtime/library").JsonValue | null;
        isSpam: boolean;
        aiCategory: import(".prisma/client").$Enums.LeadCategory | null;
        jobId: string | null;
        keyword: string | null;
        comments: import("@prisma/client/runtime/library").JsonValue | null;
        commentsStatus: string | null;
        commentsFetchedAt: Date | null;
        deletedAt: Date | null;
    }, null, import("@prisma/client/runtime/library").DefaultArgs>;
    fetchComments(id: string): Promise<{
        status: string;
    }>;
    softDeleteCapture(id: string): Promise<{
        ok: boolean;
        softDeleted: boolean;
    }>;
    reviewCategory(id: string, body: {
        category: string;
    }, req: any): Promise<{
        ok: boolean;
        id: string;
        category: "OTHER" | "LEAD" | "PARTNER" | "MARKETING" | "NEWS";
    }>;
    restoreCapture(id: string): Promise<{
        ok: boolean;
        restored: boolean;
    }>;
}
