import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import {
  BRIGHTDATA_DATASETS,
  BRIGHT_DATA_CREDIT_CAP,
  BRIGHTDATA_KEYWORDS,
  BRIGHTDATA_REDDIT_DATE,
  BRIGHTDATA_REDDIT_SORT,
  BRIGHTDATA_REDDIT_COMMENTS_DATASET,
  BRIGHTDATA_COMMENTS_LIMIT,
  BRIGHTDATA_IG_PROFILES,
  BRIGHTDATA_X_PROFILES,
  BRIGHT_DATA_SERP_ZONE,
  BRIGHTDATA_SERP_SITES,
  serpTermsFor,
  scoreSignals,
  isSpam,
} from './leads.config';

const BASE = 'https://api.brightdata.com/datasets/v3';

type Platform = 'REDDIT' | 'QUORA' | 'INSTAGRAM' | 'FACEBOOK' | 'X';

export interface CollectParams {
  platform: Platform;
  keywords?: string[]; // discovery keywords (Reddit / Quora / Instagram)
  urls?: string[]; // direct URLs (Facebook group URLs, etc.)
  perInput?: number; // records per keyword/url — the main credit lever
  trigger?: 'manual' | 'scheduled';
}

@Injectable()
export class BrightDataService {
  private readonly logger = new Logger('BrightData');
  private readonly key = process.env.BRIGHT_DATA_API_KEY;

  constructor(
    private prisma: PrismaService,
    private ai: AiService,
  ) {}

  /** Job ids the admin asked to cancel — checked inside the poll loop. */
  private readonly cancelled = new Set<string>();

  /** In-memory progress of the AI category-classification run (one at a time). */
  private categorize = {
    running: false,
    processed: 0,
    total: 0,
    updated: 0,
    byCategory: {} as Record<string, number>,
    error: null as string | null,
    startedAt: null as string | null,
    finishedAt: null as string | null,
  };

  configured(): boolean {
    return !!this.key;
  }

  /** Request cancellation of a running Bright Data collection. */
  async cancel(id: string) {
    const job = await this.prisma.brightDataJob.findUnique({ where: { id } });
    if (!job) throw new Error('job not found');
    if (job.status !== 'RUNNING' && job.status !== 'PENDING' && job.status !== 'READY') return { ok: false, reason: `job is ${job.status}` };
    this.cancelled.add(id);
    await this.prisma.brightDataJob.update({ where: { id }, data: { status: 'CANCELLED', error: 'cancelled by admin', finishedAt: new Date() } });
    return { ok: true, cancelled: true };
  }

  /** Per-result breakdown for one Bright Data job: each captured post, accept/reject + why + source. */
  async jobDetails(jobId: string) {
    const job = await this.prisma.brightDataJob.findUnique({ where: { id: jobId } });
    const rows = await this.prisma.sourceCapture.findMany({ where: { jobId }, orderBy: { signalCount: 'desc' } });
    const results = rows.map((r) => {
      const err = (r.raw as any)?.error;
      const accepted = !err && !r.isSpam;
      const reason = err ? `Bright Data error: ${String(err).slice(0, 120)}`
        : r.isSpam ? 'rejected — spam (academic-cheating / off-topic)'
        : `accepted — ${r.signalCount}/3 signals (${r.temperature}); procedure=${r.hasProcedure}, cost=${r.hasCost}, origin=${r.hasOrigin}`;
      const phases = [
        { name: 'Scrape', status: err ? 'reject' : 'pass', detail: err ? String(err).slice(0, 100) : 'record returned' },
      ];
      if (!err) phases.push({ name: 'Spam filter', status: r.isSpam ? 'reject' : 'pass', detail: r.isSpam ? 'matched spam terms' : 'clean' });
      if (!err && !r.isSpam) phases.push({ name: '3-signal score', status: 'pass', detail: `score ${r.intentScore}, ${r.temperature}` });
      return { source: r.url, title: r.title, score: r.intentScore, outcome: accepted ? 'accepted' : 'rejected', reason, phases };
    });
    const accepted = results.filter((r) => r.outcome === 'accepted').length;
    return { job, kind: 'brightdata', summary: { total: results.length, accepted, rejected: results.length - accepted }, results };
  }

