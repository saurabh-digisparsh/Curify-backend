import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JourneysService } from './journeys.service';

/**
 * PUBLIC, unauthenticated tracking for shared journey links (WhatsApp/social).
 * Deliberately NOT behind JwtAuthGuard — friends/family open it without an
 * account. The service returns only a curated, non-PHI itinerary + status.
 */
@ApiTags('Public')
@Controller('track')
export class PublicTrackingController {
  constructor(private service: JourneysService) {}

  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Public treatment-journey tracking by shared id (no auth)' })
  @Get(':id')
  track(@Param('id') id: string) {
    return this.service.publicTracking(id);
  }
}
