import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { YouTubeService } from './youtube.service';
import { BrightDataService } from './brightdata.service';
import { LeadsScheduler } from './leads.scheduler';

@Module({
  imports: [AuthModule, AiModule], // AuthModule: JWT guard; AiModule: AiService.classifyLeads
  controllers: [LeadsController],
  providers: [LeadsService, YouTubeService, BrightDataService, LeadsScheduler],
})
export class LeadsModule {}
