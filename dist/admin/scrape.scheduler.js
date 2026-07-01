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
exports.ScrapeScheduler = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prisma_service_1 = require("../prisma/prisma.service");
const scrape_service_1 = require("./scrape.service");
let ScrapeScheduler = class ScrapeScheduler {
    constructor(prisma, scrape) {
        this.prisma = prisma;
        this.scrape = scrape;
        this.logger = new common_1.Logger('ScrapeScheduler');
    }
    async dailyRun() {
        if (process.env.SCRAPE_CRON_DISABLED === '1')
            return;
        this.logger.log('Daily 02:00 IST scrape — next hospital in rotation');
        await this.scrape.scrapeNextHospital('system-cron').catch((e) => this.logger.error(`daily scrape: ${e.message}`));
    }
    async onApplicationBootstrap() {
        await this.prisma.scrapeJob.updateMany({
            where: { status: 'RUNNING' },
            data: { status: 'FAILED', error: 'interrupted by server restart', finishedAt: new Date() },
        }).catch(() => undefined);
        if (process.env.SCRAPE_CRON_DISABLED === '1')
            return;
        try {
            const due = this.todays2amIST();
            if (new Date() < due)
                return;
            const last = await this.prisma.scrapeJob.findFirst({
                where: { target: 'hospital-rotation', triggeredBy: { startsWith: 'system-cron' } },
                orderBy: { createdAt: 'desc' },
            });
            if (last && last.createdAt >= due)
                return;
            this.logger.log('Missed 02:00 IST scrape detected — catching up shortly');
            setTimeout(() => this.scrape.scrapeNextHospital('system-cron-catchup').catch((e) => this.logger.error(`catch-up scrape: ${e.message}`)), 20000);
        }
        catch (e) {
            this.logger.error(`scrape catch-up check failed: ${e.message}`);
        }
    }
    todays2amIST() {
        const now = new Date();
        const ist = new Date(now.getTime() + 5.5 * 3600 * 1000);
        const istMidnightUtcMs = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), 0, 0, 0);
        return new Date(istMidnightUtcMs + 2 * 3600 * 1000 - 5.5 * 3600 * 1000);
    }
};
exports.ScrapeScheduler = ScrapeScheduler;
__decorate([
    (0, schedule_1.Cron)('0 2 * * *', { name: 'daily-scrape-next', timeZone: 'Asia/Kolkata' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ScrapeScheduler.prototype, "dailyRun", null);
exports.ScrapeScheduler = ScrapeScheduler = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, scrape_service_1.ScrapeService])
], ScrapeScheduler);
//# sourceMappingURL=scrape.scheduler.js.map