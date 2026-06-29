import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { YoutubeTranscript } from 'youtube-transcript';
import { YT_QUOTA_CAP, YT_SEARCH_COST, YT_VIDEOS_COST } from './leads.config';

const YT_BASE = 'https://www.googleapis.com/youtube/v3';

export interface YtSearchOpts {
  regionCode?: string;
  relevanceLanguage?: string;
  videoDuration?: 'any' | 'short' | 'medium' | 'long';
  publishedAfter?: string; // ISO
  maxResults?: number; // <= 50
  order?: 'relevance' | 'date' | 'viewCount';
  pageToken?: string; // for deeper paging beyond the first 50
}

export interface YtVideo {
  videoId: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  thumbnailUrl: string;
  // filled by videoDetails()
  isShort?: boolean;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  durationSec?: number;
}

/** ISO 8601 duration (PT#H#M#S) → seconds. */
function parseDuration(iso: string): number {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || '');
  if (!m) return 0;
  return (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0));
}

@Injectable()
export class YouTubeService {
  private readonly logger = new Logger('YouTube');
  // Leads use the first YouTube key; the hospital scraper uses the second
  // (separate keys → separate daily quotas). Falls back to the legacy var name.
  private readonly key = process.env.YOUTUBE_API_KEY_1 || process.env.YOUTUBE_API_KEY;

  constructor(private prisma: PrismaService) {}

  configured(): boolean {
    return !!this.key && this.key !== 'your_youtube_api_key_here';
  }

