import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ScrapeService } from './scrape.service';

/**
 * Daily hospital-data scrape — ONE hospital per day in a round-robin (advances to
 * the next hospital each day, wraps back to the first after the last). Fired at
 * 02:00 Asia/Kolkata; if the machine was OFF at 02:00, the run is caught up on the
 * next startup. Disable with SCRAPE_CRON_DISABLED=1.
 */
@Injectable()
export class ScrapeScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger('ScrapeScheduler');

  constructor(private prisma: PrismaService, private scrape: ScrapeService) {}

  @Cron('0 2 * * *', { name: 'daily-scrape-next', timeZone: 'Asia/Kolkata' })
  async dailyRun() {
    if (process.env.SCRAPE_CRON_DISABLED === '1') return;
    this.logger.log('Daily 02:00 IST scrape — next hospital in rotation');
    await this.scrape.scrapeNextHospital('system-cron').catch((e) => this.logger.error(`daily scrape: ${e.message}`));
  }

  /** Catch-up: if 02:00 IST passed while the system was off, run the missed scrape on boot. */
  async onApplicationBootstrap() {
    // Any scrape job still 'RUNNING' at boot was orphaned by the restart — mark it failed.
    await this.prisma.scrapeJob.updateMany({
      where: { status: 'RUNNING' },
      data: { status: 'FAILED', error: 'interrupted by server restart', finishedAt: new Date() },
    }).catch(() => undefined);

    if (process.env.SCRAPE_CRON_DISABLED === '1') return;
    try {
      const due = this.todays2amIST();
      if (new Date() < due) return; // 02:00 IST hasn't passed yet today — wait for the cron
      const last = await this.prisma.scrapeJob.findFirst({
        where: { target: 'hospital-rotation', triggeredBy: { startsWith: 'system-cron' } },
        orderBy: { createdAt: 'desc' },
      });
      if (last && last.createdAt >= due) return; // already ran since today's 02:00 IST
      this.logger.log('Missed 02:00 IST scrape detected — catching up shortly');
      setTimeout(
        () => this.scrape.scrapeNextHospital('system-cron-catchup').catch((e) => this.logger.error(`catch-up scrape: ${e.message}`)),
        20000,
      );
    } catch (e: any) {
      this.logger.error(`scrape catch-up check failed: ${e.message}`);
    }
  }

  /** Today's 02:00 Asia/Kolkata expressed as a UTC Date. */
  private todays2amIST(): Date {
    const now = new Date();
    const ist = new Date(now.getTime() + 5.5 * 3600 * 1000);
    const istMidnightUtcMs = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), 0, 0, 0);
    return new Date(istMidnightUtcMs + 2 * 3600 * 1000 - 5.5 * 3600 * 1000);
  }
}
