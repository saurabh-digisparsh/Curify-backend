import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { OnboardingStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PartnerService } from './partner.service';
import { ReviewDocDto } from './dto/partner.dto';

// Admin exception review — inspect applications, verify/reject stuck documents,
// override status (FR-12). The happy path is fully automated; this is the escape.
@ApiTags('Admin · Hospital Onboarding')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/partner')
export class PartnerAdminController {
  constructor(private readonly svc: PartnerService) {}

  @ApiOperation({ summary: 'List applications (optionally by status)' })
  @ApiQuery({ name: 'status', enum: OnboardingStatus, required: false })
  @Get()
  list(@Query('status') status?: OnboardingStatus) { return this.svc.listApplications(status); }

  @ApiOperation({ summary: 'Get one application (full)' })
  @Get(':id')
  get(@Param('id') id: string) { return this.svc.getForAdmin(id); }

  @ApiOperation({ summary: 'Verify or reject a document' })
  @Patch('documents/:docId')
  reviewDoc(@Param('docId') docId: string, @Body() dto: ReviewDocDto, @Request() req) { return this.svc.reviewDoc(docId, dto, req.user.id); }

  @ApiOperation({ summary: 'Override application status (approve/reject stuck cases)' })
  @Post(':id/status')
  setStatus(@Param('id') id: string, @Body() body: { status: OnboardingStatus }) { return this.svc.setApplicationStatus(id, body.status); }

  @ApiOperation({ summary: 'Set the admin-controlled "Priority partner" ranking flag' })
  @Post(':id/priority')
  setPriority(@Param('id') id: string, @Body() body: { priority: boolean }) { return this.svc.setPriority(id, !!body.priority); }
}
