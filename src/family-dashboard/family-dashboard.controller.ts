import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FamilyDashboardService } from './family-dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Family Dashboard')
@Controller('family-updates')
export class FamilyDashboardController {
  constructor(private service: FamilyDashboardService) {}

  // Live surgical status is PHI. Locked to the booking owner (or admin).
  // NOTE (Phase 3 follow-up): support family-member access via a signed
  // FamilyLink.accessCode so relatives without an account can view without
  // exposing the booking to anyone who guesses its id.
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get DB-driven family status for a booking (owner or admin only)' })
  @Get('booking/:bookingId')
  getFamilyStatus(@Param('bookingId') bookingId: string, @Request() req) {
    return this.service.getFamilyStatus(bookingId, req.user.id, req.user.role === 'ADMIN');
  }

  @ApiOperation({ summary: 'Legacy: get surgical status updates (demo state)' })
  @Post()
  getUpdates(
    @Body() body: { procedure: string; hospital: string; surgeon: string; stage: string },
  ) {
    return this.service.getUpdates({
      procedure: body.procedure || 'Surgery',
      hospital: body.hospital || 'Hospital',
      surgeon: body.surgeon || 'Doctor',
      stage: body.stage || 'in-surgery',
    });
  }
}
