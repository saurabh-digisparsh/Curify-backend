import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { LeadsService } from './leads.service';
import { YouTubeService } from './youtube.service';
import { BrightDataService } from './brightdata.service';
import { BRIGHT_DATA_CREDIT_CAP } from './leads.config';

/**
 * Daily automated lead run across ALL sources (YouTube + Bright Data social),
 * fired at 02:00 Asia/Kolkata. If the machine was OFF at 02:00, the run is caught
 * up on the next startup. Disable with LEADS_CRON_DISABLED=1.
 */
@Injectable()
export class LeadsScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger('LeadsScheduler');

  constructor(
    private prisma: PrismaService,
    private leads: LeadsService,
    private yt: YouTubeService,
    private brightData: BrightDataService,
  ) {}

  @Cron('0 2 * * *', { name: 'daily-all-leads', timeZone: 'Asia/Kolkata' })
  async dailyRun() {
    if (process.env.LEADS_CRON_DISABLED === '1') return;
    await this.runAll('scheduled');
  }

  /** Catch-up: if 02:00 IST passed while the system was off, run the missed job on boot. */
  async onApplicationBootstrap() {
    if (process.env.LEADS_CRON_DISABLED === '1') return;
    try {
      const due = this.todays2amIST();
      if (new Date() < due) return; // 02:00 IST hasn't passed yet today — wait for the cron
      const last = await this.prisma.leadJob.findFirst({
        where: { trigger: { startsWith: 'scheduled' } },
        orderBy: { createdAt: 'desc' },
      });
      if (last && last.createdAt >= due) return; // already ran since today's 02:00 IST
      this.logger.log('Missed 02:00 IST daily run detected — catching up shortly');
      setTimeout(() => this.runAll('scheduled-catchup').catch((e) => this.logger.error(`catch-up run: ${e.message}`)), 15000);
    } catch (e: any) {
      this.logger.error(`catch-up check failed: ${e.message}`);
    }
  }

  /** Trigger a fetch across every configured lead source. Each becomes a tracked job. */
  async runAll(trigger: string) {
    this.logger.log(`Daily lead run (${trigger}) — starting all sources`);
    // YouTube (own quota)
    if (this.yt.configured()) {
      const { remaining } = await this.yt.quotaStatus();
      if (remaining >= 100) {
        await this.leads.generate({ trigger: trigger as any, maxSearches: 12, targetCount: 15 })
          .catch((e) => this.logger.error(`YouTube run: ${e.message}`));
      } else this.logger.warn(`YouTube skipped — only ${remaining} quota units left`);
    }
    // Bright Data social — only while credits remain (Quora collector is broken upstream → skipped)
    if (this.brightData.configured()) {
      const remaining = await this.brightData.remainingCredits();
      if (remaining > 0) {
        // Reddit = native keyword discovery; Quora/Instagram/Facebook/X = SERP keyword/hashtag discovery.
        await this.brightData.collect({ platform: 'REDDIT', perInput: 5, trigger: trigger as any }).catch((e) => this.logger.error(`Reddit run: ${e.message}`));
        await this.brightData.collect({ platform: 'QUORA', perInput: 5, trigger: trigger as any }).catch((e) => this.logger.error(`Quora run: ${e.message}`));
        await this.brightData.collect({ platform: 'INSTAGRAM', perInput: 5, trigger: trigger as any }).catch((e) => this.logger.error(`Instagram run: ${e.message}`));
        await this.brightData.collect({ platform: 'FACEBOOK', perInput: 5, trigger: trigger as any }).catch((e) => this.logger.error(`Facebook run: ${e.message}`));
        await this.brightData.collect({ platform: 'X', perInput: 5, trigger: trigger as any }).catch((e) => this.logger.error(`X run: ${e.message}`));
      } else this.logger.warn(`Bright Data skipped — ${BRIGHT_DATA_CREDIT_CAP}-credit cap reached`);
    }
  }

  /** Today's 02:00 Asia/Kolkata expressed as a UTC Date. */
  private todays2amIST(): Date {
    const now = new Date();
    const ist = new Date(now.getTime() + 5.5 * 3600 * 1000);
    const istMidnightUtcMs = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), 0, 0, 0);
    return new Date(istMidnightUtcMs + 2 * 3600 * 1000 - 5.5 * 3600 * 1000);
  }

  /** Explicit YouTube quota reset at midnight America/Los_Angeles (real quota rollover). */
  @Cron('0 0 * * *', { name: 'reset-youtube-quota', timeZone: 'America/Los_Angeles' })
  async resetQuota() {
    const { day, previousUnits } = await this.yt.resetDailyQuota();
    this.logger.log(`YouTube quota counter reset for ${day} (was ${previousUnits} units)`);
  }
}
