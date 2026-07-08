import { Module } from '@nestjs/common';
import { TreatmentsController } from './treatments.controller';
import { TreatmentsService } from './treatments.service';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule], // AiService for the classify endpoint (Prisma is global)
  controllers: [TreatmentsController],
  providers: [TreatmentsService],
})
export class TreatmentsModule {}
