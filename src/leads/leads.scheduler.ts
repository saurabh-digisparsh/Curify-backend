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
    const startedAt = new Date();
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

    // Once every source job spawned by this run has finished, run lead analytics.
    await this.waitForLeadJobs(startedAt);
    await this.runAnalytics(`${trigger}-after-fetch`);
  }

  /**
   * Lead-analytics job: AI-classify any not-yet-categorised social captures and
   * YouTube leads into Lead/Marketing/News/Other. Runs after the fetch jobs finish
   * (and on its own daily backstop cron). Idempotent — only touches new rows.
   * Disable with LEAD_ANALYTICS_CRON_DISABLED=1.
   */
  async runAnalytics(trigger: string) {
    if (process.env.LEAD_ANALYTICS_CRON_DISABLED === '1') return;
    this.logger.log(`Lead analytics (${trigger}) — classifying new posts & leads`);
    const res: any = await this.brightData.startCategorize({});
    if (res?.nothing) { this.logger.log('Lead analytics — nothing new to classify'); return; }
    if (res?.ok === false) { this.logger.warn(`Lead analytics skipped — ${res.reason}`); return; }
    // Wait for the background classification to finish so we can log the outcome.
    const deadline = Date.now() + 30 * 60 * 1000;
    while (this.brightData.categorizeStatus().running && Date.now() < deadline) await this.sleep(5000);
    const s = this.brightData.categorizeStatus();
    this.logger.log(`Lead analytics done — classified ${s.updated}/${s.total} ${JSON.stringify(s.byCategory)}${s.error ? ` · error: ${s.error}` : ''}`);
  }

  /** Daily backstop: classify anything left uncategorised at 04:00 IST (after the 02:00 fetch). */
  @Cron('0 4 * * *', { name: 'daily-lead-analytics', timeZone: 'Asia/Kolkata' })
  async dailyAnalytics() {
    if (process.env.LEADS_CRON_DISABLED === '1') return;
    await this.runAnalytics('scheduled-analytics');
  }

  /** Poll the lead-job tables until every job created during this run reaches a terminal state. */
  private async waitForLeadJobs(since: Date, maxWaitMs = 45 * 60 * 1000) {
    const deadline = Date.now() + maxWaitMs;
    await this.sleep(8000); // give the just-fired jobs a moment to be created
    while (Date.now() < deadline) {
      const [yt, bd] = await Promise.all([
        this.prisma.leadJob.count({ where: { createdAt: { gte: since }, status: { in: ['PENDING', 'RUNNING'] } } }),
        this.prisma.brightDataJob.count({ where: { createdAt: { gte: since }, status: { in: ['PENDING', 'RUNNING', 'READY'] } } }),
      ]);
      if (yt + bd === 0) return;
      await this.sleep(15000);
    }
    this.logger.warn('Lead jobs still running after max wait — proceeding to analytics anyway');
  }

  private sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
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
