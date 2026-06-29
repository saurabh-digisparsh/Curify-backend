import { Module } from '@nestjs/common';
import { FamilyDashboardController } from './family-dashboard.controller';
import { FamilyDashboardService } from './family-dashboard.service';
import { AiModule } from '../ai/ai.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [AiModule, PrismaModule],
  controllers: [FamilyDashboardController],
  providers: [FamilyDashboardService],
})
export class FamilyDashboardModule {}
