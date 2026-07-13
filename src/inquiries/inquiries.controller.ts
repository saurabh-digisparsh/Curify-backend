import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { InquiriesService } from './inquiries.service';
import { UpsertInquiryDto } from './dto/upsert-inquiry.dto';

@ApiTags('Inquiries')
@Controller('inquiries')
export class InquiriesController {
  constructor(private svc: InquiriesService) {}

  // Public write — bound abuse tighter than the global default (20/min/IP).
  @ApiOperation({ summary: 'Capture/update an anonymous chat lead (pre-signup; identity + funnel only)' })
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post()
  upsert(@Body() dto: UpsertInquiryDto) {
    return this.svc.upsert(dto);
  }
}
