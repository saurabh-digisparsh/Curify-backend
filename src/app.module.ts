import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { IpBlockGuard } from './admin/guards/ip-block.guard';
import { SentinelThrottlerGuard } from './admin/guards/sentinel-throttler.guard';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AiModule } from './ai/ai.module';
import { UploadModule } from './upload/upload.module';
import { HospitalsModule } from './hospitals/hospitals.module';
import { StayOrGoModule } from './stay-or-go/stay-or-go.module';
import { TripPlanModule } from './trip-plan/trip-plan.module';
import { RecoveryModule } from './recovery/recovery.module';
import { FamilyDashboardModule } from './family-dashboard/family-dashboard.module';
import { BookingsModule } from './bookings/bookings.module';
import { AdminModule } from './admin/admin.module';
import { LeadsModule } from './leads/leads.module';
import { AssistantModule } from './assistant/assistant.module';
import { JourneysModule } from './journeys/journeys.module';
import { TreatmentsModule } from './treatments/treatments.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(), // enables @Cron (daily lead run)
    // Global anti-scrape rate limiting (per client IP). Caps how fast any single
    // source can pull data; data-heavy endpoints tighten this further via @Throttle.
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 120 }, // 120 requests / minute / IP
    ]),
    PrismaModule,
    AuthModule,
    UsersModule,
    AdminModule,
    AiModule,
    UploadModule,
    HospitalsModule,
    StayOrGoModule,
    TripPlanModule,
    RecoveryModule,
    FamilyDashboardModule,
    BookingsModule,
    LeadsModule,
    AssistantModule,
    JourneysModule,
    TreatmentsModule,
  ],
  providers: [
    // Guard order matters: reject admin-blocked IPs FIRST (so they don't even
    // consume rate-limit budget), then apply the Sentinel-aware throttler which
    // records every 429 into the watch list.
    { provide: APP_GUARD, useClass: IpBlockGuard },
    { provide: APP_GUARD, useClass: SentinelThrottlerGuard },
  ],
})
export class AppModule {}
