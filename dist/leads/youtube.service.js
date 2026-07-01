"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuotaExceededError = exports.YouTubeService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const youtube_transcript_1 = require("youtube-transcript");
const leads_config_1 = require("./leads.config");
const YT_BASE = 'https://www.googleapis.com/youtube/v3';
function parseDuration(iso) {
    const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || '');
    if (!m)
        return 0;
    return (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0));
}
let YouTubeService = class YouTubeService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger('YouTube');
        this.key = process.env.YOUTUBE_API_KEY_1 || process.env.YOUTUBE_API_KEY;
    }
    configured() {
        return !!this.key && this.key !== 'your_youtube_api_key_here';
    }
    today() {
        return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
    }
    async quotaStatus() {
        const day = this.today();
        const row = await this.prisma.apiQuotaUsage.findUnique({ where: { provider_day: { provider: 'youtube', day } } });
        const used = row?.unitsUsed ?? 0;
        return { day, used, cap: leads_config_1.YT_QUOTA_CAP, remaining: Math.max(0, leads_config_1.YT_QUOTA_CAP - used) };
    }
    async resetDailyQuota() {
        const day = this.today();
        const row = await this.prisma.apiQuotaUsage.findUnique({ where: { provider_day: { provider: 'youtube', day } } });
        const previousUnits = row?.unitsUsed ?? 0;
        await this.prisma.apiQuotaUsage.upsert({
            where: { provider_day: { provider: 'youtube', day } },
            create: { provider: 'youtube', day, unitsUsed: 0 },
            update: { unitsUsed: 0 },
        });
        this.logger.log(`Daily quota counter reset to 0 for ${day} (America/Los_Angeles); was ${previousUnits}`);
        return { day, previousUnits };
    }
    async reserve(cost) {
        const day = this.today();
        const { used } = await this.quotaStatus();
        if (used + cost > leads_config_1.YT_QUOTA_CAP) {
            this.logger.warn(`Quota cap reached (${used}/${leads_config_1.YT_QUOTA_CAP}); refusing ${cost}-unit call`);
            return false;
        }
        await this.prisma.apiQuotaUsage.upsert({
            where: { provider_day: { provider: 'youtube', day } },
            create: { provider: 'youtube', day, unitsUsed: cost },
            update: { unitsUsed: { increment: cost } },
        });
        return true;
    }
    async refund(cost) {
        const day = this.today();
        const row = await this.prisma.apiQuotaUsage.findUnique({ where: { provider_day: { provider: 'youtube', day } } });
        if (!row)
            return;
        await this.prisma.apiQuotaUsage.update({
            where: { provider_day: { provider: 'youtube', day } },
            data: { unitsUsed: Math.max(0, row.unitsUsed - cost) },
        });
    }
    async search(query, opts = {}) {
        if (!this.configured())
            throw new Error('YOUTUBE_API_KEY not configured');
        if (!(await this.reserve(leads_config_1.YT_SEARCH_COST)))
            throw new QuotaExceededError();
        const params = new URLSearchParams({
            key: this.key,
            part: 'snippet',
            q: query,
            type: 'video',
            maxResults: String(Math.min(50, opts.maxResults ?? 25)),
            order: opts.order ?? 'relevance',
            safeSearch: 'none',
        });
        if (opts.regionCode)
            params.set('regionCode', opts.regionCode);
        if (opts.relevanceLanguage)
            params.set('relevanceLanguage', opts.relevanceLanguage);
        if (opts.videoDuration)
            params.set('videoDuration', opts.videoDuration);
        if (opts.publishedAfter)
            params.set('publishedAfter', opts.publishedAfter);
        if (opts.pageToken)
            params.set('pageToken', opts.pageToken);
        let res;
        try {
            res = await fetch(`${YT_BASE}/search?${params}`);
        }
        catch (e) {
            await this.refund(leads_config_1.YT_SEARCH_COST);
            throw e;
        }
        if (!res.ok) {
            const body = await res.text();
            if (!(res.status === 403 && /quota/i.test(body)))
                await this.refund(leads_config_1.YT_SEARCH_COST);
            throw new Error(`YouTube search failed (${res.status}): ${body.slice(0, 200)}`);
        }
        const data = await res.json();
        const videos = (data.items || [])
            .filter((it) => it.id?.videoId)
            .map((it) => ({
            videoId: it.id.videoId,
            title: it.snippet?.title ?? '',
            description: it.snippet?.description ?? '',
            channelId: it.snippet?.channelId ?? '',
            channelTitle: it.snippet?.channelTitle ?? '',
            publishedAt: it.snippet?.publishedAt ?? '',
            thumbnailUrl: it.snippet?.thumbnails?.medium?.url ?? it.snippet?.thumbnails?.default?.url ?? '',
        }));
        return { videos, nextPageToken: data.nextPageToken };
    }
    async channelCountries(channelIds) {
        const out = {};
        const uniq = [...new Set(channelIds.filter(Boolean))];
        if (!uniq.length || !this.configured())
            return out;
        for (let i = 0; i < uniq.length; i += 50) {
            const batch = uniq.slice(i, i + 50);
            if (!(await this.reserve(leads_config_1.YT_VIDEOS_COST)))
                break;
            const params = new URLSearchParams({ key: this.key, part: 'snippet', id: batch.join(','), maxResults: '50' });
            const res = await fetch(`${YT_BASE}/channels?${params}`);
            if (!res.ok)
                continue;
            const data = await res.json();
            for (const it of data.items || [])
                out[it.id] = it.snippet?.country || '';
        }
        return out;
    }
    async getTranscript(videoId, maxChars = 12000) {
        try {
            const segments = await youtube_transcript_1.YoutubeTranscript.fetchTranscript(videoId);
            const text = segments.map((s) => s.text).join(' ').replace(/\s+/g, ' ').trim();
            return text ? text.slice(0, maxChars) : null;
        }
        catch {
            return null;
        }
    }
    async videoDetails(ids) {
        const out = {};
        if (!ids.length || !this.configured())
            return out;
        for (let i = 0; i < ids.length; i += 50) {
            const batch = ids.slice(i, i + 50);
            if (!(await this.reserve(leads_config_1.YT_VIDEOS_COST)))
                break;
            const params = new URLSearchParams({
                key: this.key,
                part: 'statistics,contentDetails',
                id: batch.join(','),
                maxResults: '50',
            });
            const res = await fetch(`${YT_BASE}/videos?${params}`);
            if (!res.ok)
                continue;
            const data = await res.json();
            for (const it of data.items || []) {
                const durationSec = parseDuration(it.contentDetails?.duration);
                out[it.id] = {
                    durationSec,
                    isShort: durationSec > 0 && durationSec <= 180,
                    viewCount: it.statistics?.viewCount ? +it.statistics.viewCount : undefined,
                    likeCount: it.statistics?.likeCount ? +it.statistics.likeCount : undefined,
                    commentCount: it.statistics?.commentCount ? +it.statistics.commentCount : undefined,
                };
            }
        }
        return out;
    }
};
exports.YouTubeService = YouTubeService;
exports.YouTubeService = YouTubeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], YouTubeService);
class QuotaExceededError extends Error {
    constructor() {
        super('Daily YouTube quota cap reached');
        this.name = 'QuotaExceededError';
    }
}
exports.QuotaExceededError = QuotaExceededError;
//# sourceMappingURL=youtube.service.js.map