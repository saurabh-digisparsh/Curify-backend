import {
  Controller, Post, Get, Param, Body, UploadedFile,
  UseInterceptors, UseGuards, Request, Optional,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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

@ApiTags('Upload & Analysis')
@Controller('upload')
export class UploadController {
  constructor(private uploadService: UploadService) {}

  @ApiOperation({ summary: 'Upload a medical report and get AI analysis' })
  @ApiConsumes('multipart/form-data')
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 25 * 1024 * 1024 },
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
    return this.uploadService.analyzeAndStore({
      userId: req.user?.id,
      file,
      ...body,
    });
  }

  @ApiOperation({ summary: 'Get a stored analysis by ID' })
  @Get('analysis/:id')
  getAnalysis(@Param('id') id: string) {
    return this.uploadService.getReport(id);
  }
}
