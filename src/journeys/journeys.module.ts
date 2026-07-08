import { Module } from '@nestjs/common';
import { JourneysController } from './journeys.controller';
import { PublicTrackingController } from './public-tracking.controller';
import { JourneysService } from './journeys.service';
import { AdminHospitalChatController } from './admin-hospital-chat.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [JourneysController, PublicTrackingController, AdminHospitalChatController],
  providers: [JourneysService],
})
export class JourneysModule {}
