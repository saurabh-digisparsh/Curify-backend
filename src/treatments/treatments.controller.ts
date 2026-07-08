import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { TreatmentsService } from './treatments.service';
import { ClassifyTreatmentDto } from './dto/classify-treatment.dto';

@ApiTags('Treatments')
@Controller('treatments')
export class TreatmentsController {
  constructor(private svc: TreatmentsService) {}

  @ApiOperation({ summary: 'List the active treatment catalog (intake picker)' })
  @Get()
  list() {
    return this.svc.list();
  }

  // Public + triggers an AI call — throttle per-IP like the assistant chat (10/min).
  @ApiOperation({ summary: 'Classify a free-typed "Other" treatment (AI); auto-adds a new catalog entry when none fits' })
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('classify')
  classify(@Body() dto: ClassifyTreatmentDto) {
    return this.svc.classify(dto.text);
  }
}
