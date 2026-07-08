import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JourneysService } from './journeys.service';

/**
 * Patient journeys — every route requires auth and is scoped to the caller
 * (ownership enforced in the service).
 */
@ApiTags('Journeys')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('journeys')
export class JourneysController {
  constructor(private service: JourneysService) {}

  @ApiOperation({ summary: 'List my journeys (most recent first). With ?page, returns a paginated envelope.' })
  @Get()
  list(@Request() req, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.service.list(
      req.user.id,
      page ? { page: parseInt(page, 10), pageSize: pageSize ? parseInt(pageSize, 10) : 10 } : undefined,
    );
  }

  @ApiOperation({ summary: 'Get one of my journeys' })
  @Get(':id')
  get(@Request() req, @Param('id') id: string) {
    return this.service.get(req.user.id, id);
  }

  @ApiOperation({ summary: 'Create a new journey' })
  @Post()
  create(@Request() req, @Body() body: any) {
    return this.service.create(req.user.id, body || {});
  }

  @ApiOperation({ summary: 'Update my journey (answers, step, AI snapshots, status)' })
  @Patch(':id')
  update(@Request() req, @Param('id') id: string, @Body() body: any) {
    return this.service.update(req.user.id, id, body || {});
  }

  @ApiOperation({ summary: 'Delete one of my journeys' })
  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    return this.service.remove(req.user.id, id);
  }

  // ── Hospital chat (patient side) ──
  @ApiOperation({ summary: 'Read my chat with the selected hospital' })
  @Get(':id/chat')
  getChat(@Request() req, @Param('id') id: string) {
    return this.service.getChat(req.user.id, id);
  }

  @ApiOperation({ summary: 'Send a chat message / share a report / request a quote' })
  @Post(':id/chat')
  postChat(@Request() req, @Param('id') id: string, @Body() body: { body?: string; kind?: any; reportId?: string }) {
    return this.service.addPatientMessage(req.user.id, id, body || {});
  }

  @ApiOperation({ summary: 'AI-analyze the whole chat and refresh the trip plan' })
  @Post(':id/chat/analyze')
  analyzeChat(@Request() req, @Param('id') id: string) {
    return this.service.analyzeChat(req.user.id, id);
  }
}
