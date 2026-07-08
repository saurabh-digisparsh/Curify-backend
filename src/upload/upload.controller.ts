import {
  Controller, Post, Get, Param, Body, UploadedFile, UploadedFiles,
  UseInterceptors, UseGuards, Request,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
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
    @Body() body: { description?: string; treatment?: string; country?: string; urgency?: string },
    @Request() req,
  ) {
    return this.uploadService.analyzeAndStore({ userId: req.user.id, files, ...body });
  }

  @ApiOperation({ summary: 'Get a stored analysis by ID (owner or admin only)' })
  @Get('analysis/:id')
  getAnalysis(@Param('id') id: string, @Request() req) {
    return this.uploadService.getReport(id, req.user.id, req.user.role === 'ADMIN');
  }
}
