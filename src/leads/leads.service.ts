import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { YouTubeService, QuotaExceededError, YtVideo } from './youtube.service';
import {
  REGION_CONFIG,
  QUERY_GROUPS,
  RegionKey,
  scoreIntent,
  regionFromCode,
  YT_SEARCH_COST,
  AI_MIN_CONFIDENCE,
} from './leads.config';

// Default themes used when no queryGroups are specified. Cover all six personas
// (not just the two first-person-ask groups) so a default run actually surfaces a
// useful volume of leads across the funnel — undecided, affordability, suffering,
// active researchers, procedure-considerers, and competitor-aware prospects.
const DEFAULT_GROUPS = [
  'researching',
  'procedure_considering',
  'where_to_go',
  'cant_afford',
  'pain_no_cure',
  'competitor',
  'western_affordability',
  'procedure_medtourism',
  // The expanded medical-tourism keyword pack (same keywords used for Bright Data
  // social capture) — interleaved into YouTube discovery alongside the persona groups.
  'medtourism_keywords',
];

export interface GenerateParams {
  regions?: RegionKey[];
  queryGroups?: string[];
  maxSearches?: number; // safety cap on search.list calls this run
  minScore?: number; // only persist candidates scoring >= this
  aiClassify?: boolean;
  order?: 'date' | 'relevance'; // 'date' surfaces fresh small-creator videos (default)
  global?: boolean; // true = search worldwide (no regionCode); region inferred from channel country
  targetCount?: number; // keep searching (paginating) until this many NEW leads are stored, or quota runs out
  trigger?: 'manual' | 'scheduled';
}

@Injectable()
export class LeadsService {
  private readonly logger = new Logger('Leads');
  /** Job ids the admin asked to cancel — checked inside the run loop. */
  private readonly cancelled = new Set<string>();

  constructor(
    private prisma: PrismaService,
    private yt: YouTubeService,
    private ai: AiService,
  ) {}

  /** Lead sources handled by this (YouTube-only) service. Reddit/Quora/IG/FB are
   *  served by the Bright Data social-capture pipeline (BrightDataService). */
  sources() {
    return [{ key: 'YOUTUBE', label: 'YouTube', enabled: this.yt.configured() }];
  }

  // ── Read APIs ──────────────────────────────────────────────────────────────

  async list(params: {
    page?: number; pageSize?: number;
    source?: string; region?: string; status?: string;
    type?: 'video' | 'short'; minScore?: number; aiOnly?: boolean;
    persona?: string; q?: string; sort?: string;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(params.pageSize) || 12));

    const where: Prisma.LeadWhereInput = {};
    if (params.source) where.source = params.source as any;
    if (params.region) where.region = params.region as any;
    if (params.status) where.status = params.status as any;
    if (params.type === 'short') where.isShort = true;
    if (params.type === 'video') where.isShort = false;
    if (params.minScore) where.intentScore = { gte: Number(params.minScore) };
    if (params.aiOnly) where.aiLead = true;
    if (params.persona) where.aiPersona = params.persona;
    if (params.q) {
      where.OR = [
        { title: { contains: params.q, mode: 'insensitive' } },
        { channelTitle: { contains: params.q, mode: 'insensitive' } },
        { aiProcedure: { contains: params.q, mode: 'insensitive' } },
      ];
    }

    let orderBy: Prisma.LeadOrderByWithRelationInput = { intentScore: 'desc' };
    if (params.sort === 'newest') orderBy = { createdAt: 'desc' };
    else if (params.sort === 'views') orderBy = { viewCount: 'desc' };
    else if (params.sort === 'published') orderBy = { publishedAt: 'desc' };

