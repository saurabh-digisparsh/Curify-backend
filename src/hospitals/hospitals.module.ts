import { Module } from '@nestjs/common';
import { HospitalsController } from './hospitals.controller';
import { HospitalsService } from './hospitals.service';
import { AiModule } from '../ai/ai.module';
import { AdminModule } from '../admin/admin.module'; // SettingsService — resolves the Jitsi config

@Module({
  imports: [AiModule, AdminModule],
  controllers: [HospitalsController],
  providers: [HospitalsService],
  exports: [HospitalsService],
})
export class HospitalsModule {}
