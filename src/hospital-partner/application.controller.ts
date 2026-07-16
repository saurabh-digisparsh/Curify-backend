import {
  Controller, Post, Put, Delete, Get, Body, Param, Query, Req, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { PartnerService } from './partner.service';
import { hospitalDocStorage, docFileFilter } from './docs.storage';
import {
  ApplyDto, ContactDto, VerifyOtpDto, AccreditationDto, UploadDocDto, AgreementDto,
} from './dto/partner.dto';

// PUBLIC self-serve 'Partner with Curify' application (FR-1: no login). Every
// step after apply is scoped by the secret `token` returned at apply. Throttled.
@ApiTags('Partner · Application (public)')
@Throttle({ default: { ttl: 60_000, limit: 40 } })
@Controller('partner')
export class ApplicationController {
  constructor(private readonly svc: PartnerService) {}

  @ApiOperation({ summary: 'Start an application (returns id + session token)' })
  @Post('apply')
  apply(@Body() dto: ApplyDto) { return this.svc.apply(dto); }

  @ApiOperation({ summary: 'Resume an in-progress application' })
  @Get(':id')
  get(@Param('id') id: string, @Query('token') token: string) { return this.svc.getApplication(id, token); }

  @ApiOperation({ summary: 'Set authorised contact + send email/WhatsApp OTPs' })
  @Put(':id/contact')
  contact(@Param('id') id: string, @Query('token') token: string, @Body() dto: ContactDto) { return this.svc.setContact(id, token, dto); }

  @ApiOperation({ summary: 'Resend both OTPs' })
  @Post(':id/resend-otp')
  resend(@Param('id') id: string, @Query('token') token: string) { return this.svc.resendOtps(id, token); }

  @ApiOperation({ summary: 'Verify one channel OTP (email or whatsapp)' })
  @Post(':id/verify')
  verify(@Param('id') id: string, @Query('token') token: string, @Body() dto: VerifyOtpDto) { return this.svc.verifyOtp(id, token, dto); }

  @ApiOperation({ summary: 'Auto-verify accreditation from the scraped registry (by hospital name + city)' })
  @Post(':id/accreditation/lookup')
  lookupAccreditation(@Param('id') id: string, @Query('token') token: string) { return this.svc.lookupAccreditation(id, token); }

  @ApiOperation({ summary: 'Add an NABH/JCI accreditation (registry fast-track)' })
  @Post(':id/accreditation')
  accreditation(@Param('id') id: string, @Query('token') token: string, @Body() dto: AccreditationDto) { return this.svc.addAccreditation(id, token, dto); }

  @ApiOperation({ summary: 'Declare not-accredited → document-check path' })
  @Post(':id/not-accredited')
  notAccredited(@Param('id') id: string, @Query('token') token: string) { return this.svc.markNotAccredited(id, token); }

  @ApiOperation({ summary: 'Upload a verification document' })
  @ApiConsumes('multipart/form-data')
  @Post(':id/documents')
  @UseInterceptors(FileInterceptor('file', { storage: hospitalDocStorage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: docFileFilter }))
  upload(@Param('id') id: string, @Query('token') token: string, @UploadedFile() file: Express.Multer.File, @Body() dto: UploadDocDto) {
    return this.svc.uploadDoc(id, token, file, dto);
  }

  @ApiOperation({ summary: 'Delete a verification document' })
  @Delete(':id/documents/:docId')
  removeDoc(@Param('id') id: string, @Param('docId') docId: string, @Query('token') token: string) { return this.svc.removeDoc(id, token, docId); }

  @ApiOperation({ summary: 'Sign the commission agreement (typed-name e-signature)' })
  @Post(':id/agreement')
  agreement(@Param('id') id: string, @Query('token') token: string, @Body() dto: AgreementDto, @Req() req: Request) {
    return this.svc.signAgreement(id, token, dto, req.ip);
  }

  @ApiOperation({ summary: 'Provision the dashboard + deliver credentials' })
  @Post(':id/provision')
  provision(@Param('id') id: string, @Query('token') token: string) { return this.svc.provision(id, token); }
}
