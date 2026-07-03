import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
type Platform = 'REDDIT' | 'QUORA' | 'INSTAGRAM' | 'FACEBOOK' | 'X';
export interface CollectParams {
    platform: Platform;
    keywords?: string[];
    urls?: string[];
    perInput?: number;
    trigger?: 'manual' | 'scheduled';
}
export declare class BrightDataService {
    private prisma;
    private ai;
    private readonly logger;
    private readonly key;
    constructor(prisma: PrismaService, ai: AiService);
    private readonly cancelled;
    private categorize;
    configured(): boolean;
    cancel(id: string): Promise<{
        ok: boolean;
        reason: string;
        cancelled?: undefined;
    } | {
        ok: boolean;
        cancelled: boolean;
        reason?: undefined;
    }>;
    jobDetails(jobId: string): Promise<{
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
            inputs: Prisma.JsonValue;
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
    spentCredits(): Promise<number>;
    remainingCredits(): Promise<number>;
    budget(): Promise<{
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
    }>;
    private balanceCache;
    accountBalance(): Promise<{
        configured: true;
        balance: number;
        pendingBalance: number;
        available: number;
    }>;
    private post;
    private get;
    private downloadSnapshot;
    private buildTrigger;
    collect(p: CollectParams): Promise<{
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
        inputs: Prisma.JsonValue;
        records: number;
        saved: number;
        creditsApprox: number;
    }>;
    private serpSearch;
    collectSerp(p: CollectParams): Promise<{
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
        inputs: Prisma.JsonValue;
        records: number;
        saved: number;
        creditsApprox: number;
    }>;
    private runSerp;
    private run;
    private extract;
    private saveRecords;
    listCaptures(params: {
        page?: number;
        pageSize?: number;
        platform?: string;
        category?: string;
        temperature?: string;
        minSignals?: number;
        q?: string;
        includeDeleted?: boolean;
        includeSpam?: boolean;
        sort?: string;
    }): Promise<{
        items: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            procedures: Prisma.JsonValue | null;
            title: string | null;
            raw: Prisma.JsonValue;
            category: import(".prisma/client").$Enums.LeadCategory | null;
            externalId: string;
            url: string | null;
            intentScore: number;
            categoryReason: string | null;
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
            origins: Prisma.JsonValue | null;
            isSpam: boolean;
            jobId: string | null;
            keyword: string | null;
            comments: Prisma.JsonValue | null;
            commentsStatus: string | null;
            commentsFetchedAt: Date | null;
            deletedAt: Date | null;
        }[];
        total: number;
        page: number;
        pageSize: number;
        pageCount: number;
    }>;
    captureStats(platform?: string): Promise<{
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
    private static readonly CATEGORIES;
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
    private mapCapturePost;
    private mapLeadPost;
    analyticsPosts(params: {
        category?: string;
        platform?: string;
        q?: string;
        page?: number;
        pageSize?: number;
    }): Promise<{
        items: any[];
        total: number;
        page: number;
        pageSize: number;
        pageCount: number;
    }>;
    categorizeStatus(): {
        running: boolean;
        processed: number;
        total: number;
        updated: number;
        byCategory: Record<string, number>;
        error: string | null;
        startedAt: string | null;
        finishedAt: string | null;
    };
    startCategorize(opts?: {
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
    private runCategorize;
    listJobs(): Prisma.PrismaPromise<{
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
        inputs: Prisma.JsonValue;
        records: number;
        saved: number;
        creditsApprox: number;
    }[]>;
    softDelete(id: string): Promise<{
        ok: boolean;
        softDeleted: boolean;
    }>;
    restore(id: string): Promise<{
        ok: boolean;
        restored: boolean;
    }>;
    getCapture(id: string): Prisma.Prisma__SourceCaptureClient<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        procedures: Prisma.JsonValue | null;
        title: string | null;
        raw: Prisma.JsonValue;
        category: import(".prisma/client").$Enums.LeadCategory | null;
        externalId: string;
        url: string | null;
        intentScore: number;
        categoryReason: string | null;
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
        origins: Prisma.JsonValue | null;
        isSpam: boolean;
        jobId: string | null;
        keyword: string | null;
        comments: Prisma.JsonValue | null;
        commentsStatus: string | null;
        commentsFetchedAt: Date | null;
        deletedAt: Date | null;
    }, null, import("@prisma/client/runtime/library").DefaultArgs>;
    fetchComments(id: string): Promise<{
        status: string;
    }>;
    private runComments;
    private sleep;
}
export {};
