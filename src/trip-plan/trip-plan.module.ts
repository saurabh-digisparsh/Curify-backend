import { Module } from '@nestjs/common';
import { TripPlanController } from './trip-plan.controller';
import { TripPlanService } from './trip-plan.service';
import { AiModule } from '../ai/ai.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [AiModule, PrismaModule],
  controllers: [TripPlanController],
  providers: [TripPlanService],
})
export class TripPlanModule {}
