import { Module } from '@nestjs/common';
import { JourneysController } from './journeys.controller';
import { PublicTrackingController } from './public-tracking.controller';
import { JourneysService } from './journeys.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [JourneysController, PublicTrackingController],
  providers: [JourneysService],
})
export class JourneysModule {}
