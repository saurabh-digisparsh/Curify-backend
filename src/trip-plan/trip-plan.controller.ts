import {
  Controller, Get, Post, Patch, Body, Query, Param, UseGuards, Request,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { TripPlanService } from './trip-plan.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { isServiceType, ServiceStatus } from './trip-services';

const PROOF_MIMES = ['application/pdf', 'image/jpeg', 'image/png'];

@ApiTags('Trip Plan')
@Controller('trip-plan')
export class TripPlanController {
  constructor(private service: TripPlanService) {}

  @ApiOperation({ summary: 'Get trip plan template for procedure + destination' })
  @Get('template')
  getTemplate(
    @Query('procedure') procedure: string,
    @Query('destination') destination: string,
  ) {
    return this.service.getTemplate(procedure ?? '', destination ?? '');
  }

  @ApiOperation({ summary: 'Get flight options for a route' })
  @Get('flights')
  getFlights(
    @Query('origin') origin: string,
    @Query('destination') destination: string,
  ) {
    return this.service.getFlights(origin ?? '', destination ?? '');
  }

  @ApiOperation({ summary: 'Get all insurance plans' })
  @Get('insurance')
  getInsurance() {
    return this.service.getInsurance();
  }

  @ApiOperation({ summary: 'Generate a personalized medical trip plan' })
  @Post()
  generate(
    @Body() body: {
      hospitalId: string; diagnosis: string; treatment: string; country: string;
      departureCity?: string; travelDate?: string; travelers?: number; stayNights?: number;
      accommodation?: string;
      // Doctor's accepted quote → becomes the authoritative treatment cost line.
      treatmentCost?: number; treatmentCurrency?: string;
    },
  ) {
    return this.service.generate(body);
  }

  // ── Service-step progress (authenticated, owner-scoped) ─────────────────────
  // req.user.id is the owner on every route — a client-supplied userId is never
  // trusted, so a caller can only read/write their own trip steps.

  @ApiOperation({ summary: "List the patient's saved trip-service steps for a hospital" })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('services')
  listServices(@Query('hospitalId') hospitalId: string, @Request() req) {
    if (!hospitalId) throw new BadRequestException('hospitalId is required');
    return this.service.listServices(req.user.id, hospitalId);
  }

  @ApiOperation({ summary: 'Mark a trip-service step confirmed / skipped / pending' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('services/:type')
  setStatus(
    @Param('type') type: string,
    @Body() body: { hospitalId: string; status: ServiceStatus },
    @Request() req,
  ) {
    if (!isServiceType(type)) throw new BadRequestException('Unknown service type');
    if (!body?.hospitalId) throw new BadRequestException('hospitalId is required');
    return this.service.setServiceStatus(req.user.id, body.hospitalId, type, body.status);
  }

  @ApiOperation({ summary: 'Upload proof for a step (granted e-Visa, flight ticket) and validate' })
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseGuards(JwtAuthGuard)
  @Post('services/:type/proof')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB — same ceiling as medical uploads
      fileFilter: (_, file, cb) =>
        PROOF_MIMES.includes(file.mimetype) ? cb(null, true) : cb(new Error('Use PDF, JPEG or PNG.'), false),
    }),
  )
  uploadProof(
    @Param('type') type: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { hospitalId: string; visaNumber?: string; visaExpiry?: string; travelDate?: string },
    @Request() req,
  ) {
    if (!isServiceType(type)) throw new BadRequestException('Unknown service type');
    if (!file) throw new BadRequestException('A proof file is required');
    if (!body?.hospitalId) throw new BadRequestException('hospitalId is required');
    return this.service.attachProof(req.user.id, body.hospitalId, type, file, body);
  }
}
