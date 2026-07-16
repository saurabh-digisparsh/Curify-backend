import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';
import { AdminUsersController } from './users.controller';
import { UsersService } from './users.service';
import { AdminStatsController } from './stats.controller';
import { StatsService } from './stats.service';
import { AdminDataController } from './data.controller';
import { DataService } from './data.service';
import { AdminScrapeController } from './scrape.controller';
import { ScrapeService } from './scrape.service';
import { ScrapeScheduler } from './scrape.scheduler';
import { EnrichmentService } from './enrichment.service';
import { ReviewLangService } from './review-lang.service';
import { FileImportService } from './file-import.service';
import { SentinelController } from './sentinel.controller';
import { SentinelService } from './sentinel.service';
import { AdminSettingsController } from './settings/settings.controller';
import { SettingsService } from './settings/settings.service';

@Module({
  imports: [AuthModule, AiModule], // AuthModule: JWT strategy; AiModule: AiService for enrichment/localization
  controllers: [
    AdminUsersController,
    AdminStatsController,
    AdminDataController,
    AdminScrapeController,
    SentinelController,
    AdminSettingsController,
  ],
  providers: [UsersService, StatsService, DataService, ScrapeService, ScrapeScheduler, EnrichmentService, ReviewLangService, FileImportService, SentinelService, SettingsService],
  // Exported so the app-level Sentinel guards (registered in AppModule) can inject it,
  // and SettingsService so other modules can read effective config values.
  exports: [SentinelService, SettingsService, EnrichmentService, ScrapeService],
})
export class AdminModule {}
