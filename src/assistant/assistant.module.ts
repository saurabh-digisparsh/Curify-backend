import { Module } from '@nestjs/common';
import { AssistantController } from './assistant.controller';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  controllers: [AssistantController],
})
export class AssistantModule {}
