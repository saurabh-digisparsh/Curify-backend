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
exports.LeadsScheduler = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prisma_service_1 = require("../prisma/prisma.service");
const leads_service_1 = require("./leads.service");
const youtube_service_1 = require("./youtube.service");
const brightdata_service_1 = require("./brightdata.service");
const leads_config_1 = require("./leads.config");
let LeadsScheduler = class LeadsScheduler {
    constructor(prisma, leads, yt, brightData) {
        this.prisma = prisma;
        this.leads = leads;
        this.yt = yt;
        this.brightData = brightData;
        this.logger = new common_1.Logger('LeadsScheduler');
    }
    async dailyRun() {
        if (process.env.LEADS_CRON_DISABLED === '1')
            return;
        await this.runAll('scheduled');
    }
    async onApplicationBootstrap() {
        if (process.env.LEADS_CRON_DISABLED === '1')
            return;
        try {
            const due = this.todays2amIST();
            if (new Date() < due)
                return;
            const [ytSince, bdWithData] = await Promise.all([
                this.prisma.leadJob.findFirst({ where: { trigger: { startsWith: 'scheduled' }, createdAt: { gte: due } }, orderBy: { createdAt: 'desc' } }),
                this.prisma.brightDataJob.count({ where: { trigger: { startsWith: 'scheduled' }, createdAt: { gte: due }, saved: { gt: 0 } } }),
            ]);
            const ranOk = !!ytSince && ytSince.status !== 'FAILED' && (bdWithData > 0 || ytSince.created > 0);
            if (ranOk)
                return;
            this.logger.log(ytSince ? 'Last 02:00 IST run failed or returned no data — retrying shortly' : 'Missed 02:00 IST daily run detected — catching up shortly');
            setTimeout(() => this.runAll('scheduled-catchup').catch((e) => this.logger.error(`catch-up run: ${e.message}`)), 15000);
        }
        catch (e) {
            this.logger.error(`catch-up check failed: ${e.message}`);
        }
    }
    async runAll(trigger) {
        if (!(await this.waitForNetwork())) {
            this.logger.warn(`Aborting ${trigger} run — no outbound network after wait; will retry on next cron/restart`);
            return;
        }
        this.logger.log(`Daily lead run (${trigger}) — starting all sources`);
        const startedAt = new Date();
        if (this.yt.configured()) {
            const { remaining } = await this.yt.quotaStatus();
            if (remaining >= 100) {
                await this.leads.generate({ trigger: trigger, maxSearches: 12, targetCount: 15 })
                    .catch((e) => this.logger.error(`YouTube run: ${e.message}`));
            }
            else
                this.logger.warn(`YouTube skipped — only ${remaining} quota units left`);
        }
        if (this.brightData.configured()) {
            const remaining = await this.brightData.remainingCredits();
            if (remaining > 0) {
                await this.brightData.collect({ platform: 'REDDIT', perInput: 5, trigger: trigger }).catch((e) => this.logger.error(`Reddit run: ${e.message}`));
                await this.brightData.collect({ platform: 'QUORA', perInput: 5, trigger: trigger }).catch((e) => this.logger.error(`Quora run: ${e.message}`));
                await this.brightData.collect({ platform: 'INSTAGRAM', perInput: 5, trigger: trigger }).catch((e) => this.logger.error(`Instagram run: ${e.message}`));
                await this.brightData.collect({ platform: 'FACEBOOK', perInput: 5, trigger: trigger }).catch((e) => this.logger.error(`Facebook run: ${e.message}`));
                await this.brightData.collect({ platform: 'X', perInput: 5, trigger: trigger }).catch((e) => this.logger.error(`X run: ${e.message}`));
            }
            else
                this.logger.warn(`Bright Data skipped — ${leads_config_1.BRIGHT_DATA_CREDIT_CAP}-credit cap reached`);
        }
        await this.waitForLeadJobs(startedAt);
        await this.runAnalytics(`${trigger}-after-fetch`);
    }
    async runAnalytics(trigger) {
        if (process.env.LEAD_ANALYTICS_CRON_DISABLED === '1')
            return;
        this.logger.log(`Lead analytics (${trigger}) — classifying new posts & leads`);
        const res = await this.brightData.startCategorize({});
        if (res?.nothing) {
            this.logger.log('Lead analytics — nothing new to classify');
            return;
        }
        if (res?.ok === false) {
            this.logger.warn(`Lead analytics skipped — ${res.reason}`);
            return;
        }
        const deadline = Date.now() + 30 * 60 * 1000;
        while (this.brightData.categorizeStatus().running && Date.now() < deadline)
            await this.sleep(5000);
        const s = this.brightData.categorizeStatus();
        this.logger.log(`Lead analytics done — classified ${s.updated}/${s.total} ${JSON.stringify(s.byCategory)}${s.error ? ` · error: ${s.error}` : ''}`);
    }
    async dailyAnalytics() {
        if (process.env.LEADS_CRON_DISABLED === '1')
            return;
        await this.runAnalytics('scheduled-analytics');
    }
    async waitForLeadJobs(since, maxWaitMs = 45 * 60 * 1000) {
        const deadline = Date.now() + maxWaitMs;
        await this.sleep(8000);
        while (Date.now() < deadline) {
            const [yt, bd] = await Promise.all([
                this.prisma.leadJob.count({ where: { createdAt: { gte: since }, status: { in: ['PENDING', 'RUNNING'] } } }),
                this.prisma.brightDataJob.count({ where: { createdAt: { gte: since }, status: { in: ['PENDING', 'RUNNING', 'READY'] } } }),
            ]);
            if (yt + bd === 0)
                return;
            await this.sleep(15000);
        }
        this.logger.warn('Lead jobs still running after max wait — proceeding to analytics anyway');
    }
    sleep(ms) {
        return new Promise((r) => setTimeout(r, ms));
    }
    async waitForNetwork(maxWaitMs = 5 * 60 * 1000) {
        const deadline = Date.now() + maxWaitMs;
        let delay = 3000;
        for (;;) {
            try {
                await fetch('https://www.google.com/generate_204', { method: 'HEAD' });
                return true;
            }
            catch {
                if (Date.now() + delay > deadline)
                    return false;
                await this.sleep(delay);
                delay = Math.min(30000, delay * 2);
            }
        }
    }
    todays2amIST() {
        const now = new Date();
        const ist = new Date(now.getTime() + 5.5 * 3600 * 1000);
        const istMidnightUtcMs = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), 0, 0, 0);
        return new Date(istMidnightUtcMs + 2 * 3600 * 1000 - 5.5 * 3600 * 1000);
    }
    async resetQuota() {
        const { day, previousUnits } = await this.yt.resetDailyQuota();
        this.logger.log(`YouTube quota counter reset for ${day} (was ${previousUnits} units)`);
    }
};
exports.LeadsScheduler = LeadsScheduler;
__decorate([
    (0, schedule_1.Cron)('0 2 * * *', { name: 'daily-all-leads', timeZone: 'Asia/Kolkata' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], LeadsScheduler.prototype, "dailyRun", null);
__decorate([
    (0, schedule_1.Cron)('0 4 * * *', { name: 'daily-lead-analytics', timeZone: 'Asia/Kolkata' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], LeadsScheduler.prototype, "dailyAnalytics", null);
__decorate([
    (0, schedule_1.Cron)('0 0 * * *', { name: 'reset-youtube-quota', timeZone: 'America/Los_Angeles' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], LeadsScheduler.prototype, "resetQuota", null);
exports.LeadsScheduler = LeadsScheduler = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        leads_service_1.LeadsService,
        youtube_service_1.YouTubeService,
        brightdata_service_1.BrightDataService])
], LeadsScheduler);
//# sourceMappingURL=leads.scheduler.js.map