import {
  Controller, Post, Get, Param, Body, UploadedFile, UploadedFiles,
  UseInterceptors, UseGuards, Request, Res, StreamableFile,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { createReadStream } from 'fs';
import type { Response } from 'express';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

const ALLOWED_MIMES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

// PHI: medical reports must never be uploaded or read anonymously. Every route
// here requires authentication, and reads are ownership-checked in the service.
@ApiTags('Upload & Analysis')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('upload')
export class UploadController {
  constructor(private uploadService: UploadService) {}

  @ApiOperation({ summary: 'Upload a medical report and get AI analysis' })
  @ApiConsumes('multipart/form-data')
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      // 10 MB is ample for medical PDFs/images and limits memory-exhaustion risk.
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_, file, cb) => {
        if (ALLOWED_MIMES.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Unsupported format. Use PDF, JPEG, PNG, or DOCX.'), false);
      },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { description?: string; treatment?: string; country?: string; urgency?: string },
    @Request() req,
  ) {
    // The report is always attributed to the authenticated patient.
    return this.uploadService.analyzeAndStore({
      userId: req.user.id,
      file,
      ...body,
    });
  }

  @ApiOperation({ summary: 'Upload MULTIPLE medical documents and get one combined AI analysis' })
  @ApiConsumes('multipart/form-data')
  @Post('multi')
  @UseInterceptors(
    FilesInterceptor('files', 8, {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB each, up to 8 documents
      fileFilter: (_, file, cb) => {
        if (ALLOWED_MIMES.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Unsupported format. Use PDF, JPEG, PNG, or DOCX.'), false);
      },
    }),
  )
  async uploadMulti(
    @UploadedFiles() files: Express.Multer.File[],
    // previousReportId: analyse these documents together with that report's stored
    // ones, so adding a page builds on the earlier reports instead of replacing them.
    // Ownership of it is verified in the service.
    @Body() body: { description?: string; treatment?: string; country?: string; urgency?: string; previousReportId?: string },
    @Request() req,
  ) {
    return this.uploadService.analyzeAndStore({ userId: req.user.id, files, ...body });
  }

  @ApiOperation({ summary: "Re-run an existing report's analysis on its stored documents (owner only, capped)" })
  @Post('reanalyze/:id')
  reanalyze(@Param('id') id: string, @Request() req) {
    return this.uploadService.reanalyze(id, req.user.id, req.user.role === 'ADMIN');
  }

  @ApiOperation({ summary: 'Get a stored analysis by ID (owner or admin only)' })
  @Get('analysis/:id')
  getAnalysis(@Param('id') id: string, @Request() req) {
    return this.uploadService.getReport(id, req.user.id, req.user.role === 'ADMIN');
  }

  @ApiOperation({ summary: 'List every document I have uploaded, grouped by journey' })
  @Get('files')
  listFiles(@Request() req) {
    return this.uploadService.listMyDocuments(req.user.id);
  }

  @ApiOperation({ summary: 'Stream one of my uploaded documents (owner or admin only)' })
  @Get('files/:reportId/:index')
  async file(
    @Param('reportId') reportId: string,
    @Param('index') index: string,
    @Request() req,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { path, name, mime } = await this.uploadService.documentFile(
      reportId, Number(index), req.user.id, req.user.role === 'ADMIN',
    );
    // PHI: inline so the browser can preview it, but never cached by a shared proxy.
    res.set({
      'Content-Type': mime || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${encodeURIComponent(name)}"`,
      'Cache-Control': 'private, no-store',
    });
    return new StreamableFile(createReadStream(path));
  }
}
