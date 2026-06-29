import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type SentinelHit = 'RATE_LIMIT' | 'BLOCKED';

/**
 * Central store for the anti-scrape "Sentinel" feature.
 *
 * - Keeps an in-memory Set of blocked IPs so the request guards can reject in O(1)
 *   without a DB round-trip per request. The set is hydrated from the DB on boot
 *   and kept in sync on every block/unblock.
 * - Aggregates suspicious activity into one SecurityEvent row per IP (counters +
 *   last-seen metadata) which powers the admin Sentinel screen.
 */
@Injectable()
export class SentinelService implements OnModuleInit {
  private readonly logger = new Logger('Sentinel');
  private readonly blocked = new Set<string>();

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    try {
      const rows = await this.prisma.securityEvent.findMany({
        where: { blocked: true },
        select: { ip: true },
      });
      rows.forEach((r) => this.blocked.add(r.ip));
      this.logger.log(`Loaded ${this.blocked.size} blocked IP(s)`);
    } catch (e) {
      this.logger.error('Failed to load blocked IPs', e as any);
    }
  }

  /** Fast, synchronous check used by the request guard. */
  isBlocked(ip: string): boolean {
    return this.blocked.has(ip);
  }

  /** Record a suspicious hit (rate-limit trip or a request from a blocked IP). */
  async record(type: SentinelHit, meta: { ip: string; path?: string; method?: string; userAgent?: string }) {
    const { ip, path, method, userAgent } = meta;
    if (!ip) return;
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
    } catch (e) {
      this.logger.error(`Failed to record ${type} for ${ip}`, e as any);
    }
  }

  /** Block an IP (manual from the admin UI, or programmatically). */
  async block(ip: string, reason?: string, by?: string) {
    ip = ip.trim();
    if (!ip) throw new Error('IP is required');
    const row = await this.prisma.securityEvent.upsert({
      where: { ip },
      create: { ip, blocked: true, blockReason: reason, blockedBy: by, blockedAt: new Date(), totalHits: 0 },
      update: { blocked: true, blockReason: reason, blockedBy: by, blockedAt: new Date() },
    });
    this.blocked.add(ip);
    this.logger.warn(`Blocked ${ip}${reason ? ` (${reason})` : ''}`);
    return row;
  }

  /** Unblock an IP — keeps the row (and its history) but lifts the block. */
  async unblock(ip: string) {
    ip = ip.trim();
    this.blocked.delete(ip);
    const row = await this.prisma.securityEvent.update({
      where: { ip },
      data: { blocked: false, blockReason: null, blockedBy: null, blockedAt: null },
    });
    this.logger.warn(`Unblocked ${ip}`);
    return row;
  }

  /** Watch list + summary for the admin Sentinel screen. */
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
}
