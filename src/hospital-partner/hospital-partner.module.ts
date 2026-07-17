import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module'; // JwtStrategy (guards) + MailService
import { AdminModule } from '../admin/admin.module'; // SettingsService (effective config)
import { PartnerService } from './partner.service';
import { BulkImportService } from './bulk-import.service';
import { NotificationService } from './notification.service';
import { AccreditationService } from './accreditation.service';
import { VideoService } from './video.service';
import { TeleconsultService } from './teleconsult.service';
import { ApplicationController } from './application.controller';
import { DashboardController } from './dashboard.controller';
import { AvailabilityController } from './availability.controller';
import { TeleconsultController } from './teleconsult.controller';
import { PartnerAdminController } from './admin.controller';

@Module({
  // JwtModule.register({}): VideoService signs Jitsi JWTs with a per-call secret
  // (JITSI_APP_SECRET), so no module-level secret is configured here.
  imports: [PrismaModule, AuthModule, AdminModule, JwtModule.register({})],
  // DashboardController MUST be registered before ApplicationController: the static
  // route GET /partner/dashboard would otherwise be shadowed by GET /partner/:id.
  controllers: [DashboardController, ApplicationController, AvailabilityController, TeleconsultController, PartnerAdminController],
  providers: [PartnerService, BulkImportService, NotificationService, AccreditationService, VideoService, TeleconsultService],
})
export class HospitalPartnerModule {}