    const [total, items] = await Promise.all([
      this.prisma.lead.count({ where }),
      this.prisma.lead.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
    ]);
    return { items, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async stats() {
    const [byStatus, byRegion, total, quota, lastJob] = await Promise.all([
      this.prisma.lead.groupBy({ by: ['status'], _count: true }),
      this.prisma.lead.groupBy({ by: ['region'], _count: true }),
      this.prisma.lead.count(),
      this.yt.quotaStatus(),
      this.prisma.leadJob.findFirst({ orderBy: { createdAt: 'desc' } }),
    ]);
    return {
      total,
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
      byRegion: Object.fromEntries(byRegion.map((s) => [s.region, s._count])),
      quota: { ...quota, configured: this.yt.configured() },
      lastJob,
    };
  }

  async update(id: string, data: { status?: string; notes?: string }) {
    return this.prisma.lead.update({
      where: { id },
      data: { status: data.status as any, notes: data.notes },
    });
  }

  async remove(id: string) {
    await this.prisma.lead.delete({ where: { id } });
    return { ok: true };
  }

  listJobs() {
    return this.prisma.leadJob.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
  }

  /** Request cancellation of a running YouTube lead job. */
  async cancel(id: string) {
    const job = await this.prisma.leadJob.findUnique({ where: { id } });
    if (!job) throw new Error('job not found');
    if (job.status !== 'RUNNING' && job.status !== 'PENDING') return { ok: false, reason: `job is ${job.status}` };
    this.cancelled.add(id);
    await this.prisma.leadJob.update({ where: { id }, data: { status: 'CANCELLED', error: 'cancelled by admin', finishedAt: new Date() } });
    return { ok: true, cancelled: true };
  }

  /** Unified job list across YouTube (LeadJob) + Bright Data (BrightDataJob), newest first. */
  async allJobs() {
    const [yt, bd] = await Promise.all([
      this.prisma.leadJob.findMany({ orderBy: { createdAt: 'desc' }, take: 60 }),
      this.prisma.brightDataJob.findMany({ orderBy: { createdAt: 'desc' }, take: 60 }),
    ]);
    const norm = [
      ...yt.map((j) => ({
        kind: 'youtube' as const, id: j.id, platform: 'YOUTUBE', label: 'YouTube', mode: 'discover+transcript+AI',
        status: j.status, trigger: j.trigger, found: j.found, saved: j.created, updated: j.updated,
        error: j.error, createdAt: j.createdAt, startedAt: j.startedAt, finishedAt: j.finishedAt,
      })),
      ...bd.map((j) => ({
        kind: 'brightdata' as const, id: j.id, platform: j.platform, label: j.platform, mode: j.mode,
        status: j.status, trigger: j.trigger, found: j.records, saved: j.saved, updated: 0,
        error: j.error, createdAt: j.createdAt, startedAt: j.startedAt, finishedAt: j.finishedAt,
      })),
    ];
    return norm.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }

  /**
   * Full per-result breakdown for one YouTube job: every video that was evaluated,
   * the phase it passed/failed, WHY it was accepted or rejected, and its source URL.
   */
  async youtubeJobDetails(jobId: string) {
    const job = await this.prisma.leadJob.findUnique({ where: { id: jobId } });
    const rows = await this.prisma.capturedVideo.findMany({ where: { lastJobId: jobId }, orderBy: { intentScore: 'desc' } });
    // Only the videos that passed the keyword floor reached AI — those are the
    // meaningful accept/reject decisions. Below-floor videos are summarised as a count.
    const scored = rows.filter((r) => r.scored);
    const belowFloor = rows.length - scored.length;
    const results = scored.map((r) => {
      const phases = [
        { name: 'Keyword pre-filter', status: 'pass', detail: `heuristic score ${r.intentScore} passed the floor` },
        { name: 'Transcript + AI', status: r.aiLead == null ? 'skipped' : (r.aiLead ? 'pass' : 'reject'),
          detail: r.aiLead == null ? 'no transcript — heuristic only (flagged)' : `AI ${r.aiLead ? 'lead' : 'not a lead'} (${r.aiConfidence ?? '?'}%): ${r.aiSummary ?? ''}` },
      ];
      const accepted = r.qualified;
      const reason = accepted
        ? (r.aiSummary ? `AI lead: ${r.aiSummary}` : 'passed heuristic — no transcript to verify (flagged)')
        : r.dropReason === 'ai_rejected' ? `AI rejected (broadcast/tutorial/promo): ${r.aiSummary ?? 'not a personal lead'}`
        : r.dropReason === 'duplicate' ? 'duplicate of an already-stored video'
        : (r.dropReason ?? 'rejected');
      return { source: r.url, title: r.title, score: r.intentScore, outcome: accepted ? 'accepted' : 'rejected', reason, phases, persona: r.aiPersona, procedure: r.aiProcedure };
    });
    const accepted = results.filter((r) => r.outcome === 'accepted').length;
    return {
      job, kind: 'youtube',
      summary: { total: results.length, accepted, rejected: results.length - accepted, belowFloorSkipped: belowFloor },
      results,
    };
  }

  /**
   * Raw captured-video dataset (the full funnel, for analysis). Separate from
   * `list()` which returns only qualified leads shown in the UI. Defaults to the
   * highest-intent videos first; filterable by qualified/scored/source/minScore.
   */
  async listCaptured(params: {
    page?: number; pageSize?: number;
    source?: string; qualified?: boolean; scored?: boolean;
    minScore?: number; dropReason?: string; q?: string; sort?: string;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(params.pageSize) || 50));

    const where: Prisma.CapturedVideoWhereInput = {};
    if (params.source) where.source = params.source as any;
    if (typeof params.qualified === 'boolean') where.qualified = params.qualified;
    if (typeof params.scored === 'boolean') where.scored = params.scored;
    if (params.dropReason) where.dropReason = params.dropReason;
    if (params.minScore) where.intentScore = { gte: Number(params.minScore) };
    if (params.q) {
      where.OR = [
        { title: { contains: params.q, mode: 'insensitive' } },
        { channelTitle: { contains: params.q, mode: 'insensitive' } },
      ];
    }

    let orderBy: Prisma.CapturedVideoOrderByWithRelationInput = { intentScore: 'desc' };
    if (params.sort === 'newest') orderBy = { firstSeenAt: 'desc' };
    else if (params.sort === 'views') orderBy = { viewCount: 'desc' };
    else if (params.sort === 'published') orderBy = { publishedAt: 'desc' };

    const [total, items] = await Promise.all([
      this.prisma.capturedVideo.count({ where }),
      this.prisma.capturedVideo.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
    ]);
    return { items, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
  }

  /** Aggregate funnel counts over the captured dataset (for analysis dashboards). */
  async capturedStats() {
    const [total, scored, qualified, byDropReason, bySource] = await Promise.all([
      this.prisma.capturedVideo.count(),
      this.prisma.capturedVideo.count({ where: { scored: true } }),
      this.prisma.capturedVideo.count({ where: { qualified: true } }),
      this.prisma.capturedVideo.groupBy({ by: ['dropReason'], _count: true }),
      this.prisma.capturedVideo.groupBy({ by: ['source'], _count: true }),
    ]);
    return {
      total, scored, qualified,
      byDropReason: Object.fromEntries(byDropReason.map((d) => [d.dropReason ?? 'qualified', d._count])),
      bySource: Object.fromEntries(bySource.map((s) => [s.source, s._count])),
    };
  }

  /**
   * Upsert one captured video into the analysis dataset. Idempotent on
   * (source, externalId): re-seeing a video refreshes its data and bumps timesSeen.
   * Best-effort — a capture failure must never abort a generation run.
   */
  private async captureVideo(jobId: string, data: any) {
    const { source, externalId, ...rest } = data;
    try {
      await this.prisma.capturedVideo.upsert({
        where: { source_externalId: { source, externalId } },
        create: { source, externalId, ...rest, lastJobId: jobId },
        update: { ...rest, lastJobId: jobId, timesSeen: { increment: 1 } },
      });
    } catch (e: any) {
      this.logger.warn(`captureVideo failed for ${source}:${externalId}: ${e.message}`);
    }
  }

  // ── Generation run ───────────────────────────────────────────────────────────

  async generate(params: GenerateParams) {
    // Global (worldwide) search by default — relevance to the reference URL is the
    // topic, not the country. Set global:false + regions to target specific markets.
    const global = params.global !== false;
    const regions = (params.regions?.length ? params.regions : (Object.keys(REGION_CONFIG) as RegionKey[]));
    const groups = params.queryGroups?.length ? params.queryGroups : DEFAULT_GROUPS;
    const targetCount = params.targetCount && params.targetCount > 0 ? params.targetCount : undefined;
    // With a target, allow many searches (the quota cap is the real limit); otherwise a fixed cap.
    const maxSearches = Math.max(1, Math.min(70, params.maxSearches ?? (targetCount ? 70 : 12)));
    // Keep reasonably-strong leads: intentScore must be >= 55 (one strong persona
    // signal plus an abroad/medical-tourism qualifier). The AI classifier is the
    // real precision gate downstream, so the heuristic floor only needs to widen
    // the funnel without flooding the model with noise.
    const minScore = params.minScore ?? 55;
    const aiClassify = params.aiClassify !== false;
    // Default to newest-first: relevance ordering buries brand-new small-creator
    // videos (the prime lead type) below the top results; date ordering surfaces them.
    const order = params.order ?? 'date';

    const job = await this.prisma.leadJob.create({
      data: {
        source: 'YOUTUBE',
        status: 'RUNNING',
        trigger: params.trigger ?? 'manual',
        params: { global, regions, queryGroups: groups, maxSearches, minScore, aiClassify, order, targetCount } as any,
        startedAt: new Date(),
      },
    });

    // Run asynchronously so the HTTP request returns immediately with the job.
    this.runJob(job.id, { global, regions, groups, maxSearches, minScore, aiClassify, order, targetCount })
      .catch((e) => this.logger.error(`Lead job ${job.id} crashed: ${e.message}`));
    return job;
  }

  private async runJob(
    jobId: string,
    cfg: { global: boolean; regions: RegionKey[]; groups: string[]; maxSearches: number; minScore: number; aiClassify: boolean; order: 'date' | 'relevance'; targetCount?: number },
  ) {
    // Round-robin interleave across the selected groups instead of concatenating, so
    // a quota-capped run (the cron does only ~12 searches) samples EVERY group —
    // including the medical-tourism keyword pack — rather than spending its whole
    // budget on the first group's phrases. De-duped (groups can share a phrase).
    const groupLists = cfg.groups.map((g) => QUERY_GROUPS[g] || []);
    const maxLen = groupLists.reduce((m, a) => Math.max(m, a.length), 0);
    const seenQ = new Set<string>();
    const queries: string[] = [];
    for (let i = 0; i < maxLen; i++) {
      for (const list of groupLists) {
        const q = list[i];
        if (!q) continue;
        const k = q.toLowerCase().trim();
        if (seenQ.has(k)) continue;
        seenQ.add(k);
        queries.push(q);
      }
    }
    // Rotate the query window by day so a quota-capped run (the cron does only ~12
    // searches) samples a DIFFERENT slice of the large query+keyword set each day.
    // Without this, date-ordered search keeps hitting the same top videos → they
    // dedup to updates and the run creates 0 new leads. The window advances by
    // maxSearches/day so the whole set is covered over time.
    if (queries.length > cfg.maxSearches) {
      const dayIdx = Math.floor(Date.now() / 86_400_000);
      const offset = (dayIdx * cfg.maxSearches) % queries.length;
      queries.push(...queries.splice(0, offset));
    }
    const startQuota = (await this.yt.quotaStatus()).used;
    let searches = 0;
    let found = 0;
    let created = 0;
    let updated = 0;
    let duplicates = 0;
    let dropped = 0;
    let aiClassified = 0;
    let capturedRaw = 0; // below-floor videos saved to captured_videos for analysis
    let stoppedReason: string | null = null;

    // In-memory dedup keys for content already stored — drops reposts / re-uploads
    // that share a title (or are the same channel's near-identical title variant,
    // e.g. "...Ms. Mariama's Journey" vs "...Journey from Sierra Leone") but have a
    // different video id, on top of the exact (source, externalId) dedup.
    const normTitle = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    // Keys: the full normalized title, plus "<channelId>|<first 40 norm chars>".
    const dupKeys = (title: string, channelId?: string | null) => {
      const n = normTitle(title);
      const keys = [n];
      if (channelId) keys.push(`${channelId}|${n.slice(0, 40)}`);
      return keys;
    };
    const existingKeys = new Set<string>();
    for (const l of await this.prisma.lead.findMany({ where: { source: 'YOUTUBE' }, select: { title: true, channelId: true } })) {
      dupKeys(l.title, l.channelId).forEach((k) => existingKeys.add(k));
    }

    // Build the work list. Global mode = one pass per query, no region targeting
    // (region is inferred later from the creator's channel country). Targeted mode
    // = region × query with regionCode/language biasing.
    const work: { region?: RegionKey; code?: string; lang?: string; query: string }[] = [];
    if (cfg.global) {
      for (const query of queries) work.push({ query });
    } else {
      for (const query of queries) {
        for (const region of cfg.regions) {
          const c = REGION_CONFIG[region];
          work.push({ region, code: c.codes[0], lang: c.langs[0], query });
        }
      }
    }

    // Consider videos published in the last 1 year — widens recall to genuine
    // (older) individual asks/journeys without loosening the AI quality gate.
    const recentCutoff = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString();

    const MAX_PAGES = 6; // up to 6 pages (~300 videos) per query when chasing a target
    try {
      outer:
      for (const w of work) {
        let pageToken: string | undefined;
        let pages = 0;
        do {
          if (this.cancelled.has(jobId)) { stoppedReason = 'cancelled'; break outer; }
          if (searches >= cfg.maxSearches) { stoppedReason = 'maxSearches reached'; break outer; }
          if (cfg.targetCount && created >= cfg.targetCount) { stoppedReason = 'target reached'; break outer; }
          let result: { videos: YtVideo[]; nextPageToken?: string };
          try {
            result = await this.yt.search(w.query, {
              regionCode: w.code,
              relevanceLanguage: w.lang,
              publishedAfter: recentCutoff,
              maxResults: 50,
              order: cfg.order,
              pageToken,
            });
          } catch (e) {
            if (e instanceof QuotaExceededError) { stoppedReason = 'quota cap reached'; break outer; }
            throw e;
          }
          searches++;
          pageToken = result.nextPageToken;
          pages++;
          const videos = result.videos;

        // Heuristic score for EVERY returned video (not just survivors) so the
        // full funnel can be persisted to captured_videos for analysis.
        const allScored = videos.map((v) => ({ v, ...scoreIntent(`${v.title} ${v.description}`) }));
        const scored = allScored.filter((s) => s.score >= cfg.minScore);

        // Capture below-floor videos straight away (snippet + heuristic score only —
        // no enrichment/AI is spent on them). Survivors are captured with full data
        // + AI verdict after classification below.
        for (const s of allScored) {
          if (s.score >= cfg.minScore) continue;
          await this.captureVideo(jobId, {
            source: 'YOUTUBE',
            externalId: s.v.videoId,
            title: s.v.title,
            description: s.v.description,
            url: `https://www.youtube.com/watch?v=${s.v.videoId}`,
            thumbnailUrl: s.v.thumbnailUrl,
            channelId: s.v.channelId,
            channelTitle: s.v.channelTitle,
            publishedAt: s.v.publishedAt ? new Date(s.v.publishedAt) : null,
            intentScore: s.score,
            matchedKeywords: s.matched as any,
            query: w.query,
            scored: false,
            qualified: false,
            dropReason: 'below_minscore',
          });
          capturedRaw++;
        }

        if (!scored.length) continue; // keep paging this query

        // Enrich the survivors with stats + Short detection (cheap: 1 unit/batch)
        const details = await this.yt.videoDetails(scored.map((s) => s.v.videoId));

        // Global mode: infer each creator's region from their channel country.
        const countries = cfg.global ? await this.yt.channelCountries(scored.map((s) => s.v.channelId)) : {};

        for (const s of scored) {
          const d = details[s.v.videoId] || {};
          found++;

          // Region/regionCode: in global mode infer from channel country; in targeted
          // mode use the searched region/code.
          const country = countries[s.v.channelId];
          const region = cfg.global ? regionFromCode(country) : w.region;
          const regionCode = cfg.global ? (country || null) : w.code;
          const lang = cfg.global ? null : w.lang;

          // Fetch the transcript (free) and let AI read the actual spoken content to
          // qualify + score the lead — far more accurate than title/description alone.
          let transcript: string | null = null;
          let verdict: Awaited<ReturnType<AiService['analyzeTranscript']>> | null = null;
          if (cfg.aiClassify) {
            transcript = await this.yt.getTranscript(s.v.videoId);
            if (transcript) {
              verdict = await this.ai.analyzeTranscript({ title: s.v.title, description: s.v.description, transcript });
              aiClassified++;
            }
          }
          // Score: prefer the AI transcript score when available, else the heuristic.
          const intentScore = verdict ? verdict.score : s.score;

          // Full record shared by the qualified-only `leads` table and the
          // analysis-only `captured_videos` table.
          const data = {
            source: 'YOUTUBE' as const,
            externalId: s.v.videoId,
            title: s.v.title,
            description: s.v.description,
            url: `https://www.youtube.com/watch?v=${s.v.videoId}`,
            thumbnailUrl: s.v.thumbnailUrl,
            channelId: s.v.channelId,
            channelTitle: s.v.channelTitle,
            publishedAt: s.v.publishedAt ? new Date(s.v.publishedAt) : null,
            isShort: d.isShort ?? false,
            region,
            regionCode,
            lang,
            viewCount: d.viewCount ?? null,
            likeCount: d.likeCount ?? null,
            commentCount: d.commentCount ?? null,
            intentScore,
            matchedKeywords: s.matched as any,
            query: w.query,
            transcript,
            aiLead: verdict ? verdict.isLead : null,
            aiConfidence: verdict ? verdict.confidence : null,
            aiPersona: verdict ? verdict.persona : null,
            aiProcedure: verdict ? verdict.procedure : null,
            aiSummary: verdict ? verdict.summary : null,
          };

          // Always capture the enriched survivor for analysis; `qualified`/`dropReason`
          // record where it landed in the funnel. (transcript lives only on the lead.)
          const { transcript: _t, ...captureData } = data;
          const capture = (qualified: boolean, dropReason: string | null) =>
            this.captureVideo(jobId, { ...captureData, scored: true, qualified, dropReason });

          // AI gate: keep leads the transcript AI confirmed (asks / researchers /
          // info-seekers / personal journeys) above the confidence floor. Tutorials,
          // guides and promos are rejected by the AI itself (isLead=false).
          if (verdict && (!verdict.isLead || verdict.confidence <= AI_MIN_CONFIDENCE)) {
            dropped++;
            await capture(false, 'ai_rejected');
            continue;
          }

          // Dedup on (source, externalId): refresh metrics/score but keep admin's status/notes.
          const existing = await this.prisma.lead.findUnique({
            where: { source_externalId: { source: 'YOUTUBE', externalId: s.v.videoId } },
            select: { id: true },
          });
          if (existing) {
            await this.prisma.lead.update({ where: { id: existing.id }, data });
            updated++;
            await capture(true, null);
          } else if (dupKeys(s.v.title, s.v.channelId).some((k) => existingKeys.has(k))) {
            // Same content already stored under a different video id — skip the repost.
            duplicates++;
            await capture(false, 'duplicate');
          } else {
            await this.prisma.lead.create({ data });
            dupKeys(s.v.title, s.v.channelId).forEach((k) => existingKeys.add(k));
            created++;
            await capture(true, null);
            if (cfg.targetCount && created >= cfg.targetCount) break; // hit target — stop this batch
          }
        }
        } while (pageToken && pages < MAX_PAGES && !(cfg.targetCount && created >= cfg.targetCount));
      }

      const quotaUsed = (await this.yt.quotaStatus()).used - startQuota;
      const cancelled = this.cancelled.has(jobId);
      this.cancelled.delete(jobId);
      await this.prisma.leadJob.update({
        where: { id: jobId },
        data: {
          status: cancelled ? 'CANCELLED' : 'DONE',
          found, created, updated, aiClassified,
          quotaUsed: Math.max(0, quotaUsed),
          error: stoppedReason,
          finishedAt: new Date(),
        },
      });
      this.logger.log(`Lead job ${jobId} ${cancelled ? 'CANCELLED' : 'done'}: ${searches} searches, ${found} found, ${created} new, ${updated} updated, ${duplicates} dup reposts, ${dropped} dropped (<${AI_MIN_CONFIDENCE}% AI), ${capturedRaw} below-floor captured (analysis)${stoppedReason ? ` (${stoppedReason})` : ''}`);
    } catch (e: any) {
      const quotaUsed = (await this.yt.quotaStatus()).used - startQuota;
      await this.prisma.leadJob.update({
        where: { id: jobId },
        data: { status: 'FAILED', found, created, updated, aiClassified, quotaUsed: Math.max(0, quotaUsed), error: e.message?.slice(0, 500), finishedAt: new Date() },
      });
      this.logger.error(`Lead job ${jobId} failed: ${e.message}`);
    }
  }

}
