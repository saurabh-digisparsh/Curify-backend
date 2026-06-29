import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { DataService } from './data.service';

@ApiTags('Admin · Data')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/data')
export class AdminDataController {
  constructor(private readonly data: DataService) {}

  @ApiOperation({ summary: 'List editable resource types (Data Manager tabs)' })
  @Get()
  resources() {
    return this.data.resources();
  }

  @ApiOperation({ summary: 'List rows of a resource (search + pagination)' })
  @Get(':resource')
  list(
    @Param('resource') resource: string,
    @Query('q') q?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.data.list(resource, {
      q,
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
    });
  }

  @ApiOperation({ summary: 'Get one row' })
  @Get(':resource/:id')
  getOne(@Param('resource') resource: string, @Param('id') id: string) {
    return this.data.getOne(resource, id);
  }

  @ApiOperation({ summary: 'Create a row' })
  @Post(':resource')
  create(@Param('resource') resource: string, @Body() body: Record<string, any>) {
    return this.data.create(resource, body);
  }

  @ApiOperation({ summary: 'Update a row' })
  @Patch(':resource/:id')
  update(
    @Param('resource') resource: string,
    @Param('id') id: string,
    @Body() body: Record<string, any>,
  ) {
    return this.data.update(resource, id, body);
  }

  @ApiOperation({ summary: 'Delete a row' })
  @Delete(':resource/:id')
  remove(@Param('resource') resource: string, @Param('id') id: string) {
    return this.data.remove(resource, id);
  }
}
