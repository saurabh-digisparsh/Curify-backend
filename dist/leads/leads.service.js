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
exports.LeadsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const ai_service_1 = require("../ai/ai.service");
const youtube_service_1 = require("./youtube.service");
const leads_config_1 = require("./leads.config");
const DEFAULT_GROUPS = [
    'researching',
    'procedure_considering',
    'where_to_go',
    'cant_afford',
    'pain_no_cure',
    'competitor',
    'western_affordability',
    'procedure_medtourism',
    'medtourism_keywords',
];
let LeadsService = class LeadsService {
    constructor(prisma, yt, ai) {
        this.prisma = prisma;
        this.yt = yt;
        this.ai = ai;
        this.logger = new common_1.Logger('Leads');
        this.cancelled = new Set();
    }
    sources() {
        return [{ key: 'YOUTUBE', label: 'YouTube', enabled: this.yt.configured() }];
    }
    async list(params) {
        const page = Math.max(1, Number(params.page) || 1);
        const pageSize = Math.min(50, Math.max(1, Number(params.pageSize) || 12));
        const where = {};
        if (params.source)
            where.source = params.source;
        if (params.region)
            where.region = params.region;
        if (params.status)
            where.status = params.status;
        if (params.type === 'short')
            where.isShort = true;
        if (params.type === 'video')
            where.isShort = false;
        if (params.minScore)
            where.intentScore = { gte: Number(params.minScore) };
        if (params.aiOnly)
            where.aiLead = true;
        if (params.persona)
            where.aiPersona = params.persona;
        if (params.q) {
            where.OR = [
                { title: { contains: params.q, mode: 'insensitive' } },
                { channelTitle: { contains: params.q, mode: 'insensitive' } },
                { aiProcedure: { contains: params.q, mode: 'insensitive' } },
            ];
        }
        let orderBy = { intentScore: 'desc' };
        if (params.sort === 'newest')
            orderBy = { createdAt: 'desc' };
        else if (params.sort === 'views')
            orderBy = { viewCount: 'desc' };
        else if (params.sort === 'published')
            orderBy = { publishedAt: 'desc' };
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
    async update(id, data) {
        return this.prisma.lead.update({
            where: { id },
            data: { status: data.status, notes: data.notes },
        });
    }
    async remove(id) {
        await this.prisma.lead.delete({ where: { id } });
        return { ok: true };
    }
    listJobs() {
        return this.prisma.leadJob.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
    }
    async cancel(id) {
        const job = await this.prisma.leadJob.findUnique({ where: { id } });
        if (!job)
            throw new Error('job not found');
        if (job.status !== 'RUNNING' && job.status !== 'PENDING')
            return { ok: false, reason: `job is ${job.status}` };
        this.cancelled.add(id);
        await this.prisma.leadJob.update({ where: { id }, data: { status: 'CANCELLED', error: 'cancelled by admin', finishedAt: new Date() } });
        return { ok: true, cancelled: true };
    }
    async allJobs() {
        const [yt, bd] = await Promise.all([
            this.prisma.leadJob.findMany({ orderBy: { createdAt: 'desc' }, take: 60 }),
            this.prisma.brightDataJob.findMany({ orderBy: { createdAt: 'desc' }, take: 60 }),
        ]);
        const norm = [
            ...yt.map((j) => ({
                kind: 'youtube', id: j.id, platform: 'YOUTUBE', label: 'YouTube', mode: 'discover+transcript+AI',
                status: j.status, trigger: j.trigger, found: j.found, saved: j.created, updated: j.updated,
                error: j.error, createdAt: j.createdAt, startedAt: j.startedAt, finishedAt: j.finishedAt,
            })),
            ...bd.map((j) => ({
                kind: 'brightdata', id: j.id, platform: j.platform, label: j.platform, mode: j.mode,
                status: j.status, trigger: j.trigger, found: j.records, saved: j.saved, updated: 0,
                error: j.error, createdAt: j.createdAt, startedAt: j.startedAt, finishedAt: j.finishedAt,
            })),
        ];
        return norm.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    }
    async youtubeJobDetails(jobId) {
        const job = await this.prisma.leadJob.findUnique({ where: { id: jobId } });
        const rows = await this.prisma.capturedVideo.findMany({ where: { lastJobId: jobId }, orderBy: { intentScore: 'desc' } });
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
    async listCaptured(params) {
        const page = Math.max(1, Number(params.page) || 1);
        const pageSize = Math.min(200, Math.max(1, Number(params.pageSize) || 50));
        const where = {};
        if (params.source)
            where.source = params.source;
        if (typeof params.qualified === 'boolean')
            where.qualified = params.qualified;
        if (typeof params.scored === 'boolean')
            where.scored = params.scored;
        if (params.dropReason)
            where.dropReason = params.dropReason;
        if (params.minScore)
            where.intentScore = { gte: Number(params.minScore) };
        if (params.q) {
            where.OR = [
                { title: { contains: params.q, mode: 'insensitive' } },
                { channelTitle: { contains: params.q, mode: 'insensitive' } },
            ];
        }
        let orderBy = { intentScore: 'desc' };
        if (params.sort === 'newest')
            orderBy = { firstSeenAt: 'desc' };
        else if (params.sort === 'views')
            orderBy = { viewCount: 'desc' };
        else if (params.sort === 'published')
            orderBy = { publishedAt: 'desc' };
        const [total, items] = await Promise.all([
            this.prisma.capturedVideo.count({ where }),
            this.prisma.capturedVideo.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
        ]);
        return { items, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
    }
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
    async captureVideo(jobId, data) {
        const { source, externalId, ...rest } = data;
        try {
            await this.prisma.capturedVideo.upsert({
                where: { source_externalId: { source, externalId } },
                create: { source, externalId, ...rest, lastJobId: jobId },
                update: { ...rest, lastJobId: jobId, timesSeen: { increment: 1 } },
            });
        }
        catch (e) {
            this.logger.warn(`captureVideo failed for ${source}:${externalId}: ${e.message}`);
        }
    }
    async generate(params) {
        const global = params.global !== false;
        const regions = (params.regions?.length ? params.regions : Object.keys(leads_config_1.REGION_CONFIG));
        const groups = params.queryGroups?.length ? params.queryGroups : DEFAULT_GROUPS;
        const targetCount = params.targetCount && params.targetCount > 0 ? params.targetCount : undefined;
        const maxSearches = Math.max(1, Math.min(70, params.maxSearches ?? (targetCount ? 70 : 12)));
        const minScore = params.minScore ?? 55;
        const aiClassify = params.aiClassify !== false;
        const order = params.order ?? 'date';
        const job = await this.prisma.leadJob.create({
            data: {
                source: 'YOUTUBE',
                status: 'RUNNING',
                trigger: params.trigger ?? 'manual',
                params: { global, regions, queryGroups: groups, maxSearches, minScore, aiClassify, order, targetCount },
                startedAt: new Date(),
            },
        });
        this.runJob(job.id, { global, regions, groups, maxSearches, minScore, aiClassify, order, targetCount })
            .catch((e) => this.logger.error(`Lead job ${job.id} crashed: ${e.message}`));
        return job;
    }
    async runJob(jobId, cfg) {
        const groupLists = cfg.groups.map((g) => leads_config_1.QUERY_GROUPS[g] || []);
        const maxLen = groupLists.reduce((m, a) => Math.max(m, a.length), 0);
        const seenQ = new Set();
        const queries = [];
        for (let i = 0; i < maxLen; i++) {
            for (const list of groupLists) {
                const q = list[i];
                if (!q)
                    continue;
                const k = q.toLowerCase().trim();
                if (seenQ.has(k))
                    continue;
                seenQ.add(k);
                queries.push(q);
            }
        }
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
        let capturedRaw = 0;
        let stoppedReason = null;
        const normTitle = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        const dupKeys = (title, channelId) => {
            const n = normTitle(title);
            const keys = [n];
            if (channelId)
                keys.push(`${channelId}|${n.slice(0, 40)}`);
            return keys;
        };
        const existingKeys = new Set();
        for (const l of await this.prisma.lead.findMany({ where: { source: 'YOUTUBE' }, select: { title: true, channelId: true } })) {
            dupKeys(l.title, l.channelId).forEach((k) => existingKeys.add(k));
        }
        const work = [];
        if (cfg.global) {
            for (const query of queries)
                work.push({ query });
        }
        else {
            for (const query of queries) {
                for (const region of cfg.regions) {
                    const c = leads_config_1.REGION_CONFIG[region];
                    work.push({ region, code: c.codes[0], lang: c.langs[0], query });
                }
            }
        }
        const recentCutoff = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString();
        const MAX_PAGES = 6;
        try {
            outer: for (const w of work) {
                let pageToken;
                let pages = 0;
                do {
                    if (this.cancelled.has(jobId)) {
                        stoppedReason = 'cancelled';
                        break outer;
                    }
                    if (searches >= cfg.maxSearches) {
                        stoppedReason = 'maxSearches reached';
                        break outer;
                    }
                    if (cfg.targetCount && created >= cfg.targetCount) {
                        stoppedReason = 'target reached';
                        break outer;
                    }
                    let result;
                    try {
                        result = await this.yt.search(w.query, {
                            regionCode: w.code,
                            relevanceLanguage: w.lang,
                            publishedAfter: recentCutoff,
                            maxResults: 50,
                            order: cfg.order,
                            pageToken,
                        });
                    }
                    catch (e) {
                        if (e instanceof youtube_service_1.QuotaExceededError) {
                            stoppedReason = 'quota cap reached';
                            break outer;
                        }
                        throw e;
                    }
                    searches++;
                    pageToken = result.nextPageToken;
                    pages++;
                    const videos = result.videos;
                    const allScored = videos.map((v) => ({ v, ...(0, leads_config_1.scoreIntent)(`${v.title} ${v.description}`) }));
                    const scored = allScored.filter((s) => s.score >= cfg.minScore);
                    for (const s of allScored) {
                        if (s.score >= cfg.minScore)
                            continue;
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
                            matchedKeywords: s.matched,
                            query: w.query,
                            scored: false,
                            qualified: false,
                            dropReason: 'below_minscore',
                        });
                        capturedRaw++;
                    }
                    if (!scored.length)
                        continue;
                    const details = await this.yt.videoDetails(scored.map((s) => s.v.videoId));
                    const countries = cfg.global ? await this.yt.channelCountries(scored.map((s) => s.v.channelId)) : {};
                    for (const s of scored) {
                        const d = details[s.v.videoId] || {};
                        found++;
                        const country = countries[s.v.channelId];
                        const region = cfg.global ? (0, leads_config_1.regionFromCode)(country) : w.region;
                        const regionCode = cfg.global ? (country || null) : w.code;
                        const lang = cfg.global ? null : w.lang;
                        let transcript = null;
                        let verdict = null;
                        if (cfg.aiClassify) {
                            transcript = await this.yt.getTranscript(s.v.videoId);
                            if (transcript) {
                                verdict = await this.ai.analyzeTranscript({ title: s.v.title, description: s.v.description, transcript });
                                aiClassified++;
                            }
                        }
                        const intentScore = verdict ? verdict.score : s.score;
                        const data = {
                            source: 'YOUTUBE',
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
                            matchedKeywords: s.matched,
                            query: w.query,
                            transcript,
                            aiLead: verdict ? verdict.isLead : null,
                            aiConfidence: verdict ? verdict.confidence : null,
                            aiPersona: verdict ? verdict.persona : null,
                            aiProcedure: verdict ? verdict.procedure : null,
                            aiSummary: verdict ? verdict.summary : null,
                        };
                        const { transcript: _t, ...captureData } = data;
                        const capture = (qualified, dropReason) => this.captureVideo(jobId, { ...captureData, scored: true, qualified, dropReason });
                        if (verdict && (!verdict.isLead || verdict.confidence <= leads_config_1.AI_MIN_CONFIDENCE)) {
                            dropped++;
                            await capture(false, 'ai_rejected');
                            continue;
                        }
                        const existing = await this.prisma.lead.findUnique({
                            where: { source_externalId: { source: 'YOUTUBE', externalId: s.v.videoId } },
                            select: { id: true },
                        });
                        if (existing) {
                            await this.prisma.lead.update({ where: { id: existing.id }, data });
                            updated++;
                            await capture(true, null);
                        }
                        else if (dupKeys(s.v.title, s.v.channelId).some((k) => existingKeys.has(k))) {
                            duplicates++;
                            await capture(false, 'duplicate');
                        }
                        else {
                            await this.prisma.lead.create({ data });
                            dupKeys(s.v.title, s.v.channelId).forEach((k) => existingKeys.add(k));
                            created++;
                            await capture(true, null);
                            if (cfg.targetCount && created >= cfg.targetCount)
                                break;
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
            this.logger.log(`Lead job ${jobId} ${cancelled ? 'CANCELLED' : 'done'}: ${searches} searches, ${found} found, ${created} new, ${updated} updated, ${duplicates} dup reposts, ${dropped} dropped (<${leads_config_1.AI_MIN_CONFIDENCE}% AI), ${capturedRaw} below-floor captured (analysis)${stoppedReason ? ` (${stoppedReason})` : ''}`);
        }
        catch (e) {
            const quotaUsed = (await this.yt.quotaStatus()).used - startQuota;
            await this.prisma.leadJob.update({
                where: { id: jobId },
                data: { status: 'FAILED', found, created, updated, aiClassified, quotaUsed: Math.max(0, quotaUsed), error: e.message?.slice(0, 500), finishedAt: new Date() },
            });
            this.logger.error(`Lead job ${jobId} failed: ${e.message}`);
        }
    }
};
exports.LeadsService = LeadsService;
exports.LeadsService = LeadsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        youtube_service_1.YouTubeService,
        ai_service_1.AiService])
], LeadsService);
//# sourceMappingURL=leads.service.js.map