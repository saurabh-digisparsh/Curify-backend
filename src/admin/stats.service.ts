import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatsService {
  constructor(private prisma: PrismaService) {}

  /** Aggregate counts for the admin dashboard (analytics + logistics). */
  async overview() {
    const [
      usersByRole,
      bookingsByStatus,
      hospitalCount,
      surgeonCount,
      reviewCount,
      reportCount,
      revenueAgg,
      recentBookings,
      recentUsers,
      recentScrapes,
    ] = await Promise.all([
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

    const toMap = <T extends { _count: { _all: number } }>(rows: T[], key: keyof T) =>
      rows.reduce((acc, r) => ({ ...acc, [String(r[key])]: r._count._all }), {} as Record<string, number>);

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

  /**
   * Records inserted per time bucket for hospitals/surgeons/reviews, at the requested
   * granularity (daily | monthly | quarterly | yearly). Computed server-side.
   */
  async insertsSeries(granularity = 'monthly') {
    const CONF: Record<string, { unit: string; count: number }> = {
      daily: { unit: 'day', count: 14 },
      monthly: { unit: 'month', count: 6 },
      quarterly: { unit: 'quarter', count: 6 },
      yearly: { unit: 'year', count: 5 },
    };
    const g = CONF[granularity] ? granularity : 'monthly';
    const { unit, count } = CONF[g];

    const buckets = async (table: string): Promise<Record<string, number>> => {
      const rows = await this.prisma.$queryRawUnsafe<{ bucket: string; count: number }[]>(
        `SELECT to_char(date_trunc('${unit}', "createdAt"), 'YYYY-MM-DD') AS bucket, COUNT(*)::int AS count
         FROM "${table}" GROUP BY 1`,
      );
      return rows.reduce((acc, r) => ({ ...acc, [r.bucket]: Number(r.count) }), {} as Record<string, number>);
    };
    const [h, s, r] = await Promise.all([buckets('hospitals'), buckets('surgeons'), buckets('reviews')]);

    const pad = (n: number) => String(n).padStart(2, '0');
    const now = new Date();
    const startOf = (i: number): Date => {
      if (g === 'daily') return new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      if (g === 'yearly') return new Date(now.getFullYear() - i, 0, 1);
      if (g === 'quarterly') return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 - i * 3, 1);
      return new Date(now.getFullYear(), now.getMonth() - i, 1); // monthly
    };
    const labelOf = (d: Date): string => {
      if (g === 'daily') return d.toLocaleString('en-US', { month: 'short', day: 'numeric' });
      if (g === 'yearly') return String(d.getFullYear());
      if (g === 'quarterly') return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
      return d.toLocaleString('en-US', { month: 'short' });
    };

    const series: { bucket: string; label: string; hospitals: number; surgeons: number; reviews: number }[] = [];
    for (let i = count - 1; i >= 0; i--) {
      const d = startOf(i);
      const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      series.push({ bucket: key, label: labelOf(d), hospitals: h[key] ?? 0, surgeons: s[key] ?? 0, reviews: r[key] ?? 0 });
    }
    return { granularity: g, series };
  }
}
