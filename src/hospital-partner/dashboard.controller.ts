import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request, Res,
  StreamableFile, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { createReadStream } from 'fs';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PartnerService } from './partner.service';
import { TeleconsultService } from './teleconsult.service';
import { BulkImportService, ImportKind, CSV_MAX_BYTES, csvFileFilter } from './bulk-import.service';
import { DoctorDto, DoctorLeaveDto, PricingDto, ServicesDto, SetPasswordDto } from './dto/partner.dto';

// Hospital dashboard — authenticated owner. Setup checklist gates Go-live (FR-20).
@ApiTags('Partner · Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('HOSPITAL')
@Controller('partner/dashboard')
export class DashboardController {
  constructor(
    private readonly svc: PartnerService,
    private readonly tele: TeleconsultService,
    private readonly bulk: BulkImportService,
  ) {}

  @ApiOperation({ summary: 'Dashboard payload + setup checklist' })
  @Get()
  dashboard(@Request() req) { return this.svc.dashboard(req.user.id); }

  @ApiOperation({ summary: 'Set your own password (first sign-in)' })
  @Post('set-password')
  setPassword(@Body() dto: SetPasswordDto, @Request() req) { return this.svc.setPassword(req.user.id, dto.password); }

  @ApiOperation({ summary: 'Add a doctor' })
  @Post('doctors')
  addDoctor(@Body() dto: DoctorDto, @Request() req) { return this.svc.addDoctor(req.user.id, dto); }

  @ApiOperation({ summary: 'Update a doctor' })
  @Put('doctors/:id')
  updateDoctor(@Param('id') id: string, @Body() dto: DoctorDto, @Request() req) { return this.svc.updateDoctor(req.user.id, id, dto); }

  @ApiOperation({ summary: 'Set a doctor on leave / active' })
  @Post('doctors/:id/leave')
  leave(@Param('id') id: string, @Body() dto: DoctorLeaveDto, @Request() req) { return this.svc.setDoctorLeave(req.user.id, id, dto.onLeave); }

  @ApiOperation({ summary: 'Remove a doctor' })
  @Delete('doctors/:id')
  removeDoctor(@Param('id') id: string, @Request() req) { return this.svc.removeDoctor(req.user.id, id); }

  @ApiOperation({ summary: "Send/resend a doctor's private availability link" })
  @Post('doctors/:id/availability-link')
  link(@Param('id') id: string, @Request() req) { return this.svc.sendAvailabilityLink(req.user.id, id); }

  @ApiOperation({ summary: 'Set pricing & capacity' })
  @Put('pricing')
  pricing(@Body() dto: PricingDto, @Request() req) { return this.svc.setPricing(req.user.id, dto); }

  @ApiOperation({ summary: 'Download the CSV template for a bulk import' })
  @Get('import/:kind/template')
  template(@Param('kind') kind: ImportKind, @Res({ passthrough: true }) res: Response) {
    const csv = this.bulk.template(kind);
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="curify-${kind}-template.csv"`,
    });
    return csv;
  }

  @ApiOperation({ summary: 'Bulk-import doctors from a CSV' })
  @ApiConsumes('multipart/form-data')
  @Post('import/doctors')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: CSV_MAX_BYTES }, fileFilter: csvFileFilter }))
  importDoctors(@UploadedFile() file: Express.Multer.File, @Request() req) {
    return this.svc.importDoctors(req.user.id, file);
  }

  @ApiOperation({ summary: 'Bulk-import treatment packages + prices from a CSV' })
  @ApiConsumes('multipart/form-data')
  @Post('import/packages')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: CSV_MAX_BYTES }, fileFilter: csvFileFilter }))
  importPackages(@UploadedFile() file: Express.Multer.File, @Request() req) {
    return this.svc.importPackages(req.user.id, file);
  }

  @ApiOperation({ summary: 'Set patient services (languages, insurers, facilities)' })
  @Put('services')
  services(@Body() dto: ServicesDto, @Request() req) { return this.svc.setServices(req.user.id, dto); }

  @ApiOperation({ summary: 'AI-generate the package narrative (pros/cons + included) for editing' })
  @Post('narrative/generate')
  generateNarrative(@Request() req) { return this.svc.generateNarrative(req.user.id); }

  @ApiOperation({ summary: "This hospital's patient reviews (filterable)" })
  @Get('reviews')
  reviews(@Request() req, @Query('rating') rating?: string, @Query('region') region?: string, @Query('verified') verified?: string) {
    return this.svc.dashboardReviews(req.user.id, {
      rating: rating ? Number(rating) : undefined,
      region: region || undefined,
      verified: verified === 'true' ? true : verified === 'false' ? false : undefined,
    });
  }

  @ApiOperation({ summary: 'Go live — publish into patient matching' })
  @Post('go-live')
  goLive(@Request() req) { return this.svc.goLive(req.user.id); }

  @ApiOperation({ summary: 'Teleconsultation monitoring — all consults + stats' })
  @Get('teleconsults')
  teleconsults(@Request() req) { return this.tele.hospitalConsults(req.user.id); }

  @ApiOperation({ summary: 'Stream a shared teleconsult document (owner)' })
  @Get('teleconsults/documents/:docId/file')
  async teleDocFile(@Param('docId') docId: string, @Request() req, @Res({ passthrough: true }) res: Response) {
    const { path, name } = await this.tele.docFileForHospital(docId, req.user.id);
    res.set({ 'Content-Disposition': `inline; filename="${encodeURIComponent(name)}"` });
    return new StreamableFile(createReadStream(path));
  }

  @ApiOperation({ summary: 'Stream a verification document (owner or admin)' })
  @Roles('HOSPITAL', 'ADMIN')
  @Get('documents/:docId/file')
  async docFile(@Param('docId') docId: string, @Request() req, @Res({ passthrough: true }) res: Response) {
    const { path, name } = await this.svc.docFile(docId, req.user.id, req.user.role === 'ADMIN');
    res.set({ 'Content-Disposition': `inline; filename="${encodeURIComponent(name)}"` });
    return new StreamableFile(createReadStream(path));
  }
}
