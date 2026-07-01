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
exports.StatsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let StatsService = class StatsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async overview() {
        const [usersByRole, bookingsByStatus, hospitalCount, surgeonCount, reviewCount, reportCount, revenueAgg, recentBookings, recentUsers, recentScrapes,] = await Promise.all([
            this.prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
            this.prisma.booking.groupBy({ by: ['status'], _count: { _all: true } }),
            this.prisma.hospital.count(),
            this.prisma.surgeon.count(),
            this.prisma.review.count(),
            this.prisma.report.count(),
            this.prisma.booking.aggregate({
                _sum: { totalAmount: true },
                where: { status: { in: ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] } },
            }),
            this.prisma.booking.findMany({
                take: 8,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true, status: true, totalAmount: true, currency: true, createdAt: true,
                    user: { select: { name: true, email: true } },
                    hospital: { select: { name: true } },
                },
            }),
            this.prisma.user.findMany({
                take: 8,
                orderBy: { createdAt: 'desc' },
                select: { id: true, name: true, email: true, role: true, createdAt: true },
            }),
            this.prisma.scrapeJob.findMany({
                take: 5,
                orderBy: { createdAt: 'desc' },
                select: { id: true, target: true, status: true, created: true, updated: true, createdAt: true },
            }),
        ]);
        const toMap = (rows, key) => rows.reduce((acc, r) => ({ ...acc, [String(r[key])]: r._count._all }), {});
        return {
            users: {
                total: usersByRole.reduce((n, r) => n + r._count._all, 0),
                byRole: toMap(usersByRole, 'role'),
            },
            bookings: {
                total: bookingsByStatus.reduce((n, r) => n + r._count._all, 0),
                byStatus: toMap(bookingsByStatus, 'status'),
            },
            catalog: { hospitals: hospitalCount, surgeons: surgeonCount, reviews: reviewCount, reports: reportCount },
            revenueUsd: revenueAgg._sum.totalAmount ?? 0,
            recent: { bookings: recentBookings, users: recentUsers, scrapes: recentScrapes },
        };
    }
    async insertsSeries(granularity = 'monthly') {
        const CONF = {
            daily: { unit: 'day', count: 14 },
            monthly: { unit: 'month', count: 6 },
            quarterly: { unit: 'quarter', count: 6 },
            yearly: { unit: 'year', count: 5 },
        };
        const g = CONF[granularity] ? granularity : 'monthly';
        const { unit, count } = CONF[g];
        const buckets = async (table) => {
            const rows = await this.prisma.$queryRawUnsafe(`SELECT to_char(date_trunc('${unit}', "createdAt"), 'YYYY-MM-DD') AS bucket, COUNT(*)::int AS count
         FROM "${table}" GROUP BY 1`);
            return rows.reduce((acc, r) => ({ ...acc, [r.bucket]: Number(r.count) }), {});
        };
        const [h, s, r] = await Promise.all([buckets('hospitals'), buckets('surgeons'), buckets('reviews')]);
        const pad = (n) => String(n).padStart(2, '0');
        const now = new Date();
        const startOf = (i) => {
            if (g === 'daily')
                return new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
            if (g === 'yearly')
                return new Date(now.getFullYear() - i, 0, 1);
            if (g === 'quarterly')
                return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 - i * 3, 1);
            return new Date(now.getFullYear(), now.getMonth() - i, 1);
        };
        const labelOf = (d) => {
            if (g === 'daily')
                return d.toLocaleString('en-US', { month: 'short', day: 'numeric' });
            if (g === 'yearly')
                return String(d.getFullYear());
            if (g === 'quarterly')
                return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
            return d.toLocaleString('en-US', { month: 'short' });
        };
        const series = [];
        for (let i = count - 1; i >= 0; i--) {
            const d = startOf(i);
            const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
            series.push({ bucket: key, label: labelOf(d), hospitals: h[key] ?? 0, surgeons: s[key] ?? 0, reviews: r[key] ?? 0 });
        }
        return { granularity: g, series };
    }
};
exports.StatsService = StatsService;
exports.StatsService = StatsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], StatsService);
//# sourceMappingURL=stats.service.js.map