  // ── Credit budget (records delivered ≈ credits) ───────────────────────────────
  async spentCredits(): Promise<number> {
    const agg = await this.prisma.brightDataJob.aggregate({
      _sum: { records: true },
      where: { status: { not: 'FAILED' } },
    });
    return agg._sum.records ?? 0;
  }
  async remainingCredits(): Promise<number> {
    return Math.max(0, BRIGHT_DATA_CREDIT_CAP - (await this.spentCredits()));
  }
  async budget() {
    const spent = await this.spentCredits();
    return { cap: BRIGHT_DATA_CREDIT_CAP, spent, remaining: Math.max(0, BRIGHT_DATA_CREDIT_CAP - spent) };
  }

  // ── Low-level Bright Data API ─────────────────────────────────────────────────
  private async post(path: string, body: any): Promise<any> {
    const res = await fetch(`${BASE}/${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = text; }
    if (!res.ok) throw new Error(`BrightData ${res.status}: ${String(text).slice(0, 200)}`);
    return data;
  }
  private async get(path: string): Promise<any> {
    const res = await fetch(`${BASE}/${path}`, { headers: { Authorization: `Bearer ${this.key}` } });
    const text = await res.text();
    if (!res.ok) throw new Error(`BrightData ${res.status}: ${String(text).slice(0, 200)}`);
    try { return JSON.parse(text); } catch { return text; }
  }

  /**
   * Download a ready snapshot's records. progress="ready" only means collection
   * finished; the downloadable deliverable is built separately and the data
   * endpoint returns {status:'building'} until it's assembled — so poll through it.
   */
  private async downloadSnapshot(snapshotId: string): Promise<any[]> {
    for (let i = 0; i < 60; i++) {
      const data = await this.get(`snapshot/${snapshotId}?format=json`);
      const arr: any[] = Array.isArray(data) ? data : data?.data ?? [data];
      const first = arr[0];
      if (first && typeof first === 'object' && first.status === 'building') {
        await this.sleep(8000);
        continue;
      }
      return Array.isArray(data) ? data : data?.data ?? [];
    }
    throw new Error(`snapshot ${snapshotId} stuck building`);
  }

  /** Build (queryParams, inputs[]) for a platform. Returns null if inputs are missing. */
  private buildTrigger(platform: Platform, keywords: string[], urls: string[], perInput: number) {
    const ds = BRIGHTDATA_DATASETS[platform];
    const common: Record<string, string> = { dataset_id: ds.id, include_errors: 'true', limit_per_input: String(perInput) };
    // Reddit: if specific post URLs are supplied, collect those directly (bypasses
    // keyword discovery — used to pull in a known post the spam-flooded search misses).
    if (urls.length && ds.mode === 'discover_keyword') {
      return { params: { ...common }, inputs: urls.map((u) => ({ url: u })) };
    }
    switch (ds.mode) {
      case 'discover_keyword': // Reddit
        if (!keywords.length) return null;
        return {
          params: { ...common, type: 'discover_new', discover_by: 'keyword' },
          inputs: keywords.map((k) => ({ keyword: k, date: BRIGHTDATA_REDDIT_DATE, sort_by: BRIGHTDATA_REDDIT_SORT, num_of_posts: perInput })),
        };
      case 'discover_search_url': // Quora — feed a search URL built from the keyword.
        // NOTE: Bright Data's Quora collector currently returns 0 rows for search
        // discovery (Quora blocks logged-out search) and errors on question URLs.
        // Kept wired (type=question yields a clean empty result, not error rows);
        // Quora is effectively deferred until valid question URLs can be sourced.
        if (!keywords.length) return null;
        return {
          params: { ...common, type: 'discover_new', discover_by: 'search_url' },
          inputs: keywords.map((k) => ({ url: `https://www.quora.com/search?q=${encodeURIComponent(k)}&type=question` })),
        };
      case 'discover_url': { // Instagram — discover posts from profile/hashtag URLs
        const igUrls = urls.length ? urls : BRIGHTDATA_IG_PROFILES;
        if (!igUrls.length) return null;
        return {
          params: { ...common, type: 'discover_new', discover_by: 'url' },
          inputs: igUrls.map((u) => ({ url: u })),
        };
      }
      case 'discover_profile_url': { // X (Twitter) — discover posts from profile URLs
        const xUrls = urls.length ? urls : BRIGHTDATA_X_PROFILES;
        if (!xUrls.length) return null;
        return {
          params: { ...common, type: 'discover_new', discover_by: 'profile_url' },
          inputs: xUrls.map((u) => ({ url: u })),
        };
      }
      case 'url': // Facebook — collect by supplied group/post URLs
        if (!urls.length) return null;
        return { params: { ...common }, inputs: urls.map((u) => ({ url: u })) };
    }
  }

  // ── High-level orchestration ──────────────────────────────────────────────────
  /**
   * Kick off a collection. Creates a BrightDataJob, triggers Bright Data, and
   * polls/downloads/saves in the background. Returns the job immediately.
   */
  async collect(p: CollectParams) {
    if (!this.configured()) throw new Error('BRIGHT_DATA_API_KEY not configured');
    // Keyword/hashtag discovery for the platforms whose datasets can't keyword-search
    // (Quora/X/Instagram/Facebook) goes through the SERP API (Google site:<domain>).
    // Explicit URL inputs still use the dataset (profile/group collection).
    const serpPlatform = ['QUORA', 'X', 'INSTAGRAM', 'FACEBOOK'].includes(p.platform);
    if (serpPlatform && !(p.urls?.length)) return this.collectSerp(p);
    const platform = p.platform;
    const ds = BRIGHTDATA_DATASETS[platform];
    const urls = p.urls ?? [];
    const useUrls = urls.length > 0;
    const isKeywordDiscovery = ds.mode === 'discover_keyword'; // only Reddit
    // Keyword pack applies only to keyword discovery; IG uses default profiles, others need URLs.
    const keywords = (isKeywordDiscovery && !useUrls) ? (p.keywords?.length ? p.keywords : BRIGHTDATA_KEYWORDS) : (p.keywords ?? []);

    // Budget clamp: never let a run exceed the remaining credit allowance.
    const remaining = await this.remainingCredits();
    if (remaining <= 0) throw new Error(`Bright Data credit cap reached (${BRIGHT_DATA_CREDIT_CAP})`);
    const inputCount = (useUrls ? urls.length
      : isKeywordDiscovery ? keywords.length
      : ds.mode === 'discover_url' ? BRIGHTDATA_IG_PROFILES.length
      : ds.mode === 'discover_profile_url' ? BRIGHTDATA_X_PROFILES.length
      : 1) || 1;
    let perInput = Math.max(1, p.perInput ?? 5);
    if (perInput * inputCount > remaining) perInput = Math.max(1, Math.floor(remaining / inputCount));

    const built = this.buildTrigger(platform, keywords, urls, perInput);
    if (!built) throw new Error(`No inputs for ${platform} (${ds.mode} needs ${ds.mode === 'url' ? 'urls' : 'keywords'})`);

    const job = await this.prisma.brightDataJob.create({
      data: {
        platform, datasetId: ds.id, mode: useUrls ? 'url' : ds.mode,
        inputs: built.inputs as any, status: 'PENDING',
        trigger: p.trigger ?? 'manual', startedAt: new Date(),
      },
    });

    // Fire the trigger, then poll in the background.
    this.run(job.id, platform, ds.id, built.params, built.inputs, keywords[0] ?? urls[0] ?? null)
      .catch((e) => this.logger.error(`BrightData job ${job.id} crashed: ${e.message}`));
    return job;
  }

  // ── Quora via SERP API (Google site:quora.com — the dataset scraper is broken) ──
  /** Google a `site:quora.com <keyword>` query via the SERP API; returns organic results. */
  private async serpSearch(query: string, num = 20): Promise<any[]> {
    const res = await fetch('https://api.brightdata.com/request', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        zone: BRIGHT_DATA_SERP_ZONE,
        url: `https://www.google.com/search?q=${encodeURIComponent(query)}&num=${num}`,
        format: 'json', data_format: 'parsed',
      }),
    });
    if (!res.ok) throw new Error(`SERP ${res.status}: ${(await res.text()).slice(0, 150)}`);
    const data: any = await res.json();
    let body = data?.body ?? data;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    return Array.isArray(body?.organic) ? body.organic : [];
  }

  /** Discover posts for a platform via Google SERP (site:<domain> <term>), scoring + saving each result. */
  async collectSerp(p: CollectParams) {
    if (!this.configured()) throw new Error('BRIGHT_DATA_API_KEY not configured');
    if ((await this.remainingCredits()) <= 0) throw new Error(`Bright Data credit cap reached`);
    const platform = p.platform as keyof typeof BRIGHTDATA_SERP_SITES;
    const site = BRIGHTDATA_SERP_SITES[platform];
    if (!site) throw new Error(`no SERP site for ${platform}`);
    const terms = p.keywords?.length ? p.keywords : serpTermsFor(platform);
    const perInput = Math.max(1, Math.min(20, p.perInput ?? 10));
    const job = await this.prisma.brightDataJob.create({
      data: {
        platform: platform as any, datasetId: 'serp', mode: 'serp',
        inputs: terms.map((t) => ({ query: `site:${site} ${t}` })) as any,
        status: 'RUNNING', trigger: p.trigger ?? 'manual', startedAt: new Date(),
      },
    });
    this.runSerp(job.id, platform, site, terms, perInput).catch((e) => this.logger.error(`${platform} SERP job ${job.id} crashed: ${e.message}`));
    return job;
  }

  private async runSerp(jobId: string, platform: string, site: string, terms: string[], perInput: number) {
    let records = 0, saved = 0;
    const reDomain = new RegExp(site.replace('.', '\\.'), 'i');
    try {
      for (const term of terms) {
        const organic = await this.serpSearch(`site:${site} ${term}`, perInput).catch(() => []);
        for (const r of organic.slice(0, perInput)) {
          const url = r.link || r.url;
          if (!url || !reDomain.test(url)) continue;
          records++;
          const title = String(r.title || '').slice(0, 300);
          const body = String(r.description || r.snippet || '').slice(0, 2000);
          const sig = scoreSignals(`${title} ${body}`);
          const data = {
            url, title, body, author: null, raw: r as any,
            isSpam: isSpam(`${title} ${body}`),
            hasProcedure: sig.hasProcedure, hasCost: sig.hasCost, hasOrigin: sig.hasOrigin,
            signalCount: sig.signalCount, temperature: sig.temperature,
            procedures: sig.procedures as any, origins: sig.origins as any, intentScore: sig.intentScore,
            datasetId: 'serp', jobId, keyword: term,
          };
          try {
            await this.prisma.sourceCapture.upsert({
              where: { platform_externalId: { platform: platform as any, externalId: url } },
              create: { platform: platform as any, externalId: url, ...data },
              update: data,
            });
            saved++;
          } catch (e: any) {
            this.logger.warn(`${platform} SERP save failed for ${url}: ${e.message}`);
          }
        }
      }
      await this.prisma.brightDataJob.update({ where: { id: jobId }, data: { status: 'DONE', records, saved, creditsApprox: records, finishedAt: new Date() } });
      this.logger.log(`${platform} SERP job ${jobId} done: ${records} results, ${saved} saved`);
    } catch (e: any) {
      await this.prisma.brightDataJob.update({ where: { id: jobId }, data: { status: 'FAILED', error: e.message?.slice(0, 500), finishedAt: new Date() } }).catch(() => undefined);
      this.logger.error(`${platform} SERP job ${jobId} failed: ${e.message}`);
    }
  }

  private async run(jobId: string, platform: Platform, datasetId: string, params: any, inputs: any[], keyword: string | null) {
    try {
      const qs = new URLSearchParams(params).toString();
      const trig = await this.post(`trigger?${qs}`, inputs);
      const snapshotId = trig?.snapshot_id;
      if (!snapshotId) throw new Error(`trigger returned no snapshot_id: ${JSON.stringify(trig).slice(0, 200)}`);
      await this.prisma.brightDataJob.update({ where: { id: jobId }, data: { snapshotId, status: 'RUNNING' } });
      this.logger.log(`BrightData ${platform} job ${jobId} → snapshot ${snapshotId}`);

      // Poll progress (snapshots take minutes). Cap at ~10 min.
      let status = 'running';
      for (let i = 0; i < 80; i++) {
        await this.sleep(8000);
        if (this.cancelled.has(jobId)) {
          this.cancelled.delete(jobId);
          await this.prisma.brightDataJob.update({ where: { id: jobId }, data: { status: 'CANCELLED', error: 'cancelled by admin', finishedAt: new Date() } }).catch(() => undefined);
          this.logger.log(`BrightData job ${jobId} cancelled`);
          return;
        }
        const prog = await this.get(`progress/${snapshotId}`);
        status = prog?.status;
        if (status === 'ready' || status === 'failed') break;
      }
      if (status !== 'ready') throw new Error(`snapshot ${snapshotId} not ready (status=${status})`);

      await this.prisma.brightDataJob.update({ where: { id: jobId }, data: { status: 'READY' } });
      const records = await this.downloadSnapshot(snapshotId);
      const saved = await this.saveRecords(platform, datasetId, snapshotId, jobId, keyword, records);

      await this.prisma.brightDataJob.update({
        where: { id: jobId },
        data: { status: 'DONE', records: records.length, saved, creditsApprox: records.length, finishedAt: new Date() },
      });
      this.logger.log(`BrightData ${platform} job ${jobId} done: ${records.length} records, ${saved} saved`);
    } catch (e: any) {
      await this.prisma.brightDataJob.update({
        where: { id: jobId },
        data: { status: 'FAILED', error: e.message?.slice(0, 500), finishedAt: new Date() },
      }).catch(() => undefined);
      this.logger.error(`BrightData job ${jobId} failed: ${e.message}`);
    }
  }

  /** Map a raw Bright Data record to our extracted fields (best-effort, platform-aware). */
  private extract(platform: Platform, r: any): { externalId: string | null; url: string | null; title: string | null; body: string | null; author: string | null } {
    const pick = (...keys: string[]) => { for (const k of keys) if (r?.[k]) return String(r[k]); return null; };
    const externalId = pick('post_id', 'id', 'url', 'post_url', 'shortcode', 'question_url');
    const body = pick('description', 'answer', 'text', 'content', 'description_markdown', 'caption', 'post_text');
    // Tweets/captions have no title — use the text itself as the headline.
    const title = pick('title', 'question', 'question_title', 'caption') || (body ? body.slice(0, 100) : null);
    return {
      externalId,
      url: pick('url', 'post_url', 'question_url', 'link'),
      title,
      body,
      author: pick('user_posted', 'author', 'user_name', 'username', 'profile_name'),
    };
  }

  /** Upsert every record into source_captures. Soft-delete state is preserved on re-capture. */
  private async saveRecords(platform: Platform, datasetId: string, snapshotId: string, jobId: string, keyword: string | null, records: any[]): Promise<number> {
    let saved = 0;
    for (const r of records) {
      const ex = this.extract(platform, r);
      const externalId = ex.externalId || `${snapshotId}:${saved}`;
      const sig = scoreSignals(`${ex.title ?? ''} ${ex.body ?? ''}`);
      const rawDate = r?.date_posted ?? r?.date ?? r?.post_date ?? r?.created_time ?? r?.timestamp ?? null;
      const pd = rawDate ? new Date(rawDate) : null;
      const postedAt = pd && !isNaN(+pd) ? pd : null;
      const data = {
        url: ex.url, title: ex.title, body: ex.body, author: ex.author, postedAt,
        raw: r as any,
        isSpam: isSpam(`${ex.title ?? ''} ${ex.body ?? ''}`),
        hasProcedure: sig.hasProcedure, hasCost: sig.hasCost, hasOrigin: sig.hasOrigin,
        signalCount: sig.signalCount, temperature: sig.temperature,
        procedures: sig.procedures as any, origins: sig.origins as any, intentScore: sig.intentScore,
        datasetId, snapshotId, jobId, keyword: r?.discovery_input?.keyword ?? keyword,
      };
      try {
        await this.prisma.sourceCapture.upsert({
          where: { platform_externalId: { platform: platform as any, externalId } },
          create: { platform: platform as any, externalId, ...data },
          update: data, // note: deletedAt intentionally untouched (no resurrection)
        });
        saved++;
      } catch (e: any) {
        this.logger.warn(`saveRecords ${platform}:${externalId} failed: ${e.message}`);
      }
    }
    return saved;
  }

  // ── Read / soft-delete APIs ───────────────────────────────────────────────────
  async listCaptures(params: {
    page?: number; pageSize?: number; platform?: string;
    temperature?: string; minSignals?: number; q?: string; includeDeleted?: boolean; includeSpam?: boolean; sort?: string;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(params.pageSize) || 50));
    const where: Prisma.SourceCaptureWhereInput = {};
    if (!params.includeDeleted) where.deletedAt = null; // soft-deleted hidden by default
    if (!params.includeSpam) where.isSpam = false; // spam hidden by default (still stored)
    if (params.platform) where.platform = params.platform as any;
    if (params.temperature) where.temperature = params.temperature;
    if (params.minSignals) where.signalCount = { gte: Number(params.minSignals) };
    if (params.q) where.OR = [
      { title: { contains: params.q, mode: 'insensitive' } },
      { body: { contains: params.q, mode: 'insensitive' } },
    ];
    let orderBy: Prisma.SourceCaptureOrderByWithRelationInput = { signalCount: 'desc' };
    if (params.sort === 'newest') orderBy = { createdAt: 'desc' };
    else if (params.sort === 'score') orderBy = { intentScore: 'desc' };
    else if (params.sort === 'posted') orderBy = { postedAt: { sort: 'desc', nulls: 'last' } };

    const [total, items] = await Promise.all([
      this.prisma.sourceCapture.count({ where }),
      this.prisma.sourceCapture.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
    ]);
    return { items, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async captureStats() {
    const live = { deletedAt: null, isSpam: false };
    const [total, deleted, spam, byPlatform, byTemp, budget] = await Promise.all([
      this.prisma.sourceCapture.count({ where: live }),
      this.prisma.sourceCapture.count({ where: { deletedAt: { not: null } } }),
      this.prisma.sourceCapture.count({ where: { isSpam: true, deletedAt: null } }),
      this.prisma.sourceCapture.groupBy({ by: ['platform'], where: live, _count: true }),
      this.prisma.sourceCapture.groupBy({ by: ['temperature'], where: live, _count: true }),
      this.budget(),
    ]);
    return {
      total, softDeleted: deleted, spam, budget,
      byPlatform: Object.fromEntries(byPlatform.map((p) => [p.platform, p._count])),
      byTemperature: Object.fromEntries(byTemp.map((t) => [t.temperature ?? 'cold', t._count])),
    };
  }

  // ── Lead analytics (AI category breakdown + monthly volume) ───────────────────
  private static readonly CATEGORIES = ['LEAD', 'MARKETING', 'NEWS', 'OTHER'] as const;

  /**
   * Dashboard data: how the captured posts break down by AI category, by platform,
   * and how many were generated each month (by capture date). Soft-deleted rows are
   * excluded; spam is kept (it's part of the marketing/other story).
   */
  async analytics() {
    const live: Prisma.SourceCaptureWhereInput = { deletedAt: null };
    const [total, categorized, byCategory, byPlatformCat] = await Promise.all([
      this.prisma.sourceCapture.count({ where: live }),
      this.prisma.sourceCapture.count({ where: { ...live, category: { not: null } } }),
      this.prisma.sourceCapture.groupBy({ by: ['category'], where: live, _count: true }),
      this.prisma.sourceCapture.groupBy({ by: ['platform', 'category'], where: live, _count: true }),
    ]);

    // Category totals (incl. an UNCATEGORIZED bucket for not-yet-classified rows).
    const categoryTotals: Record<string, number> = { LEAD: 0, MARKETING: 0, NEWS: 0, OTHER: 0, UNCATEGORIZED: 0 };
    for (const g of byCategory) categoryTotals[g.category ?? 'UNCATEGORIZED'] = g._count;

    // Per-platform category matrix.
    const byPlatform: Record<string, Record<string, number>> = {};
    for (const g of byPlatformCat) {
      const p = (byPlatform[g.platform] ??= { LEAD: 0, MARKETING: 0, NEWS: 0, OTHER: 0, UNCATEGORIZED: 0, total: 0 });
      p[g.category ?? 'UNCATEGORIZED'] += g._count;
      p.total += g._count;
    }

    // Monthly volume by capture date, split by category (raw SQL for date_trunc).
    const rows = await this.prisma.$queryRaw<{ month: string; category: string | null; count: number }[]>(Prisma.sql`
      SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS month,
             "category"::text AS category,
             COUNT(*)::int AS count
      FROM "source_captures"
      WHERE "deletedAt" IS NULL
      GROUP BY 1, 2
      ORDER BY 1 ASC`);
    const monthMap = new Map<string, any>();
    for (const r of rows) {
      const m = monthMap.get(r.month) ?? { month: r.month, total: 0, LEAD: 0, MARKETING: 0, NEWS: 0, OTHER: 0, UNCATEGORIZED: 0 };
      m[r.category ?? 'UNCATEGORIZED'] += r.count;
      m.total += r.count;
      monthMap.set(r.month, m);
    }
    const monthly = Array.from(monthMap.values());

    return {
      total,
      categorized,
      uncategorized: total - categorized,
      categories: BrightDataService.CATEGORIES,
      byCategory: categoryTotals,
      byPlatform,
      monthly,
      classify: this.categorize,
    };
  }

  /** Current progress of the AI classification run (for polling from the UI). */
  categorizeStatus() {
    return this.categorize;
  }

  /**
   * Kick off an AI run that classifies captured posts into LEAD/MARKETING/NEWS/OTHER.
   * Runs in the background (many posts can take minutes); the UI polls categorizeStatus.
   * By default only classifies not-yet-categorized rows; `reclassify` re-does all.
   */
  async startCategorize(opts: { reclassify?: boolean; limit?: number } = {}) {
    if (this.categorize.running) return { ok: false, reason: 'already running', progress: this.categorize };
    const where: Prisma.SourceCaptureWhereInput = { deletedAt: null };
    if (!opts.reclassify) where.category = null;
    const ids = (
      await this.prisma.sourceCapture.findMany({
        where,
        select: { id: true },
        orderBy: { createdAt: 'desc' },
        take: opts.limit && opts.limit > 0 ? opts.limit : undefined,
      })
    ).map((r) => r.id);

    this.categorize = {
      running: ids.length > 0,
      processed: 0,
      total: ids.length,
      updated: 0,
      byCategory: {},
      error: null,
      startedAt: new Date().toISOString(),
      finishedAt: ids.length ? null : new Date().toISOString(),
    };
    if (!ids.length) return { ok: true, nothing: true, progress: this.categorize };

    // fire-and-forget; errors are captured into progress
    this.runCategorize(ids).catch((e) => {
      this.categorize.running = false;
      this.categorize.error = e?.message || String(e);
      this.categorize.finishedAt = new Date().toISOString();
    });
    return { ok: true, started: true, progress: this.categorize };
  }

  private async runCategorize(ids: string[]) {
    const BATCH = 15;
    try {
      for (let i = 0; i < ids.length; i += BATCH) {
        if (!this.categorize.running) break; // (defensive — no external cancel yet)
        const batchIds = ids.slice(i, i + BATCH);
        const rows = await this.prisma.sourceCapture.findMany({
          where: { id: { in: batchIds } },
          select: { id: true, platform: true, title: true, body: true },
        });

        // Posts with no usable text can't be classified by the model — mark OTHER cheaply.
        const empty = rows.filter((r) => !((r.title || '') + (r.body || '')).trim());
        const fillable = rows.filter((r) => ((r.title || '') + (r.body || '')).trim());

        const verdicts = fillable.length
          ? await this.ai.classifyCategories(
              fillable.map((r) => ({ id: r.id, platform: r.platform, title: r.title, body: r.body })),
            )
          : {};

        for (const r of empty) {
          verdicts[r.id] = { category: 'OTHER', reason: 'no text content' };
        }

        const now = new Date();
        for (const r of rows) {
          const v = verdicts[r.id];
          if (!v) continue;
          await this.prisma.sourceCapture.update({
            where: { id: r.id },
            data: { category: v.category as any, categoryReason: v.reason, categorizedAt: now },
          });
          this.categorize.updated++;
          this.categorize.byCategory[v.category] = (this.categorize.byCategory[v.category] || 0) + 1;
        }
        this.categorize.processed = Math.min(ids.length, i + BATCH);
      }
    } finally {
      this.categorize.running = false;
      this.categorize.finishedAt = new Date().toISOString();
    }
  }

  listJobs() {
    return this.prisma.brightDataJob.findMany({ orderBy: { createdAt: 'desc' }, take: 30 });
  }

  /** Soft delete — never physically removes the row. */
  async softDelete(id: string) {
    await this.prisma.sourceCapture.update({ where: { id }, data: { deletedAt: new Date() } });
    return { ok: true, softDeleted: true };
  }
  async restore(id: string) {
    await this.prisma.sourceCapture.update({ where: { id }, data: { deletedAt: null } });
    return { ok: true, restored: true };
  }

  getCapture(id: string) {
    return this.prisma.sourceCapture.findUnique({ where: { id } });
  }

  /**
   * Fetch a Reddit post's full comment thread via the dedicated Comments dataset
   * (one row per comment) and store it on the capture. Async — returns immediately;
   * the frontend polls the capture until commentsStatus flips to 'done'/'failed'.
   * Counts the delivered comments toward the Bright Data credit budget.
   */
  async fetchComments(id: string) {
    if (!this.configured()) throw new Error('BRIGHT_DATA_API_KEY not configured');
    const cap = await this.prisma.sourceCapture.findUnique({ where: { id } });
    if (!cap) throw new Error('capture not found');
    if (cap.platform !== 'REDDIT') throw new Error('comments fetch is only supported for Reddit');
    if (!cap.url) throw new Error('capture has no URL to fetch comments from');
    if (cap.commentsStatus === 'fetching') return { status: 'fetching' };

    await this.prisma.sourceCapture.update({ where: { id }, data: { commentsStatus: 'fetching' } });
    this.runComments(id, cap.url).catch((e) => this.logger.error(`fetchComments ${id} crashed: ${e.message}`));
    return { status: 'fetching' };
  }

  private async runComments(captureId: string, url: string) {
    const ds = BRIGHTDATA_REDDIT_COMMENTS_DATASET;
    const job = await this.prisma.brightDataJob.create({
      data: { platform: 'REDDIT', datasetId: ds, mode: 'comments', inputs: [{ url }] as any, status: 'PENDING', trigger: 'manual', startedAt: new Date() },
    });
    try {
      const qs = new URLSearchParams({ dataset_id: ds, include_errors: 'true', limit_per_input: String(BRIGHTDATA_COMMENTS_LIMIT) }).toString();
      const trig = await this.post(`trigger?${qs}`, [{ url }]);
      const snapshotId = trig?.snapshot_id;
      if (!snapshotId) throw new Error(`no snapshot_id: ${JSON.stringify(trig).slice(0, 150)}`);
      await this.prisma.brightDataJob.update({ where: { id: job.id }, data: { snapshotId, status: 'RUNNING' } });

      let status = 'running';
      for (let i = 0; i < 80; i++) {
        await this.sleep(8000);
        const prog = await this.get(`progress/${snapshotId}`);
        status = prog?.status;
        if (status === 'ready' || status === 'failed') break;
      }
      if (status !== 'ready') throw new Error(`comments snapshot not ready (status=${status})`);

      const records = await this.downloadSnapshot(snapshotId);
      const comments = records.filter((r) => r && typeof r === 'object' && !r.error);
      await this.prisma.sourceCapture.update({
        where: { id: captureId },
        data: { comments: comments as any, commentsStatus: 'done', commentsFetchedAt: new Date() },
      });
      await this.prisma.brightDataJob.update({
        where: { id: job.id },
        data: { status: 'DONE', records: records.length, saved: comments.length, creditsApprox: records.length, finishedAt: new Date() },
      });
      this.logger.log(`fetchComments ${captureId}: ${comments.length} comments saved`);
    } catch (e: any) {
      await this.prisma.sourceCapture.update({ where: { id: captureId }, data: { commentsStatus: 'failed' } }).catch(() => undefined);
      await this.prisma.brightDataJob.update({ where: { id: job.id }, data: { status: 'FAILED', error: e.message?.slice(0, 500), finishedAt: new Date() } }).catch(() => undefined);
      this.logger.error(`fetchComments ${captureId} failed: ${e.message}`);
    }
  }

  private sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
}
