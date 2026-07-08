import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { JourneysService } from './journeys.service';

/**
 * Staff inbox: Curify coordinators answer patients on the hospital's behalf.
 * Admin-only — this is the "hospital" side of the live chat.
 */
@ApiTags('Admin · Hospital Chats')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/hospital-chats')
export class AdminHospitalChatController {
  constructor(private service: JourneysService) {}

  @ApiOperation({ summary: 'List every journey chat (newest first)' })
  @Get()
  list() {
    return this.service.listChats();
  }

  @ApiOperation({ summary: 'Read one chat transcript' })
  @Get(':journeyId')
  one(@Param('journeyId') journeyId: string) {
    return this.service.getChatForStaff(journeyId);
  }

  @ApiOperation({ summary: 'Reply as the hospital (optionally post a quote)' })
  @Post(':journeyId/reply')
  reply(@Param('journeyId') journeyId: string, @Body() body: { body?: string; kind?: any; amountUsd?: number }) {
    return this.service.addHospitalMessage(journeyId, body || {});
  }
}