  /** Pacific-day key — YouTube quota resets at midnight America/Los_Angeles. */
  private today(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }); // YYYY-MM-DD
  }

  /** Units used today + remaining headroom under the 70% cap. */
  async quotaStatus() {
    const day = this.today();
    const row = await this.prisma.apiQuotaUsage.findUnique({ where: { provider_day: { provider: 'youtube', day } } });
    const used = row?.unitsUsed ?? 0;
    return { day, used, cap: YT_QUOTA_CAP, remaining: Math.max(0, YT_QUOTA_CAP - used) };
  }

  /**
   * Explicitly zero today's quota counter. The counter already rolls over
   * implicitly (each Pacific day is a fresh key), but the midnight-Pacific cron
   * calls this so the reset is an explicit, logged event aligned to YouTube's
   * real quota reset — not a side effect of the day-key changing.
   */
  async resetDailyQuota(): Promise<{ day: string; previousUnits: number }> {
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

  /** Reserve `cost` units if they fit under the cap; returns false if they don't. */
  private async reserve(cost: number): Promise<boolean> {
    const day = this.today();
    const { used } = await this.quotaStatus();
    if (used + cost > YT_QUOTA_CAP) {
      this.logger.warn(`Quota cap reached (${used}/${YT_QUOTA_CAP}); refusing ${cost}-unit call`);
      return false;
    }
    await this.prisma.apiQuotaUsage.upsert({
      where: { provider_day: { provider: 'youtube', day } },
      create: { provider: 'youtube', day, unitsUsed: cost },
      update: { unitsUsed: { increment: cost } },
    });
    return true;
  }

  /** Give back reserved units when a call fails before Google could charge it (e.g. bad key, network error). */
  private async refund(cost: number): Promise<void> {
    const day = this.today();
    const row = await this.prisma.apiQuotaUsage.findUnique({ where: { provider_day: { provider: 'youtube', day } } });
    if (!row) return;
    await this.prisma.apiQuotaUsage.update({
      where: { provider_day: { provider: 'youtube', day } },
      data: { unitsUsed: Math.max(0, row.unitsUsed - cost) },
    });
  }

  /** search.list — returns up to maxResults videos + a nextPageToken for deeper paging. Costs 100 units. */
  async search(query: string, opts: YtSearchOpts = {}): Promise<{ videos: YtVideo[]; nextPageToken?: string }> {
    if (!this.configured()) throw new Error('YOUTUBE_API_KEY not configured');
    if (!(await this.reserve(YT_SEARCH_COST))) throw new QuotaExceededError();

    const params = new URLSearchParams({
      key: this.key!,
      part: 'snippet',
      q: query,
      type: 'video',
      maxResults: String(Math.min(50, opts.maxResults ?? 25)),
      order: opts.order ?? 'relevance',
      safeSearch: 'none',
    });
    if (opts.regionCode) params.set('regionCode', opts.regionCode);
    if (opts.relevanceLanguage) params.set('relevanceLanguage', opts.relevanceLanguage);
    if (opts.videoDuration) params.set('videoDuration', opts.videoDuration);
    if (opts.publishedAfter) params.set('publishedAfter', opts.publishedAfter);
    if (opts.pageToken) params.set('pageToken', opts.pageToken);

    let res: Response;
    try {
      res = await fetch(`${YT_BASE}/search?${params}`);
    } catch (e) {
      await this.refund(YT_SEARCH_COST); // network error — Google never saw the call
      throw e;
    }
    if (!res.ok) {
      const body = await res.text();
      // 403 with quota reason = real quota exhaustion (keep the charge); anything
      // else (bad key, 400) failed before Google charged — refund our reservation.
      if (!(res.status === 403 && /quota/i.test(body))) await this.refund(YT_SEARCH_COST);
      throw new Error(`YouTube search failed (${res.status}): ${body.slice(0, 200)}`);
    }
    const data: any = await res.json();
    const videos = (data.items || [])
      .filter((it: any) => it.id?.videoId)
      .map((it: any) => ({
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

  /** channels.list — map channelId → ISO country code (for region tagging in global search). 1 unit per ≤50 ids. */
  async channelCountries(channelIds: string[]): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    const uniq = [...new Set(channelIds.filter(Boolean))];
    if (!uniq.length || !this.configured()) return out;
    for (let i = 0; i < uniq.length; i += 50) {
      const batch = uniq.slice(i, i + 50);
      if (!(await this.reserve(YT_VIDEOS_COST))) break;
      const params = new URLSearchParams({ key: this.key!, part: 'snippet', id: batch.join(','), maxResults: '50' });
      const res = await fetch(`${YT_BASE}/channels?${params}`);
      if (!res.ok) continue;
      const data: any = await res.json();
      for (const it of data.items || []) out[it.id] = it.snippet?.country || '';
    }
    return out;
  }

  /**
   * Fetch a video's transcript/caption text (free — scrapes the public timedtext,
   * no API quota). Returns the joined text, or null when the video has no captions.
   */
  async getTranscript(videoId: string, maxChars = 12000): Promise<string | null> {
    try {
      const segments = await YoutubeTranscript.fetchTranscript(videoId);
      const text = segments.map((s) => s.text).join(' ').replace(/\s+/g, ' ').trim();
      return text ? text.slice(0, maxChars) : null;
    } catch {
      return null; // no captions / disabled / unavailable
    }
  }

  /** videos.list — enrich with stats + duration (Shorts ≈ ≤60s). Costs 1 unit per ≤50 ids. */
  async videoDetails(ids: string[]): Promise<Record<string, Partial<YtVideo>>> {
    const out: Record<string, Partial<YtVideo>> = {};
    if (!ids.length || !this.configured()) return out;
    for (let i = 0; i < ids.length; i += 50) {
      const batch = ids.slice(i, i + 50);
      if (!(await this.reserve(YT_VIDEOS_COST))) break; // out of quota — return what we have
      const params = new URLSearchParams({
        key: this.key!,
        part: 'statistics,contentDetails',
        id: batch.join(','),
        maxResults: '50',
      });
      const res = await fetch(`${YT_BASE}/videos?${params}`);
      if (!res.ok) continue;
      const data: any = await res.json();
      for (const it of data.items || []) {
        const durationSec = parseDuration(it.contentDetails?.duration);
        out[it.id] = {
          durationSec,
          // YouTube Shorts are now up to 3 minutes (180s), not 60s.
          isShort: durationSec > 0 && durationSec <= 180,
          viewCount: it.statistics?.viewCount ? +it.statistics.viewCount : undefined,
          likeCount: it.statistics?.likeCount ? +it.statistics.likeCount : undefined,
          commentCount: it.statistics?.commentCount ? +it.statistics.commentCount : undefined,
        };
      }
    }
    return out;
  }
}

export class QuotaExceededError extends Error {
  constructor() {
    super('Daily YouTube quota cap reached');
    this.name = 'QuotaExceededError';
  }
}
