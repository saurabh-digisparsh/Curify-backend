import {
  Controller, Get, Post, Param, Body, UseGuards, Request, UploadedFile, UseInterceptors,
  Res, StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { createReadStream } from 'fs';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TeleconsultService } from './teleconsult.service';
import { hospitalDocStorage, docFileFilter } from './docs.storage';
import { BookTeleconsultDto, TeleconsultDocDto } from './dto/partner.dto';

// Patient-facing teleconsult booking + video join + document sharing. Every route
// is JWT-guarded; ownership (this consult is mine) is enforced in the service.
@ApiTags('Teleconsults')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('teleconsults')
export class TeleconsultController {
  constructor(private readonly svc: TeleconsultService) {}

  @ApiOperation({ summary: 'My teleconsults (with quote + documents)' })
  @Get('mine')
  mine(@Request() req) {
    return this.svc.mine(req.user.id);
  }

  @ApiOperation({ summary: 'Open teleconsult slots for a doctor (next 2 weeks)' })
  @Get('doctors/:doctorId/slots')
  slots(@Param('doctorId') doctorId: string) {
    return this.svc.availableSlots(doctorId);
  }

  @ApiOperation({ summary: 'Book a teleconsult with a doctor' })
  @Post()
  book(@Request() req, @Body() dto: BookTeleconsultDto) {
    return this.svc.book(req.user.id, dto);
  }

  @ApiOperation({ summary: 'My Jitsi join token for a teleconsult' })
  @Get(':id/video')
  video(@Request() req, @Param('id') id: string) {
    return this.svc.patientVideoToken(req.user.id, id);
  }

  @ApiOperation({ summary: 'Cancel my teleconsult' })
  @Post(':id/cancel')
  cancel(@Request() req, @Param('id') id: string) {
    return this.svc.cancel(req.user.id, id);
  }

  @ApiOperation({ summary: "Accept the doctor's quote (unlocks trip planning)" })
  @Post(':id/accept-quote')
  acceptQuote(@Request() req, @Param('id') id: string) {
    return this.svc.acceptQuote(req.user.id, id);
  }

  @ApiOperation({ summary: 'Share a document into my teleconsult' })
  @ApiConsumes('multipart/form-data')
  @Post(':id/documents')
  @UseInterceptors(FileInterceptor('file', { storage: hospitalDocStorage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: docFileFilter }))
  addDoc(@Request() req, @Param('id') id: string, @UploadedFile() file: Express.Multer.File, @Body() dto: TeleconsultDocDto) {
    return this.svc.patientAddDoc(req.user.id, id, file, dto.kind);
  }

  @ApiOperation({ summary: 'Stream a shared document from my teleconsult' })
  @Get('documents/:docId/file')
  async docFile(@Request() req, @Param('docId') docId: string, @Res({ passthrough: true }) res: Response) {
    const { path, name } = await this.svc.docFileForPatient(docId, req.user.id);
    res.set({ 'Content-Disposition': `inline; filename="${encodeURIComponent(name)}"` });
    return new StreamableFile(createReadStream(path));
  }
}
