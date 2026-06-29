import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { FamilyDashboardService } from './family-dashboard.service';

@ApiTags('Family Dashboard')
@Controller('family-updates')
export class FamilyDashboardController {
  constructor(private service: FamilyDashboardService) {}

  @ApiOperation({ summary: 'Get DB-driven family status for a booking' })
  @Get('booking/:bookingId')
  getFamilyStatus(@Param('bookingId') bookingId: string) {
    return this.service.getFamilyStatus(bookingId);
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
