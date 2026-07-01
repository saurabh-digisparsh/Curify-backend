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
exports.SentinelService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let SentinelService = class SentinelService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger('Sentinel');
        this.blocked = new Set();
    }
    async onModuleInit() {
        try {
            const rows = await this.prisma.securityEvent.findMany({
                where: { blocked: true },
                select: { ip: true },
            });
            rows.forEach((r) => this.blocked.add(r.ip));
            this.logger.log(`Loaded ${this.blocked.size} blocked IP(s)`);
        }
        catch (e) {
            this.logger.error('Failed to load blocked IPs', e);
        }
    }
    isBlocked(ip) {
        return this.blocked.has(ip);
    }
    async record(type, meta) {
        const { ip, path, method, userAgent } = meta;
        if (!ip)
            return;
        const inc = type === 'RATE_LIMIT'
            ? { rateLimitHits: { increment: 1 }, totalHits: { increment: 1 } }
            : { blockedHits: { increment: 1 }, totalHits: { increment: 1 } };
        try {
            await this.prisma.securityEvent.upsert({
                where: { ip },
                create: {
                    ip,
                    lastPath: path,
                    lastMethod: method,
                    lastUserAgent: userAgent,
                    rateLimitHits: type === 'RATE_LIMIT' ? 1 : 0,
                    blockedHits: type === 'BLOCKED' ? 1 : 0,
                    totalHits: 1,
                },
                update: { ...inc, lastPath: path, lastMethod: method, lastUserAgent: userAgent },
            });
        }
        catch (e) {
            this.logger.error(`Failed to record ${type} for ${ip}`, e);
        }
    }
    async block(ip, reason, by) {
        ip = ip.trim();
        if (!ip)
            throw new Error('IP is required');
        const row = await this.prisma.securityEvent.upsert({
            where: { ip },
            create: { ip, blocked: true, blockReason: reason, blockedBy: by, blockedAt: new Date(), totalHits: 0 },
            update: { blocked: true, blockReason: reason, blockedBy: by, blockedAt: new Date() },
        });
        this.blocked.add(ip);
        this.logger.warn(`Blocked ${ip}${reason ? ` (${reason})` : ''}`);
        return row;
    }
    async unblock(ip) {
        ip = ip.trim();
        this.blocked.delete(ip);
        const row = await this.prisma.securityEvent.update({
            where: { ip },
            data: { blocked: false, blockReason: null, blockedBy: null, blockedAt: null },
        });
        this.logger.warn(`Unblocked ${ip}`);
        return row;
    }
    async overview() {
        const events = await this.prisma.securityEvent.findMany({
            orderBy: [{ blocked: 'desc' }, { lastSeen: 'desc' }],
            take: 500,
        });
        const blockedCount = events.filter((e) => e.blocked).length;
        const rateLimitTotal = events.reduce((s, e) => s + e.rateLimitHits, 0);
        return {
            stats: {
                watched: events.length,
                blocked: blockedCount,
                rateLimitHits: rateLimitTotal,
            },
            events,
        };
    }
};
exports.SentinelService = SentinelService;
exports.SentinelService = SentinelService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SentinelService);
//# sourceMappingURL=sentinel.service.js.map