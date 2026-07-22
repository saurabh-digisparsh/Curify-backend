import {
  Controller, Get, Post, Param, Body, UploadedFile, UseInterceptors, Res,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { createReadStream } from 'fs';
import type { Response } from 'express';
import { PartnerService } from './partner.service';
import { TeleconsultService } from './teleconsult.service';
import { hospitalDocStorage, docFileFilter } from './docs.storage';
import { SetAvailabilityDto, QuoteDto, TeleconsultDocDto, CancelTeleconsultDto } from './dto/partner.dto';

// PUBLIC, no auth: a doctor opens their private (WhatsApp) link to set recurring
// weekly availability (FR-26/27) and to run their teleconsults — join calls, share
// documents, quote a price, mark complete. Scoped by the unguessable token.
@ApiTags('Partner · Availability (public)')
@Throttle({ default: { ttl: 60_000, limit: 30 } })
@Controller('availability')
export class AvailabilityController {
  constructor(private readonly svc: PartnerService, private readonly tele: TeleconsultService) {}

  @ApiOperation({ summary: 'Get the doctor + their weekly availability' })
  @Get(':token')
  get(@Param('token') token: string) { return this.svc.availabilityByToken(token); }

  @ApiOperation({ summary: 'Replace the doctor’s recurring weekly windows' })
  @Post(':token')
  set(@Param('token') token: string, @Body() dto: SetAvailabilityDto) { return this.svc.setAvailability(token, dto); }

  // ── Teleconsult management (doctor side) ──
  @ApiOperation({ summary: "The doctor's teleconsultations (monitoring + management)" })
  @Get(':token/teleconsults')
  consults(@Param('token') token: string) { return this.tele.doctorConsults(token); }

  @ApiOperation({ summary: "Doctor's Jitsi join token for a booked teleconsult (marks it live)" })
  @Get(':token/video/:teleconsultId')
  video(@Param('token') token: string, @Param('teleconsultId') teleconsultId: string) {
    return this.tele.doctorVideoToken(token, teleconsultId);
  }

  @ApiOperation({ summary: 'Record the price quotation given to the patient' })
  @Post(':token/teleconsults/:id/quote')
  quote(@Param('token') token: string, @Param('id') id: string, @Body() dto: QuoteDto) {
    return this.tele.setQuote(token, id, dto);
  }

  @ApiOperation({ summary: 'Cancel a booked teleconsult (notifies the patient, no free consult used)' })
  @Post(':token/teleconsults/:id/cancel')
  cancel(@Param('token') token: string, @Param('id') id: string, @Body() dto: CancelTeleconsultDto) {
    return this.tele.doctorCancel(token, id, dto.reason);
  }

  @ApiOperation({ summary: 'Mark a teleconsult complete' })
  @Post(':token/teleconsults/:id/complete')
  complete(@Param('token') token: string, @Param('id') id: string) {
    return this.tele.doctorComplete(token, id);
  }

  @ApiOperation({ summary: 'Doctor ended the video call — clears "live", records endedAt' })
  @Post(':token/teleconsults/:id/end')
  endCall(@Param('token') token: string, @Param('id') id: string) {
    return this.tele.doctorEndCall(token, id);
  }

  @ApiOperation({ summary: 'Share a document into a teleconsult' })
  @ApiConsumes('multipart/form-data')
  @Post(':token/teleconsults/:id/documents')
  @UseInterceptors(FileInterceptor('file', { storage: hospitalDocStorage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: docFileFilter }))
  addDoc(@Param('token') token: string, @Param('id') id: string, @UploadedFile() file: Express.Multer.File, @Body() dto: TeleconsultDocDto) {
    return this.tele.doctorAddDoc(token, id, file, dto.kind);
  }

  @ApiOperation({ summary: 'Stream a shared consult document (token-scoped)' })
  @Get(':token/teleconsults/documents/:docId/file')
  async docFile(@Param('token') token: string, @Param('docId') docId: string, @Res({ passthrough: true }) res: Response) {
    const { path, name } = await this.tele.docFileForDoctor(docId, token);
    res.set({ 'Content-Disposition': `inline; filename="${encodeURIComponent(name)}"` });
    return new StreamableFile(createReadStream(path));
  }
}
