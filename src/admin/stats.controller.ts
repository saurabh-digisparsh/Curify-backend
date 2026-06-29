import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { StatsService } from './stats.service';

@ApiTags('Admin · Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/stats')
export class AdminStatsController {
  constructor(private readonly stats: StatsService) {}

  @ApiOperation({ summary: 'Dashboard analytics + logistics overview' })
  @Get()
  overview() {
    return this.stats.overview();
  }

  @ApiOperation({ summary: 'Records inserted per time bucket (daily|monthly|quarterly|yearly)' })
  @Get('inserts')
  inserts(@Query('granularity') granularity?: string) {
    return this.stats.insertsSeries(granularity || 'monthly');
  }
}
