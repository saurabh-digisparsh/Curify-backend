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
var BrightDataService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrightDataService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const ai_service_1 = require("../ai/ai.service");
const leads_config_1 = require("./leads.config");
const BASE = 'https://api.brightdata.com/datasets/v3';
let BrightDataService = BrightDataService_1 = class BrightDataService {
    constructor(prisma, ai) {
        this.prisma = prisma;
        this.ai = ai;
        this.logger = new common_1.Logger('BrightData');
        this.key = process.env.BRIGHT_DATA_API_KEY;
        this.cancelled = new Set();
        this.categorize = {
            running: false,
            processed: 0,
            total: 0,
            updated: 0,
            byCategory: {},
            error: null,
            startedAt: null,
            finishedAt: null,
        };
        this.balanceCache = null;
        this.mapCapturePost = (r) => ({
            id: r.id, platform: r.platform, url: r.url, title: r.title, body: r.body,
            author: r.author, postedAt: r.postedAt, isSpam: r.isSpam,
            category: r.category, categoryReason: r.categoryReason, createdAt: r.createdAt,
        });
        this.mapLeadPost = (r) => ({
            id: r.id, platform: 'YOUTUBE', url: r.url, title: r.title,
            body: r.aiSummary || r.description || (r.transcript ? String(r.transcript).slice(0, 600) : ''),
            author: r.channelTitle, postedAt: r.publishedAt, isSpam: false,
            category: r.category, categoryReason: r.categoryReason, createdAt: r.createdAt,
        });
    }
    configured() {
        return !!this.key;
    }
    async cancel(id) {
        const job = await this.prisma.brightDataJob.findUnique({ where: { id } });
        if (!job)
            throw new Error('job not found');
        if (job.status !== 'RUNNING' && job.status !== 'PENDING' && job.status !== 'READY')
            return { ok: false, reason: `job is ${job.status}` };
        this.cancelled.add(id);
        await this.prisma.brightDataJob.update({ where: { id }, data: { status: 'CANCELLED', error: 'cancelled by admin', finishedAt: new Date() } });
        return { ok: true, cancelled: true };
    }
    async jobDetails(jobId) {
        const job = await this.prisma.brightDataJob.findUnique({ where: { id: jobId } });
        const rows = await this.prisma.sourceCapture.findMany({ where: { jobId }, orderBy: { signalCount: 'desc' } });
        const results = rows.map((r) => {
            const err = r.raw?.error;
            const accepted = !err && !r.isSpam;
            const reason = err ? `Bright Data error: ${String(err).slice(0, 120)}`
                : r.isSpam ? 'rejected — spam (academic-cheating / off-topic)'
                    : `accepted — ${r.signalCount}/3 signals (${r.temperature}); procedure=${r.hasProcedure}, cost=${r.hasCost}, origin=${r.hasOrigin}`;
            const phases = [
                { name: 'Scrape', status: err ? 'reject' : 'pass', detail: err ? String(err).slice(0, 100) : 'record returned' },
            ];
            if (!err)
                phases.push({ name: 'Spam filter', status: r.isSpam ? 'reject' : 'pass', detail: r.isSpam ? 'matched spam terms' : 'clean' });
            if (!err && !r.isSpam)
                phases.push({ name: '3-signal score', status: 'pass', detail: `score ${r.intentScore}, ${r.temperature}` });
            return { source: r.url, title: r.title, score: r.intentScore, outcome: accepted ? 'accepted' : 'rejected', reason, phases };
        });
        const accepted = results.filter((r) => r.outcome === 'accepted').length;
        return { job, kind: 'brightdata', summary: { total: results.length, accepted, rejected: results.length - accepted }, results };
    }
    async spentCredits() {
        const agg = await this.prisma.brightDataJob.aggregate({
            _sum: { records: true },
            where: { status: { not: 'FAILED' } },
        });
        return agg._sum.records ?? 0;
    }
    async remainingCredits() {
        const account = await this.accountBalance();
        if (account && account.available <= 0)
            return 0;
        return Math.max(0, leads_config_1.BRIGHT_DATA_CREDIT_CAP - (await this.spentCredits()));
    }
    async budget() {
        const [spent, account] = await Promise.all([this.spentCredits(), this.accountBalance()]);
        return {
            cap: leads_config_1.BRIGHT_DATA_CREDIT_CAP,
            spent,
            remaining: Math.max(0, leads_config_1.BRIGHT_DATA_CREDIT_CAP - spent),
            account: account ?? { configured: false },
        };
    }
    async accountBalance() {
        if (!this.key)
            return null;
        const now = Date.now();
        if (this.balanceCache && now - this.balanceCache.at < 60_000)
            return this.balanceCache.data;
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
            const j = await res.json();
            const balance = Number(j.balance ?? 0);
            const pendingBalance = Number(j.pending_balance ?? j.pending_costs ?? 0);
            const data = { configured: true, balance, pendingBalance, available: balance - pendingBalance };
            this.balanceCache = { at: now, data };
            return data;
        }
        catch (e) {
            this.logger.warn(`Bright Data balance fetch failed: ${e.message}`);
            this.balanceCache = { at: now, data: null };
            return null;
        }
    }
    async post(path, body) {
        const res = await fetch(`${BASE}/${path}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        }
        catch {
            data = text;
        }
        if (!res.ok)
            throw new Error(`BrightData ${res.status}: ${String(text).slice(0, 200)}`);
        return data;
    }
    async get(path) {
        const res = await fetch(`${BASE}/${path}`, { headers: { Authorization: `Bearer ${this.key}` } });
        const text = await res.text();
        if (!res.ok)
            throw new Error(`BrightData ${res.status}: ${String(text).slice(0, 200)}`);
        try {
            return JSON.parse(text);
        }
        catch {
            return text;
        }
    }
    async downloadSnapshot(snapshotId) {
        for (let i = 0; i < 60; i++) {
            const data = await this.get(`snapshot/${snapshotId}?format=json`);
            const arr = Array.isArray(data) ? data : data?.data ?? [data];
            const first = arr[0];
            if (first && typeof first === 'object' && first.status === 'building') {
                await this.sleep(8000);
                continue;
            }
            return Array.isArray(data) ? data : data?.data ?? [];
        }
        throw new Error(`snapshot ${snapshotId} stuck building`);
    }
    buildTrigger(platform, keywords, urls, perInput) {
        const ds = leads_config_1.BRIGHTDATA_DATASETS[platform];
        const common = { dataset_id: ds.id, include_errors: 'true', limit_per_input: String(perInput) };
        if (urls.length && ds.mode === 'discover_keyword') {
            return { params: { ...common }, inputs: urls.map((u) => ({ url: u })) };
        }
        switch (ds.mode) {
            case 'discover_keyword':
                if (!keywords.length)
                    return null;
                return {
                    params: { ...common, type: 'discover_new', discover_by: 'keyword' },
                    inputs: keywords.map((k) => ({ keyword: k, date: leads_config_1.BRIGHTDATA_REDDIT_DATE, sort_by: leads_config_1.BRIGHTDATA_REDDIT_SORT, num_of_posts: perInput })),
                };
            case 'discover_search_url':
                if (!keywords.length)
                    return null;
                return {
                    params: { ...common, type: 'discover_new', discover_by: 'search_url' },
                    inputs: keywords.map((k) => ({ url: `https://www.quora.com/search?q=${encodeURIComponent(k)}&type=question` })),
                };
            case 'discover_url': {
                const igUrls = urls.length ? urls : leads_config_1.BRIGHTDATA_IG_PROFILES;
                if (!igUrls.length)
                    return null;
                return {
                    params: { ...common, type: 'discover_new', discover_by: 'url' },
                    inputs: igUrls.map((u) => ({ url: u })),
                };
            }
            case 'discover_profile_url': {
                const xUrls = urls.length ? urls : leads_config_1.BRIGHTDATA_X_PROFILES;
                if (!xUrls.length)
                    return null;
                return {
                    params: { ...common, type: 'discover_new', discover_by: 'profile_url' },
                    inputs: xUrls.map((u) => ({ url: u })),
                };
            }
            case 'url':
                if (!urls.length)
                    return null;
                return { params: { ...common }, inputs: urls.map((u) => ({ url: u })) };
        }
    }
    async collect(p) {
        if (!this.configured())
            throw new Error('BRIGHT_DATA_API_KEY not configured');
        const serpPlatform = ['QUORA', 'X', 'INSTAGRAM', 'FACEBOOK'].includes(p.platform);
        if (serpPlatform && !(p.urls?.length))
            return this.collectSerp(p);
        const platform = p.platform;
        const ds = leads_config_1.BRIGHTDATA_DATASETS[platform];
        const urls = p.urls ?? [];
        const useUrls = urls.length > 0;
        const isKeywordDiscovery = ds.mode === 'discover_keyword';
        const keywords = (isKeywordDiscovery && !useUrls) ? (p.keywords?.length ? p.keywords : leads_config_1.BRIGHTDATA_KEYWORDS) : (p.keywords ?? []);
        const remaining = await this.remainingCredits();
        if (remaining <= 0)
            throw new Error(`Bright Data credit cap reached (${leads_config_1.BRIGHT_DATA_CREDIT_CAP})`);
        const inputCount = (useUrls ? urls.length
            : isKeywordDiscovery ? keywords.length
                : ds.mode === 'discover_url' ? leads_config_1.BRIGHTDATA_IG_PROFILES.length
                    : ds.mode === 'discover_profile_url' ? leads_config_1.BRIGHTDATA_X_PROFILES.length
                        : 1) || 1;
        let perInput = Math.max(1, p.perInput ?? 5);
        if (perInput * inputCount > remaining)
            perInput = Math.max(1, Math.floor(remaining / inputCount));
        const built = this.buildTrigger(platform, keywords, urls, perInput);
        if (!built)
            throw new Error(`No inputs for ${platform} (${ds.mode} needs ${ds.mode === 'url' ? 'urls' : 'keywords'})`);
        const job = await this.prisma.brightDataJob.create({
            data: {
                platform, datasetId: ds.id, mode: useUrls ? 'url' : ds.mode,
                inputs: built.inputs, status: 'PENDING',
                trigger: p.trigger ?? 'manual', startedAt: new Date(),
            },
        });
        this.run(job.id, platform, ds.id, built.params, built.inputs, keywords[0] ?? urls[0] ?? null)
            .catch((e) => this.logger.error(`BrightData job ${job.id} crashed: ${e.message}`));
        return job;
    }
    async serpSearch(query, num = 20) {
        const res = await fetch('https://api.brightdata.com/request', {
            method: 'POST',
            headers: { Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                zone: leads_config_1.BRIGHT_DATA_SERP_ZONE,
                url: `https://www.google.com/search?q=${encodeURIComponent(query)}&num=${num}`,
                format: 'json', data_format: 'parsed',
            }),
        });
        if (!res.ok)
            throw new Error(`SERP ${res.status}: ${(await res.text()).slice(0, 150)}`);
        const data = await res.json();
        let body = data?.body ?? data;
        if (typeof body === 'string') {
            try {
                body = JSON.parse(body);
            }
            catch {
                body = {};
            }
        }
        return Array.isArray(body?.organic) ? body.organic : [];
    }
    async collectSerp(p) {
        if (!this.configured())
            throw new Error('BRIGHT_DATA_API_KEY not configured');
        if ((await this.remainingCredits()) <= 0)
            throw new Error(`Bright Data credit cap reached`);
        const platform = p.platform;
        const site = leads_config_1.BRIGHTDATA_SERP_SITES[platform];
        if (!site)
            throw new Error(`no SERP site for ${platform}`);
        const terms = p.keywords?.length ? p.keywords : (0, leads_config_1.serpTermsFor)(platform);
        const perInput = Math.max(1, Math.min(20, p.perInput ?? 10));
        const job = await this.prisma.brightDataJob.create({
            data: {
                platform: platform, datasetId: 'serp', mode: 'serp',
                inputs: terms.map((t) => ({ query: `site:${site} ${t}` })),
                status: 'RUNNING', trigger: p.trigger ?? 'manual', startedAt: new Date(),
            },
        });
        this.runSerp(job.id, platform, site, terms, perInput).catch((e) => this.logger.error(`${platform} SERP job ${job.id} crashed: ${e.message}`));
        return job;
    }
    async runSerp(jobId, platform, site, terms, perInput) {
        let records = 0, saved = 0;
        const reDomain = new RegExp(site.replace('.', '\\.'), 'i');
        try {
            for (const term of terms) {
                const organic = await this.serpSearch(`site:${site} ${term}`, perInput).catch(() => []);
                for (const r of organic.slice(0, perInput)) {
                    const url = r.link || r.url;
                    if (!url || !reDomain.test(url))
                        continue;
                    records++;
                    const title = String(r.title || '').slice(0, 300);
                    const body = String(r.description || r.snippet || '').slice(0, 2000);
                    const sig = (0, leads_config_1.scoreSignals)(`${title} ${body}`);
                    const data = {
                        url, title, body, author: null, raw: r,
                        isSpam: (0, leads_config_1.isSpam)(`${title} ${body}`),
                        hasProcedure: sig.hasProcedure, hasCost: sig.hasCost, hasOrigin: sig.hasOrigin,
                        signalCount: sig.signalCount, temperature: sig.temperature,
                        procedures: sig.procedures, origins: sig.origins, intentScore: sig.intentScore,
                        datasetId: 'serp', jobId, keyword: term,
                    };
                    try {
                        await this.prisma.sourceCapture.upsert({
                            where: { platform_externalId: { platform: platform, externalId: url } },
                            create: { platform: platform, externalId: url, ...data },
                            update: data,
                        });
                        saved++;
                    }
                    catch (e) {
                        this.logger.warn(`${platform} SERP save failed for ${url}: ${e.message}`);
                    }
                }
            }
            await this.prisma.brightDataJob.update({ where: { id: jobId }, data: { status: 'DONE', records, saved, creditsApprox: records, finishedAt: new Date() } });
            this.logger.log(`${platform} SERP job ${jobId} done: ${records} results, ${saved} saved`);
        }
        catch (e) {
            await this.prisma.brightDataJob.update({ where: { id: jobId }, data: { status: 'FAILED', error: e.message?.slice(0, 500), finishedAt: new Date() } }).catch(() => undefined);
            this.logger.error(`${platform} SERP job ${jobId} failed: ${e.message}`);
        }
    }
    async run(jobId, platform, datasetId, params, inputs, keyword) {
        try {
            const qs = new URLSearchParams(params).toString();
            const trig = await this.post(`trigger?${qs}`, inputs);
            const snapshotId = trig?.snapshot_id;
            if (!snapshotId)
                throw new Error(`trigger returned no snapshot_id: ${JSON.stringify(trig).slice(0, 200)}`);
            await this.prisma.brightDataJob.update({ where: { id: jobId }, data: { snapshotId, status: 'RUNNING' } });
            this.logger.log(`BrightData ${platform} job ${jobId} → snapshot ${snapshotId}`);
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
                if (status === 'ready' || status === 'failed')
                    break;
            }
            if (status !== 'ready')
                throw new Error(`snapshot ${snapshotId} not ready (status=${status})`);
            await this.prisma.brightDataJob.update({ where: { id: jobId }, data: { status: 'READY' } });
            const records = await this.downloadSnapshot(snapshotId);
            const saved = await this.saveRecords(platform, datasetId, snapshotId, jobId, keyword, records);
            await this.prisma.brightDataJob.update({
                where: { id: jobId },
                data: { status: 'DONE', records: records.length, saved, creditsApprox: records.length, finishedAt: new Date() },
            });
            this.logger.log(`BrightData ${platform} job ${jobId} done: ${records.length} records, ${saved} saved`);
        }
        catch (e) {
            await this.prisma.brightDataJob.update({
                where: { id: jobId },
                data: { status: 'FAILED', error: e.message?.slice(0, 500), finishedAt: new Date() },
            }).catch(() => undefined);
            this.logger.error(`BrightData job ${jobId} failed: ${e.message}`);
        }
    }
    extract(platform, r) {
        const pick = (...keys) => { for (const k of keys)
            if (r?.[k])
                return String(r[k]); return null; };
        const externalId = pick('post_id', 'id', 'url', 'post_url', 'shortcode', 'question_url');
        const body = pick('description', 'answer', 'text', 'content', 'description_markdown', 'caption', 'post_text');
        const title = pick('title', 'question', 'question_title', 'caption') || (body ? body.slice(0, 100) : null);
        return {
            externalId,
            url: pick('url', 'post_url', 'question_url', 'link'),
            title,
            body,
            author: pick('user_posted', 'author', 'user_name', 'username', 'profile_name'),
        };
    }
    async saveRecords(platform, datasetId, snapshotId, jobId, keyword, records) {
        let saved = 0;
        for (const r of records) {
            const ex = this.extract(platform, r);
            const externalId = ex.externalId || `${snapshotId}:${saved}`;
            const sig = (0, leads_config_1.scoreSignals)(`${ex.title ?? ''} ${ex.body ?? ''}`);
            const rawDate = r?.date_posted ?? r?.date ?? r?.post_date ?? r?.created_time ?? r?.timestamp ?? null;
            const pd = rawDate ? new Date(rawDate) : null;
            const postedAt = pd && !isNaN(+pd) ? pd : null;
            const data = {
                url: ex.url, title: ex.title, body: ex.body, author: ex.author, postedAt,
                raw: r,
                isSpam: (0, leads_config_1.isSpam)(`${ex.title ?? ''} ${ex.body ?? ''}`),
                hasProcedure: sig.hasProcedure, hasCost: sig.hasCost, hasOrigin: sig.hasOrigin,
                signalCount: sig.signalCount, temperature: sig.temperature,
                procedures: sig.procedures, origins: sig.origins, intentScore: sig.intentScore,
                datasetId, snapshotId, jobId, keyword: r?.discovery_input?.keyword ?? keyword,
            };
            try {
                await this.prisma.sourceCapture.upsert({
                    where: { platform_externalId: { platform: platform, externalId } },
                    create: { platform: platform, externalId, ...data },
                    update: data,
                });
                saved++;
            }
            catch (e) {
                this.logger.warn(`saveRecords ${platform}:${externalId} failed: ${e.message}`);
            }
        }
        return saved;
    }
    async listCaptures(params) {
        const page = Math.max(1, Number(params.page) || 1);
        const pageSize = Math.min(200, Math.max(1, Number(params.pageSize) || 50));
        const where = {};
        if (!params.includeDeleted)
            where.deletedAt = null;
        if (!params.includeSpam)
            where.isSpam = false;
        if (params.platform)
            where.platform = params.platform;
        if (params.category)
            where.category = params.category === 'UNCATEGORIZED' ? null : params.category;
        if (params.temperature)
            where.temperature = params.temperature === 'hot' ? { startsWith: 'hot' } : params.temperature;
        if (params.needsReview)
            where.needsReview = true;
        if (params.minSignals)
            where.signalCount = { gte: Number(params.minSignals) };
        if (params.q)
            where.OR = [
                { title: { contains: params.q, mode: 'insensitive' } },
                { body: { contains: params.q, mode: 'insensitive' } },
            ];
        let orderBy = { signalCount: 'desc' };
        if (params.sort === 'newest')
            orderBy = { createdAt: 'desc' };
        else if (params.sort === 'score')
            orderBy = { intentScore: 'desc' };
        else if (params.sort === 'posted')
            orderBy = { postedAt: { sort: 'desc', nulls: 'last' } };
        const [total, items] = await Promise.all([
            this.prisma.sourceCapture.count({ where }),
            this.prisma.sourceCapture.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
        ]);
        return { items, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
    }
    async captureStats(platform) {
        const pf = platform ? { platform: platform } : {};
        const live = { deletedAt: null, isSpam: false, ...pf };
        const [total, deleted, spam, byPlatform, byTemp, byCategory, budget] = await Promise.all([
            this.prisma.sourceCapture.count({ where: live }),
            this.prisma.sourceCapture.count({ where: { deletedAt: { not: null }, ...pf } }),
            this.prisma.sourceCapture.count({ where: { isSpam: true, deletedAt: null, ...pf } }),
            this.prisma.sourceCapture.groupBy({ by: ['platform'], where: { deletedAt: null, isSpam: false }, _count: true }),
            this.prisma.sourceCapture.groupBy({ by: ['temperature'], where: live, _count: true }),
            this.prisma.sourceCapture.groupBy({ by: ['category'], where: live, _count: true }),
            this.budget(),
        ]);
        const categoryTotals = { LEAD: 0, PARTNER: 0, MARKETING: 0, NEWS: 0, OTHER: 0, UNCATEGORIZED: 0 };
        for (const g of byCategory)
            categoryTotals[g.category ?? 'UNCATEGORIZED'] = g._count;
        return {
            total, softDeleted: deleted, spam, budget, platform: platform ?? null,
            byPlatform: Object.fromEntries(byPlatform.map((p) => [p.platform, p._count])),
            byTemperature: Object.fromEntries(byTemp.map((t) => [t.temperature ?? 'cold', t._count])),
            byCategory: categoryTotals,
        };
    }
    async rescoreCaptures() {
        const BATCH = 500;
        let cursor;
        let scanned = 0, updated = 0;
        for (;;) {
            const rows = await this.prisma.sourceCapture.findMany({
                select: { id: true, title: true, body: true, temperature: true, intentScore: true, signalCount: true, isSpam: true },
                orderBy: { id: 'asc' },
                take: BATCH,
                ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
            });
            if (!rows.length)
                break;
            cursor = rows[rows.length - 1].id;
            for (const r of rows) {
                scanned++;
                const text = `${r.title ?? ''} ${r.body ?? ''}`;
                const sig = (0, leads_config_1.scoreSignals)(text);
                const spam = (0, leads_config_1.isSpam)(text);
                if (r.temperature === sig.temperature && r.intentScore === sig.intentScore && r.signalCount === sig.signalCount && r.isSpam === spam)
                    continue;
                await this.prisma.sourceCapture.update({
                    where: { id: r.id },
                    data: {
                        hasProcedure: sig.hasProcedure, hasCost: sig.hasCost, hasOrigin: sig.hasOrigin,
                        signalCount: sig.signalCount, temperature: sig.temperature,
                        procedures: sig.procedures, origins: sig.origins,
                        intentScore: sig.intentScore, isSpam: spam,
                    },
                });
                updated++;
            }
        }
        this.logger.log(`Rescore captures: ${updated}/${scanned} rows updated with current signals`);
        return { scanned, updated };
    }
    async analytics(bucket = 'month') {
        const unit = ['day', 'month', 'quarter', 'year'].includes(bucket) ? bucket : 'month';
        const live = { deletedAt: null };
        const [capTotal, capCategorized, capByCategory, capByPlatformCat, leadTotal, leadCategorized, leadByCategory,] = await Promise.all([
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
        const categoryTotals = { LEAD: 0, PARTNER: 0, MARKETING: 0, NEWS: 0, OTHER: 0, UNCATEGORIZED: 0 };
        for (const g of capByCategory)
            categoryTotals[g.category ?? 'UNCATEGORIZED'] += g._count;
        for (const g of leadByCategory)
            categoryTotals[g.category ?? 'UNCATEGORIZED'] += g._count;
        const byPlatform = {};
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
        const [capRows, leadRows] = await Promise.all([
            this.prisma.$queryRaw(client_1.Prisma.sql `
        SELECT to_char(date_trunc(${unit}, "createdAt"), 'YYYY-MM-DD') AS period, "category"::text AS category, COUNT(*)::int AS count
        FROM "source_captures" WHERE "deletedAt" IS NULL GROUP BY 1, 2 ORDER BY 1 ASC`),
            this.prisma.$queryRaw(client_1.Prisma.sql `
        SELECT to_char(date_trunc(${unit}, "createdAt"), 'YYYY-MM-DD') AS period, "category"::text AS category, COUNT(*)::int AS count
        FROM "leads" GROUP BY 1, 2 ORDER BY 1 ASC`),
        ]);
        const periodMap = new Map();
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
            categories: BrightDataService_1.CATEGORIES,
            byCategory: categoryTotals,
            byPlatform,
            bucket: unit,
            series,
            classify: this.categorize,
        };
    }
    async analyticsPosts(params) {
        const page = Math.max(1, Number(params.page) || 1);
        const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 25));
        const skip = (page - 1) * pageSize;
        const q = params.q?.trim();
        const catVal = params.category ? (params.category === 'UNCATEGORIZED' ? null : params.category) : undefined;
        const capSelect = { id: true, platform: true, url: true, title: true, body: true, author: true, postedAt: true, isSpam: true, category: true, categoryReason: true, createdAt: true };
        const leadSelect = { id: true, url: true, title: true, description: true, transcript: true, aiSummary: true, channelTitle: true, publishedAt: true, category: true, categoryReason: true, createdAt: true };
        const capWhere = { deletedAt: null };
        if (catVal !== undefined)
            capWhere.category = catVal;
        if (params.platform && params.platform !== 'YOUTUBE')
            capWhere.platform = params.platform;
        if (q)
            capWhere.OR = [{ title: { contains: q, mode: 'insensitive' } }, { body: { contains: q, mode: 'insensitive' } }];
        const leadWhere = {};
        if (catVal !== undefined)
            leadWhere.category = catVal;
        if (q)
            leadWhere.OR = [{ title: { contains: q, mode: 'insensitive' } }, { transcript: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }];
        const wantCaptures = !params.platform || params.platform !== 'YOUTUBE';
        const wantLeads = !params.platform || params.platform === 'YOUTUBE';
        const result = (items, total) => ({ items, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) });
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
        const [caps, leads] = await Promise.all([
            this.prisma.sourceCapture.findMany({ where: capWhere, select: capSelect, orderBy: { createdAt: 'desc' } }),
            this.prisma.lead.findMany({ where: leadWhere, select: leadSelect, orderBy: { createdAt: 'desc' } }),
        ]);
        const merged = [...caps.map(this.mapCapturePost), ...leads.map(this.mapLeadPost)]
            .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
        return result(merged.slice(skip, skip + pageSize), merged.length);
    }
    categorizeStatus() {
        return this.categorize;
    }
    async startCategorize(opts = {}) {
        if (this.categorize.running)
            return { ok: false, reason: 'already running', progress: this.categorize };
        const limit = opts.limit && opts.limit > 0 ? opts.limit : undefined;
        const capWhere = { deletedAt: null };
        const leadWhere = {};
        if (!opts.reclassify) {
            capWhere.category = null;
            leadWhere.category = null;
        }
        const [caps, leads] = await Promise.all([
            this.prisma.sourceCapture.findMany({ where: capWhere, select: { id: true }, orderBy: { createdAt: 'desc' }, take: limit }),
            this.prisma.lead.findMany({ where: leadWhere, select: { id: true }, orderBy: { createdAt: 'desc' }, take: limit }),
        ]);
        let items = [
            ...leads.map((l) => ({ kind: 'lead', id: l.id })),
            ...caps.map((c) => ({ kind: 'capture', id: c.id })),
        ];
        if (limit)
            items = items.slice(0, limit);
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
        if (!items.length)
            return { ok: true, nothing: true, progress: this.categorize };
        this.runCategorize(items).catch((e) => {
            this.categorize.running = false;
            this.categorize.error = e?.message || String(e);
            this.categorize.finishedAt = new Date().toISOString();
        });
        return { ok: true, started: true, progress: this.categorize };
    }
    async runCategorize(items) {
        const BATCH = 15;
        const { examples } = await this.buildFewShotExamples();
        try {
            for (let i = 0; i < items.length; i += BATCH) {
                if (!this.categorize.running)
                    break;
                const batch = items.slice(i, i + BATCH);
                const capIds = batch.filter((b) => b.kind === 'capture').map((b) => b.id);
                const leadIds = batch.filter((b) => b.kind === 'lead').map((b) => b.id);
                const [caps, leads] = await Promise.all([
                    capIds.length ? this.prisma.sourceCapture.findMany({ where: { id: { in: capIds } }, select: { id: true, platform: true, title: true, body: true } }) : Promise.resolve([]),
                    leadIds.length ? this.prisma.lead.findMany({ where: { id: { in: leadIds } }, select: { id: true, title: true, description: true, transcript: true, aiSummary: true } }) : Promise.resolve([]),
                ]);
                const inputs = [];
                const textById = new Map();
                const verdicts = {};
                for (const r of caps) {
                    const text = ((r.title || '') + (r.body || '')).trim();
                    if (!text)
                        verdicts[`capture:${r.id}`] = { category: 'OTHER', reason: 'no text content', confidence: 100, votes: { OTHER: 1 }, needsReview: false };
                    else {
                        inputs.push({ id: `capture:${r.id}`, platform: r.platform, title: r.title, body: r.body });
                        textById.set(`capture:${r.id}`, `${r.title ?? ''} ${r.body ?? ''}`);
                    }
                }
                for (const r of leads) {
                    const body = r.transcript || r.aiSummary || r.description || '';
                    const text = ((r.title || '') + body).trim();
                    if (!text)
                        verdicts[`lead:${r.id}`] = { category: 'OTHER', reason: 'no text content', confidence: 100, votes: { OTHER: 1 }, needsReview: false };
                    else {
                        inputs.push({ id: `lead:${r.id}`, platform: 'YOUTUBE', title: r.title, body });
                        textById.set(`lead:${r.id}`, `${r.title ?? ''} ${body}`);
                    }
                }
                if (inputs.length) {
                    const pass1 = await this.ai.classifyCategories(inputs, examples, 0.3);
                    const hard = inputs.filter((x) => {
                        const v = pass1[x.id];
                        if (!v)
                            return false;
                        const partnerClash = (0, leads_config_1.hasPartnerSignal)(textById.get(x.id) || '') && v.category !== 'PARTNER';
                        return v.category === 'LEAD' || v.category === 'PARTNER' || v.confidence < 75 || partnerClash;
                    });
                    const [pass2, pass3] = hard.length
                        ? await Promise.all([this.ai.classifyCategories(hard, examples, 0.6), this.ai.classifyCategories(hard, examples, 0.85)])
                        : [{}, {}];
                    for (const x of inputs) {
                        const v1 = pass1[x.id];
                        if (!v1) {
                            verdicts[x.id] = { category: 'OTHER', reason: 'unclassified by model', confidence: 40, votes: {}, needsReview: true };
                            continue;
                        }
                        const isHard = hard.includes(x);
                        const passes = [v1, ...(isHard ? [pass2[x.id], pass3[x.id]].filter(Boolean) : [])];
                        const votes = {};
                        for (const p of passes)
                            votes[p.category] = (votes[p.category] || 0) + 1;
                        let winner = v1.category, top = 0;
                        for (const [c, n] of Object.entries(votes))
                            if (n > top) {
                                top = n;
                                winner = c;
                            }
                        const agree = votes[winner] / passes.length;
                        const winningPass = passes.find((p) => p.category === winner) || v1;
                        const confidence = Math.round(0.7 * agree * 100 + 0.3 * winningPass.confidence);
                        const partnerClash = (0, leads_config_1.hasPartnerSignal)(textById.get(x.id) || '') && winner !== 'PARTNER';
                        const needsReview = (isHard && agree < 0.6) || partnerClash || confidence < 55;
                        verdicts[x.id] = { category: winner, reason: winningPass.reason, confidence, votes, needsReview };
                    }
                }
                const now = new Date();
                for (const b of batch) {
                    const v = verdicts[`${b.kind}:${b.id}`];
                    if (!v)
                        continue;
                    const data = { category: v.category, categoryReason: v.reason, categoryConfidence: v.confidence, categoryVotes: v.votes, needsReview: v.needsReview, categorizedAt: now };
                    if (b.kind === 'capture')
                        await this.prisma.sourceCapture.update({ where: { id: b.id }, data: { ...data, aiCategory: v.category } });
                    else
                        await this.prisma.lead.update({ where: { id: b.id }, data });
                    this.categorize.updated++;
                    this.categorize.byCategory[v.category] = (this.categorize.byCategory[v.category] || 0) + 1;
                }
                this.categorize.processed = Math.min(items.length, i + BATCH);
            }
        }
        finally {
            this.categorize.running = false;
            this.categorize.finishedAt = new Date().toISOString();
        }
    }
    async buildFewShotExamples() {
        const PER = { LEAD: 6, PARTNER: 3, MARKETING: 3, NEWS: 3, OTHER: 3 };
        const examples = [];
        const ids = [];
        for (const category of ['LEAD', 'PARTNER', 'MARKETING', 'NEWS', 'OTHER']) {
            const rows = await this.prisma.sourceCapture.findMany({
                where: { category: category, deletedAt: null, isSpam: false, body: { not: null } },
                select: { id: true, title: true, body: true, categoryReason: true },
                orderBy: [{ reviewedAt: { sort: 'desc', nulls: 'last' } }, { intentScore: 'desc' }, { signalCount: 'desc' }],
                take: PER[category] ?? 3,
            });
            for (const r of rows) {
                const text = `${r.title ? r.title + ' — ' : ''}${(r.body || '').replace(/\s+/g, ' ').slice(0, 200)}`.trim();
                if (!text)
                    continue;
                examples.push({ text, category, reason: r.categoryReason || '' });
                ids.push(r.id);
            }
        }
        return { examples, ids };
    }
    async resetAndReclassify() {
        if (this.categorize.running)
            return { ok: false, reason: 'classification already running' };
        const { ids } = await this.buildFewShotExamples();
        const keep = ids.length ? ids : ['__none__'];
        const [caps, leads] = await Promise.all([
            this.prisma.sourceCapture.updateMany({
                where: { category: { not: null }, id: { notIn: keep } },
                data: { category: null, categoryReason: null, categorizedAt: null },
            }),
            this.prisma.lead.updateMany({
                where: { category: { not: null } },
                data: { category: null, categoryReason: null, categorizedAt: null },
            }),
        ]);
        this.logger.log(`Reset+reclassify: kept ${ids.length} exemplars, cleared ${caps.count} captures + ${leads.count} leads`);
        const res = await this.startCategorize({});
        return { ...res, exemplars: ids.length, cleared: caps.count + leads.count };
    }
    async setCategoryByHuman(id, category, reviewedBy) {
        const row = await this.prisma.sourceCapture.findUnique({ where: { id }, select: { category: true, aiCategory: true } });
        const aiCategory = (row?.aiCategory ?? row?.category ?? null);
        await this.prisma.sourceCapture.update({
            where: { id },
            data: {
                category, aiCategory, categoryReason: 'human review', categoryConfidence: 100,
                categoryVotes: { human: 1 }, needsReview: false,
                reviewedBy: reviewedBy ?? 'admin', reviewedAt: new Date(), categorizedAt: new Date(),
            },
        });
        return { ok: true, id, category };
    }
    async classificationScorecard() {
        const CATS = ['LEAD', 'PARTNER', 'MARKETING', 'NEWS', 'OTHER'];
        const rows = await this.prisma.sourceCapture.findMany({
            where: { reviewedBy: { not: null }, aiCategory: { not: null }, category: { not: null } },
            select: { category: true, aiCategory: true },
        });
        const matrix = {};
        for (const a of CATS) {
            matrix[a] = {};
            for (const p of CATS)
                matrix[a][p] = 0;
        }
        let correct = 0;
        for (const r of rows) {
            const a = String(r.category), p = String(r.aiCategory);
            if (matrix[a]?.[p] != null) {
                matrix[a][p]++;
                if (a === p)
                    correct++;
            }
        }
        const total = rows.length;
        const metrics = CATS.map((c) => {
            const tp = matrix[c][c];
            const predicted = CATS.reduce((s, a) => s + matrix[a][c], 0);
            const support = CATS.reduce((s, p) => s + matrix[c][p], 0);
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
    async softDelete(id) {
        await this.prisma.sourceCapture.update({ where: { id }, data: { deletedAt: new Date() } });
        return { ok: true, softDeleted: true };
    }
    async restore(id) {
        await this.prisma.sourceCapture.update({ where: { id }, data: { deletedAt: null } });
        return { ok: true, restored: true };
    }
    getCapture(id) {
        return this.prisma.sourceCapture.findUnique({ where: { id } });
    }
    async fetchComments(id) {
        if (!this.configured())
            throw new Error('BRIGHT_DATA_API_KEY not configured');
        const cap = await this.prisma.sourceCapture.findUnique({ where: { id } });
        if (!cap)
            throw new Error('capture not found');
        if (cap.platform !== 'REDDIT')
            throw new Error('comments fetch is only supported for Reddit');
        if (!cap.url)
            throw new Error('capture has no URL to fetch comments from');
        if (cap.commentsStatus === 'fetching')
            return { status: 'fetching' };
        await this.prisma.sourceCapture.update({ where: { id }, data: { commentsStatus: 'fetching' } });
        this.runComments(id, cap.url).catch((e) => this.logger.error(`fetchComments ${id} crashed: ${e.message}`));
        return { status: 'fetching' };
    }
    async runComments(captureId, url) {
        const ds = leads_config_1.BRIGHTDATA_REDDIT_COMMENTS_DATASET;
        const job = await this.prisma.brightDataJob.create({
            data: { platform: 'REDDIT', datasetId: ds, mode: 'comments', inputs: [{ url }], status: 'PENDING', trigger: 'manual', startedAt: new Date() },
        });
        try {
            const qs = new URLSearchParams({ dataset_id: ds, include_errors: 'true', limit_per_input: String(leads_config_1.BRIGHTDATA_COMMENTS_LIMIT) }).toString();
            const trig = await this.post(`trigger?${qs}`, [{ url }]);
            const snapshotId = trig?.snapshot_id;
            if (!snapshotId)
                throw new Error(`no snapshot_id: ${JSON.stringify(trig).slice(0, 150)}`);
            await this.prisma.brightDataJob.update({ where: { id: job.id }, data: { snapshotId, status: 'RUNNING' } });
            let status = 'running';
            for (let i = 0; i < 80; i++) {
                await this.sleep(8000);
                const prog = await this.get(`progress/${snapshotId}`);
                status = prog?.status;
                if (status === 'ready' || status === 'failed')
                    break;
            }
            if (status !== 'ready')
                throw new Error(`comments snapshot not ready (status=${status})`);
            const records = await this.downloadSnapshot(snapshotId);
            const comments = records.filter((r) => r && typeof r === 'object' && !r.error);
            await this.prisma.sourceCapture.update({
                where: { id: captureId },
                data: { comments: comments, commentsStatus: 'done', commentsFetchedAt: new Date() },
            });
            await this.prisma.brightDataJob.update({
                where: { id: job.id },
                data: { status: 'DONE', records: records.length, saved: comments.length, creditsApprox: records.length, finishedAt: new Date() },
            });
            this.logger.log(`fetchComments ${captureId}: ${comments.length} comments saved`);
        }
        catch (e) {
            await this.prisma.sourceCapture.update({ where: { id: captureId }, data: { commentsStatus: 'failed' } }).catch(() => undefined);
            await this.prisma.brightDataJob.update({ where: { id: job.id }, data: { status: 'FAILED', error: e.message?.slice(0, 500), finishedAt: new Date() } }).catch(() => undefined);
            this.logger.error(`fetchComments ${captureId} failed: ${e.message}`);
        }
    }
    sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
};
exports.BrightDataService = BrightDataService;
BrightDataService.CATEGORIES = ['LEAD', 'PARTNER', 'MARKETING', 'NEWS', 'OTHER'];
exports.BrightDataService = BrightDataService = BrightDataService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ai_service_1.AiService])
], BrightDataService);
//# sourceMappingURL=brightdata.service.js.map