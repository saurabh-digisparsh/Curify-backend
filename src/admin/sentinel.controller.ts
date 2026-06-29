import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SentinelService } from './sentinel.service';

@ApiTags('Admin · Sentinel')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/sentinel')
export class SentinelController {
  constructor(private readonly sentinel: SentinelService) {}

  @ApiOperation({ summary: 'Suspicious-activity watch list + summary' })
  @Get()
  overview() {
    return this.sentinel.overview();
  }

  @ApiOperation({ summary: 'Block an IP address' })
  @Post('block')
  block(@Body() body: { ip: string; reason?: string }, @Req() req: Request) {
    const by = (req.user as any)?.email || (req.user as any)?.id;
    return this.sentinel.block(body.ip, body.reason, by);
  }

  @ApiOperation({ summary: 'Unblock an IP address' })
  @Post('unblock')
  unblock(@Body() body: { ip: string }) {
    return this.sentinel.unblock(body.ip);
  }
}
