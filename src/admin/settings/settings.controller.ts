import { Body, Controller, Delete, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { SettingsService } from './settings.service';
import { UpdateSettingDto } from './dto/update-setting.dto';

@ApiTags('Admin · Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/settings')
export class AdminSettingsController {
  constructor(private readonly settings: SettingsService) {}

  @ApiOperation({ summary: 'List all settings grouped by category (secrets masked)' })
  @Get()
  list() {
    return this.settings.list();
  }

  @ApiOperation({ summary: 'Update a single setting' })
  @Patch(':key')
  update(@Param('key') key: string, @Body() dto: UpdateSettingDto, @Req() req: Request) {
    const by = (req.user as any)?.email || (req.user as any)?.id;
    return this.settings.update(key, dto.value, by);
  }

  @ApiOperation({ summary: 'Reset a setting to its environment/default value' })
  @Delete(':key')
  reset(@Param('key') key: string) {
    return this.settings.reset(key);
  }
}
