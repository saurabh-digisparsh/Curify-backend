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
  hasPartnerSignal,
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
    // Hard stop if Bright Data's real account funds are exhausted (when readable).
    const account = await this.accountBalance();
    if (account && account.available <= 0) return 0;
    return Math.max(0, BRIGHT_DATA_CREDIT_CAP - (await this.spentCredits()));
  }
  async budget() {
    const [spent, account] = await Promise.all([this.spentCredits(), this.accountBalance()]);
    return {
      cap: BRIGHT_DATA_CREDIT_CAP,
      spent,
      remaining: Math.max(0, BRIGHT_DATA_CREDIT_CAP - spent),
      // Real Bright Data account balance (USD) from the Account Management API.
      account: account ?? { configured: false as const },
    };
  }

  /**
   * Live account balance from Bright Data's Account Management API
   * (GET /customer/balance → { balance, pending_balance }). Cached 60s so the stats
   * endpoint doesn't hit the API on every call. Returns null if the key is missing,
   * the token lacks the "balance" permission (403), or the request fails — callers
   * then fall back to the local record-count budget.
   */
  private balanceCache: { at: number; data: { configured: true; balance: number; pendingBalance: number; available: number } | null } | null = null;
  async accountBalance() {
    if (!this.key) return null;
    const now = Date.now();
    if (this.balanceCache && now - this.balanceCache.at < 60_000) return this.balanceCache.data;
    try {
      const res = await fetch('https://api.brightdata.com/customer/balance', {
        headers: { Authorization: `Bearer ${this.key}` },
      });
      if (!res.ok) {
        const hint = res.status === 403 ? 'token lacks the "balance" permission (enable it at brightdata.com/cp/setting/users)' : `HTTP ${res.status}`;
        this.logger.warn(`Bright Data balance API unavailable — ${hint}`);
        this.balanceCache = { at: now, data: null };
        return null;
      }
      const j: any = await res.json();
      const balance = Number(j.balance ?? 0);
      const pendingBalance = Number(j.pending_balance ?? j.pending_costs ?? 0);
      const data = { configured: true as const, balance, pendingBalance, available: balance - pendingBalance };
      this.balanceCache = { at: now, data };
      return data;
    } catch (e: any) {
      this.logger.warn(`Bright Data balance fetch failed: ${e.message}`);
      this.balanceCache = { at: now, data: null };
      return null;
    }
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
    page?: number; pageSize?: number; platform?: string; category?: string;
    temperature?: string; minSignals?: number; q?: string; includeDeleted?: boolean; includeSpam?: boolean; sort?: string; needsReview?: boolean;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(params.pageSize) || 50));
    const where: Prisma.SourceCaptureWhereInput = {};
    if (!params.includeDeleted) where.deletedAt = null; // soft-deleted hidden by default
    if (!params.includeSpam) where.isSpam = false; // spam hidden by default (still stored)
    if (params.platform) where.platform = params.platform as any;
    if (params.category) where.category = params.category === 'UNCATEGORIZED' ? null : (params.category as any);
    // 'hot' matches both corridor-aware hot tiers (hot-corridor + hot-generic); specific values match exactly.
    if (params.temperature) where.temperature = params.temperature === 'hot' ? { startsWith: 'hot' } : params.temperature;
    if (params.needsReview) where.needsReview = true;
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

  async captureStats(platform?: string) {
    const pf = platform ? { platform: platform as any } : {};
    const live = { deletedAt: null, isSpam: false, ...pf };
    const [total, deleted, spam, byPlatform, byTemp, byCategory, budget] = await Promise.all([
      this.prisma.sourceCapture.count({ where: live }),
      this.prisma.sourceCapture.count({ where: { deletedAt: { not: null }, ...pf } }),
      this.prisma.sourceCapture.count({ where: { isSpam: true, deletedAt: null, ...pf } }),
      // platform breakdown stays global (so the all-platforms view still shows the split)
      this.prisma.sourceCapture.groupBy({ by: ['platform'], where: { deletedAt: null, isSpam: false }, _count: true }),
      this.prisma.sourceCapture.groupBy({ by: ['temperature'], where: live, _count: true }),
      this.prisma.sourceCapture.groupBy({ by: ['category'], where: live, _count: true }),
      this.budget(),
    ]);
    const categoryTotals: Record<string, number> = { LEAD: 0, PARTNER: 0, MARKETING: 0, NEWS: 0, OTHER: 0, UNCATEGORIZED: 0 };
    for (const g of byCategory) categoryTotals[g.category ?? 'UNCATEGORIZED'] = g._count;
    return {
      total, softDeleted: deleted, spam, budget, platform: platform ?? null,
      byPlatform: Object.fromEntries(byPlatform.map((p) => [p.platform, p._count])),
      byTemperature: Object.fromEntries(byTemp.map((t) => [t.temperature ?? 'cold', t._count])),
      byCategory: categoryTotals,
    };
  }

  /**
   * Re-score every stored capture from its saved text (title + body) using the CURRENT
   * scoreSignals rules — pure DB work, no scraping / API calls. Backfills the corridor-aware
   * heat (and any tuned keyword lists) onto historical rows. Idempotent; only writes changed rows.
   */
  async rescoreCaptures(): Promise<{ scanned: number; updated: number }> {
    const BATCH = 500;
    let cursor: string | undefined;
    let scanned = 0, updated = 0;
    for (;;) {
      const rows = await this.prisma.sourceCapture.findMany({
        select: { id: true, title: true, body: true, temperature: true, intentScore: true, signalCount: true, isSpam: true },
        orderBy: { id: 'asc' },
        take: BATCH,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });
      if (!rows.length) break;
      cursor = rows[rows.length - 1].id;
      for (const r of rows) {
        scanned++;
        const text = `${r.title ?? ''} ${r.body ?? ''}`;
        const sig = scoreSignals(text);
        const spam = isSpam(text);
        // Skip rows whose scored fields are already up to date.
        if (r.temperature === sig.temperature && r.intentScore === sig.intentScore && r.signalCount === sig.signalCount && r.isSpam === spam) continue;
        await this.prisma.sourceCapture.update({
          where: { id: r.id },
          data: {
            hasProcedure: sig.hasProcedure, hasCost: sig.hasCost, hasOrigin: sig.hasOrigin,
            signalCount: sig.signalCount, temperature: sig.temperature,
            procedures: sig.procedures as any, origins: sig.origins as any,
            intentScore: sig.intentScore, isSpam: spam,
          },
        });
        updated++;
      }
    }
    this.logger.log(`Rescore captures: ${updated}/${scanned} rows updated with current signals`);
    return { scanned, updated };
  }

  // ── Lead analytics (AI category breakdown + monthly volume) ───────────────────
  private static readonly CATEGORIES = ['LEAD', 'PARTNER', 'MARKETING', 'NEWS', 'OTHER'] as const;

  /**
   * Dashboard data: how the captured posts break down by AI category, by platform,
   * and how many were generated per time bucket (by capture date). `bucket` is one of
   * day | month | quarter | year. Soft-deleted rows are excluded; spam is kept (it's
   * part of the marketing/other story).
   */
  async analytics(bucket: 'day' | 'month' | 'quarter' | 'year' = 'month') {
    const unit = ['day', 'month', 'quarter', 'year'].includes(bucket) ? bucket : 'month';
    const live: Prisma.SourceCaptureWhereInput = { deletedAt: null };
    const [
      capTotal, capCategorized, capByCategory, capByPlatformCat,
      leadTotal, leadCategorized, leadByCategory,
    ] = await Promise.all([
      this.prisma.sourceCapture.count({ where: live }),
      this.prisma.sourceCapture.count({ where: { ...live, category: { not: null } } }),
      this.prisma.sourceCapture.groupBy({ by: ['category'], where: live, _count: true }),
      this.prisma.sourceCapture.groupBy({ by: ['platform', 'category'], where: live, _count: true }),
      this.prisma.lead.count(),
      this.prisma.lead.count({ where: { category: { not: null } } }),
      this.prisma.lead.groupBy({ by: ['category'], _count: true }),
    ]);

    const total = capTotal + leadTotal;
    const categorized = capCategorized + leadCategorized;

    // Category totals across BOTH sources (incl. an UNCATEGORIZED bucket).
    const categoryTotals: Record<string, number> = { LEAD: 0, PARTNER: 0, MARKETING: 0, NEWS: 0, OTHER: 0, UNCATEGORIZED: 0 };
    for (const g of capByCategory) categoryTotals[g.category ?? 'UNCATEGORIZED'] += g._count;
    for (const g of leadByCategory) categoryTotals[g.category ?? 'UNCATEGORIZED'] += g._count;

    // Per-platform category matrix (social platforms + a YOUTUBE row from the leads table).
    const byPlatform: Record<string, Record<string, number>> = {};
    const blank = () => ({ LEAD: 0, PARTNER: 0, MARKETING: 0, NEWS: 0, OTHER: 0, UNCATEGORIZED: 0, total: 0 });
    for (const g of capByPlatformCat) {
      const p = (byPlatform[g.platform] ??= blank());
      p[g.category ?? 'UNCATEGORIZED'] += g._count;
      p.total += g._count;
    }
    if (leadTotal > 0) {
      const yt = (byPlatform.YOUTUBE ??= blank());
      for (const g of leadByCategory) {
        yt[g.category ?? 'UNCATEGORIZED'] += g._count;
        yt.total += g._count;
      }
    }

    // Volume per time bucket by creation date, split by category — unioned across both
    // tables (raw SQL for date_trunc). `period` is the bucket's start date (YYYY-MM-DD).
    const [capRows, leadRows] = await Promise.all([
      this.prisma.$queryRaw<{ period: string; category: string | null; count: number }[]>(Prisma.sql`
        SELECT to_char(date_trunc(${unit}, "createdAt"), 'YYYY-MM-DD') AS period, "category"::text AS category, COUNT(*)::int AS count
        FROM "source_captures" WHERE "deletedAt" IS NULL GROUP BY 1, 2 ORDER BY 1 ASC`),
      this.prisma.$queryRaw<{ period: string; category: string | null; count: number }[]>(Prisma.sql`
        SELECT to_char(date_trunc(${unit}, "createdAt"), 'YYYY-MM-DD') AS period, "category"::text AS category, COUNT(*)::int AS count
        FROM "leads" GROUP BY 1, 2 ORDER BY 1 ASC`),
    ]);
    const periodMap = new Map<string, any>();
    for (const r of [...capRows, ...leadRows]) {
      const m = periodMap.get(r.period) ?? { period: r.period, total: 0, LEAD: 0, MARKETING: 0, NEWS: 0, OTHER: 0, UNCATEGORIZED: 0 };
      m[r.category ?? 'UNCATEGORIZED'] += r.count;
      m.total += r.count;
      periodMap.set(r.period, m);
    }
    const series = Array.from(periodMap.values()).sort((a, b) => a.period.localeCompare(b.period));

    return {
      total,
      categorized,
      uncategorized: total - categorized,
      categories: BrightDataService.CATEGORIES,
      byCategory: categoryTotals,
      byPlatform,
      bucket: unit,
      series,
      classify: this.categorize,
    };
  }

  // Map a Lead / SourceCapture row to the common post shape used by the drill-down list.
  private mapCapturePost = (r: any) => ({
    id: r.id, platform: r.platform, url: r.url, title: r.title, body: r.body,
    author: r.author, postedAt: r.postedAt, isSpam: r.isSpam,
    category: r.category, categoryReason: r.categoryReason, createdAt: r.createdAt,
  });
  private mapLeadPost = (r: any) => ({
    id: r.id, platform: 'YOUTUBE', url: r.url, title: r.title,
    body: r.aiSummary || r.description || (r.transcript ? String(r.transcript).slice(0, 600) : ''),
    author: r.channelTitle, postedAt: r.publishedAt, isSpam: false,
    category: r.category, categoryReason: r.categoryReason, createdAt: r.createdAt,
  });

  /**
   * Unified post list for the analytics drill-down: returns captured social posts
   * AND YouTube leads, filtered by category (and optional platform). With no platform
   * it merges both sources; platform=YOUTUBE returns leads, any other returns captures.
   */
  async analyticsPosts(params: { category?: string; platform?: string; q?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 25));
    const skip = (page - 1) * pageSize;
    const q = params.q?.trim();
    const catVal = params.category ? (params.category === 'UNCATEGORIZED' ? null : (params.category as any)) : undefined;

    const capSelect = { id: true, platform: true, url: true, title: true, body: true, author: true, postedAt: true, isSpam: true, category: true, categoryReason: true, createdAt: true };
    const leadSelect = { id: true, url: true, title: true, description: true, transcript: true, aiSummary: true, channelTitle: true, publishedAt: true, category: true, categoryReason: true, createdAt: true };

    const capWhere: Prisma.SourceCaptureWhereInput = { deletedAt: null };
    if (catVal !== undefined) capWhere.category = catVal;
    if (params.platform && params.platform !== 'YOUTUBE') capWhere.platform = params.platform as any;
    if (q) capWhere.OR = [{ title: { contains: q, mode: 'insensitive' } }, { body: { contains: q, mode: 'insensitive' } }];

    const leadWhere: Prisma.LeadWhereInput = {};
    if (catVal !== undefined) leadWhere.category = catVal;
    if (q) leadWhere.OR = [{ title: { contains: q, mode: 'insensitive' } }, { transcript: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }];

    const wantCaptures = !params.platform || params.platform !== 'YOUTUBE';
    const wantLeads = !params.platform || params.platform === 'YOUTUBE';

    const result = (items: any[], total: number) => ({ items, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) });

    if (wantCaptures && !wantLeads) {
      const [total, rows] = await Promise.all([
        this.prisma.sourceCapture.count({ where: capWhere }),
        this.prisma.sourceCapture.findMany({ where: capWhere, select: capSelect, orderBy: { createdAt: 'desc' }, skip, take: pageSize }),
      ]);
      return result(rows.map(this.mapCapturePost), total);
    }
    if (wantLeads && !wantCaptures) {
      const [total, rows] = await Promise.all([
        this.prisma.lead.count({ where: leadWhere }),
        this.prisma.lead.findMany({ where: leadWhere, select: leadSelect, orderBy: { createdAt: 'desc' }, skip, take: pageSize }),
      ]);
      return result(rows.map(this.mapLeadPost), total);
    }
    // No platform filter → merge both sources, sort by createdAt desc, paginate in memory.
    const [caps, leads] = await Promise.all([
      this.prisma.sourceCapture.findMany({ where: capWhere, select: capSelect, orderBy: { createdAt: 'desc' } }),
      this.prisma.lead.findMany({ where: leadWhere, select: leadSelect, orderBy: { createdAt: 'desc' } }),
    ]);
    const merged = [...caps.map(this.mapCapturePost), ...leads.map(this.mapLeadPost)]
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    return result(merged.slice(skip, skip + pageSize), merged.length);
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
    const limit = opts.limit && opts.limit > 0 ? opts.limit : undefined;
    const capWhere: Prisma.SourceCaptureWhereInput = { deletedAt: null };
    const leadWhere: Prisma.LeadWhereInput = {};
    if (!opts.reclassify) { capWhere.category = null; leadWhere.category = null; }

    const [caps, leads] = await Promise.all([
      this.prisma.sourceCapture.findMany({ where: capWhere, select: { id: true }, orderBy: { createdAt: 'desc' }, take: limit }),
      this.prisma.lead.findMany({ where: leadWhere, select: { id: true }, orderBy: { createdAt: 'desc' }, take: limit }),
    ]);
    // Leads first (few, fast), then captures — so YouTube shows up early in the run.
    let items: { kind: 'lead' | 'capture'; id: string }[] = [
      ...leads.map((l) => ({ kind: 'lead' as const, id: l.id })),
      ...caps.map((c) => ({ kind: 'capture' as const, id: c.id })),
    ];
    if (limit) items = items.slice(0, limit);

    this.categorize = {
      running: items.length > 0,
      processed: 0,
      total: items.length,
      updated: 0,
      byCategory: {},
      error: null,
      startedAt: new Date().toISOString(),
      finishedAt: items.length ? null : new Date().toISOString(),
    };
    if (!items.length) return { ok: true, nothing: true, progress: this.categorize };

    // fire-and-forget; errors are captured into progress
    this.runCategorize(items).catch((e) => {
      this.categorize.running = false;
      this.categorize.error = e?.message || String(e);
      this.categorize.finishedAt = new Date().toISOString();
    });
    return { ok: true, started: true, progress: this.categorize };
  }

  private async runCategorize(items: { kind: 'lead' | 'capture'; id: string }[]) {
    const BATCH = 15;
    // Build the LEAD-weighted few-shot set once (from our own labelled DB rows) and reuse per batch.
    const { examples } = await this.buildFewShotExamples();
    try {
      for (let i = 0; i < items.length; i += BATCH) {
        if (!this.categorize.running) break; // (defensive — no external cancel yet)
        const batch = items.slice(i, i + BATCH);
        const capIds = batch.filter((b) => b.kind === 'capture').map((b) => b.id);
        const leadIds = batch.filter((b) => b.kind === 'lead').map((b) => b.id);

        const [caps, leads] = await Promise.all([
          capIds.length ? this.prisma.sourceCapture.findMany({ where: { id: { in: capIds } }, select: { id: true, platform: true, title: true, body: true } }) : Promise.resolve([] as any[]),
          leadIds.length ? this.prisma.lead.findMany({ where: { id: { in: leadIds } }, select: { id: true, title: true, description: true, transcript: true, aiSummary: true } }) : Promise.resolve([] as any[]),
        ]);

        // Build classification inputs (namespaced ids so the two tables can't collide).
        type Verdict = { category: any; reason: string; confidence: number; votes: Record<string, number>; needsReview: boolean };
        const inputs: { id: string; platform?: string; title?: string | null; body?: string | null }[] = [];
        const textById = new Map<string, string>();
        const verdicts: Record<string, Verdict> = {};
        for (const r of caps) {
          const text = ((r.title || '') + (r.body || '')).trim();
          if (!text) verdicts[`capture:${r.id}`] = { category: 'OTHER', reason: 'no text content', confidence: 100, votes: { OTHER: 1 }, needsReview: false };
          else { inputs.push({ id: `capture:${r.id}`, platform: r.platform, title: r.title, body: r.body }); textById.set(`capture:${r.id}`, `${r.title ?? ''} ${r.body ?? ''}`); }
        }
        for (const r of leads) {
          const body = r.transcript || r.aiSummary || r.description || '';
          const text = ((r.title || '') + body).trim();
          if (!text) verdicts[`lead:${r.id}`] = { category: 'OTHER', reason: 'no text content', confidence: 100, votes: { OTHER: 1 }, needsReview: false };
          else { inputs.push({ id: `lead:${r.id}`, platform: 'YOUTUBE', title: r.title, body }); textById.set(`lead:${r.id}`, `${r.title ?? ''} ${body}`); }
        }

        if (inputs.length) {
          // Pass 1 — cheap single-shot over the whole batch (few-shot, low temperature).
          const pass1 = await this.ai.classifyCategories(inputs, examples, 0.3);
          // Re-vote only the rows that matter: high-value (LEAD/PARTNER), low confidence, or a
          // deterministic partner-tag clash (keyword says PARTNER but the model didn't). Cost stays low.
          const hard = inputs.filter((x) => {
            const v = pass1[x.id]; if (!v) return false;
            const partnerClash = hasPartnerSignal(textById.get(x.id) || '') && v.category !== 'PARTNER';
            return v.category === 'LEAD' || v.category === 'PARTNER' || v.confidence < 75 || partnerClash;
          });
          const [pass2, pass3] = hard.length
            ? await Promise.all([this.ai.classifyCategories(hard, examples, 0.6), this.ai.classifyCategories(hard, examples, 0.85)])
            : [{} as typeof pass1, {} as typeof pass1];

          for (const x of inputs) {
            const v1 = pass1[x.id];
            if (!v1) { verdicts[x.id] = { category: 'OTHER', reason: 'unclassified by model', confidence: 40, votes: {}, needsReview: true }; continue; }
            const isHard = hard.includes(x);
            const passes = [v1, ...(isHard ? [pass2[x.id], pass3[x.id]].filter(Boolean) : [])];
            const votes: Record<string, number> = {};
            for (const p of passes) votes[p.category] = (votes[p.category] || 0) + 1;
            let winner = v1.category, top = 0;
            for (const [c, n] of Object.entries(votes)) if (n > top) { top = n; winner = c as any; }
            const agree = votes[winner] / passes.length; // 1.0 = unanimous
            const winningPass = passes.find((p) => p.category === winner) || v1;
            // Confidence blends ensemble agreement (better calibrated) with the model's self-report.
            const confidence = Math.round(0.7 * agree * 100 + 0.3 * winningPass.confidence);
            const partnerClash = hasPartnerSignal(textById.get(x.id) || '') && winner !== 'PARTNER';
            const needsReview = (isHard && agree < 0.6) || partnerClash || confidence < 55;
            verdicts[x.id] = { category: winner, reason: winningPass.reason, confidence, votes, needsReview };
          }
        }

        const now = new Date();
        for (const b of batch) {
          const v = verdicts[`${b.kind}:${b.id}`];
          if (!v) continue;
          const data = { category: v.category, categoryReason: v.reason, categoryConfidence: v.confidence, categoryVotes: v.votes as any, needsReview: v.needsReview, categorizedAt: now };
          if (b.kind === 'capture') await this.prisma.sourceCapture.update({ where: { id: b.id }, data: { ...data, aiCategory: v.category } });
          else await this.prisma.lead.update({ where: { id: b.id }, data });
          this.categorize.updated++;
          this.categorize.byCategory[v.category] = (this.categorize.byCategory[v.category] || 0) + 1;
        }
        this.categorize.processed = Math.min(items.length, i + BATCH);
      }
    } finally {
      this.categorize.running = false;
      this.categorize.finishedAt = new Date().toISOString();
    }
  }

  /**
   * Build the few-shot exemplar set from our OWN labelled captures (DB-only). LEAD-weighted
   * (~30% of examples) since LEAD is the revenue class; the other four categories share the rest.
   * Picks the strongest-signal, non-spam, non-deleted rows per category; body truncated to bound tokens.
   */
  async buildFewShotExamples(): Promise<{ examples: { text: string; category: string; reason: string }[]; ids: string[] }> {
    const PER: Record<string, number> = { LEAD: 6, PARTNER: 3, MARKETING: 3, NEWS: 3, OTHER: 3 }; // LEAD 6/18 ≈ 33%
    const examples: { text: string; category: string; reason: string }[] = [];
    const ids: string[] = [];
    for (const category of ['LEAD', 'PARTNER', 'MARKETING', 'NEWS', 'OTHER']) {
      const rows = await this.prisma.sourceCapture.findMany({
        where: { category: category as any, deletedAt: null, isSpam: false, body: { not: null } },
        select: { id: true, title: true, body: true, categoryReason: true },
        // Prefer human-reviewed rows as exemplars (the compounding loop), then strongest signals.
        orderBy: [{ reviewedAt: { sort: 'desc', nulls: 'last' } }, { intentScore: 'desc' }, { signalCount: 'desc' }],
        take: PER[category] ?? 3,
      });
      for (const r of rows) {
        const text = `${r.title ? r.title + ' — ' : ''}${(r.body || '').replace(/\s+/g, ' ').slice(0, 200)}`.trim();
        if (!text) continue;
        examples.push({ text, category, reason: r.categoryReason || '' });
        ids.push(r.id);
      }
    }
    return { examples, ids };
  }

  /**
   * "Reset + few-shot re-classify" — keep the exemplar rows as anchors, CLEAR the AI category on
   * every OTHER row (captures + leads) so they re-classify from scratch with the few-shot classifier.
   * Deterministic tags (temperature/signals) are preserved. Pure DB work, no scraping.
   */
  async resetAndReclassify(): Promise<any> {
    if (this.categorize.running) return { ok: false, reason: 'classification already running' };
    const { ids } = await this.buildFewShotExamples();
    const keep = ids.length ? ids : ['__none__'];
    const [caps, leads] = await Promise.all([
      this.prisma.sourceCapture.updateMany({
        where: { category: { not: null }, id: { notIn: keep } },
        data: { category: null, categoryReason: null, categorizedAt: null },
      }),
      // Exemplars are sourced from captures, so all YouTube leads re-classify fresh.
      this.prisma.lead.updateMany({
        where: { category: { not: null } },
        data: { category: null, categoryReason: null, categorizedAt: null },
      }),
    ]);
    this.logger.log(`Reset+reclassify: kept ${ids.length} exemplars, cleared ${caps.count} captures + ${leads.count} leads`);
    const res = await this.startCategorize({});
    return { ...res, exemplars: ids.length, cleared: caps.count + leads.count };
  }

  /**
   * Human-in-the-loop override: an admin confirms/corrects a capture's category. Marks it reviewed
   * (clears needsReview, confidence 100) so it becomes a trusted few-shot exemplar going forward. DB-only.
   */
  async setCategoryByHuman(id: string, category: 'LEAD' | 'PARTNER' | 'MARKETING' | 'NEWS' | 'OTHER', reviewedBy?: string) {
    const row = await this.prisma.sourceCapture.findUnique({ where: { id }, select: { category: true, aiCategory: true } });
    // Preserve the model's prediction at review time so the scorecard can score AI vs human (gold).
    const aiCategory = (row?.aiCategory ?? row?.category ?? null) as any;
    await this.prisma.sourceCapture.update({
      where: { id },
      data: {
        category, aiCategory, categoryReason: 'human review', categoryConfidence: 100,
        categoryVotes: { human: 1 } as any, needsReview: false,
        reviewedBy: reviewedBy ?? 'admin', reviewedAt: new Date(), categorizedAt: new Date(),
      },
    });
    return { ok: true, id, category };
  }

  /**
   * Classification scorecard (lever 6) — a confusion matrix + precision/recall/F1 per category,
   * computed from human-reviewed captures (gold = category, prediction = aiCategory). Pure DB read.
   */
  async classificationScorecard() {
    const CATS = ['LEAD', 'PARTNER', 'MARKETING', 'NEWS', 'OTHER'];
    const rows = await this.prisma.sourceCapture.findMany({
      where: { reviewedBy: { not: null }, aiCategory: { not: null }, category: { not: null } },
      select: { category: true, aiCategory: true },
    });
    const matrix: Record<string, Record<string, number>> = {};
    for (const a of CATS) { matrix[a] = {}; for (const p of CATS) matrix[a][p] = 0; }
    let correct = 0;
    for (const r of rows) {
      const a = String(r.category), p = String(r.aiCategory);
      if (matrix[a]?.[p] != null) { matrix[a][p]++; if (a === p) correct++; }
    }
    const total = rows.length;
    const metrics = CATS.map((c) => {
      const tp = matrix[c][c];
      const predicted = CATS.reduce((s, a) => s + matrix[a][c], 0); // column sum = times AI predicted c
      const support = CATS.reduce((s, p) => s + matrix[c][p], 0);    // row sum = gold count of c
      const precision = predicted ? tp / predicted : null;
      const recall = support ? tp / support : null;
      const f1 = precision != null && recall != null ? (precision + recall ? (2 * precision * recall) / (precision + recall) : 0) : null;
      return { category: c, support, precision, recall, f1 };
    });
    return { total, accuracy: total ? correct / total : null, categories: CATS, matrix, metrics };
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
