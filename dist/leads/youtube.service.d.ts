import { PrismaService } from '../prisma/prisma.service';
export interface YtSearchOpts {
    regionCode?: string;
    relevanceLanguage?: string;
    videoDuration?: 'any' | 'short' | 'medium' | 'long';
    publishedAfter?: string;
    maxResults?: number;
    order?: 'relevance' | 'date' | 'viewCount';
    pageToken?: string;
}
export interface YtVideo {
    videoId: string;
    title: string;
    description: string;
    channelId: string;
    channelTitle: string;
    publishedAt: string;
    thumbnailUrl: string;
    isShort?: boolean;
    viewCount?: number;
    likeCount?: number;
    commentCount?: number;
    durationSec?: number;
}
export declare class YouTubeService {
    private prisma;
    private readonly logger;
    private readonly key;
    constructor(prisma: PrismaService);
    configured(): boolean;
    private today;
    quotaStatus(): Promise<{
        day: string;
        used: number;
        cap: number;
        remaining: number;
    }>;
    resetDailyQuota(): Promise<{
        day: string;
        previousUnits: number;
    }>;
    private reserve;
    private refund;
    search(query: string, opts?: YtSearchOpts): Promise<{
        videos: YtVideo[];
        nextPageToken?: string;
    }>;
    channelCountries(channelIds: string[]): Promise<Record<string, string>>;
    getTranscript(videoId: string, maxChars?: number): Promise<string | null>;
    videoDetails(ids: string[]): Promise<Record<string, Partial<YtVideo>>>;
}
export declare class QuotaExceededError extends Error {
    constructor();
}
