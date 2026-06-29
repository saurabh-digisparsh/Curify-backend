import { Module } from '@nestjs/common';
import { StayOrGoController } from './stay-or-go.controller';
import { StayOrGoService } from './stay-or-go.service';
import { AiModule } from '../ai/ai.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [AiModule, PrismaModule],
  controllers: [StayOrGoController],
  providers: [StayOrGoService],
})
export class StayOrGoModule {}
