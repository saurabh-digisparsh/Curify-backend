import { Controller, Get, Post, Body, Param, UseGuards, Request, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ScrapeService } from './scrape.service';
import { EnrichmentService } from './enrichment.service';
import { ReviewLangService } from './review-lang.service';
import { FileImportService } from './file-import.service';
import { TriggerScrapeDto, ScrapeAllDto } from './dto/trigger-scrape.dto';

@ApiTags('Admin · Scrape')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/scrape')
export class AdminScrapeController {
  constructor(
    private readonly scrape: ScrapeService,
    private readonly enrichment: EnrichmentService,
    private readonly reviewLang: ReviewLangService,
    private readonly fileImport: FileImportService,
  ) {}

  @ApiOperation({ summary: 'Parse + validate an uploaded hospitals CSV/JSON (dry run — no writes)' })
  @Post('import/preview')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }))
  importPreview(@UploadedFile() file: Express.Multer.File) {
    return this.fileImport.validate(this.fileImport.parse(file));
  }

  @ApiOperation({ summary: 'Import validated hospital rows + kick off AI fill for missing details' })
  @Post('import/commit')
  importCommit(@Body() body: { rows: any[] }) {
    return this.fileImport.commit(body?.rows ?? []);
  }

  @ApiOperation({ summary: 'Trigger a Botasaurus scrape (async — returns a job)' })
  @Post()
  trigger(@Body() dto: TriggerScrapeDto, @Request() req) {
    return this.scrape.trigger(dto, req.user.id);
  }

  @ApiOperation({ summary: 'Scrape ALL hospitals in the DB (refresh reviews). Async — returns a job.' })
  @Post('all-hospitals')
  scrapeAll(@Body() dto: ScrapeAllDto, @Request() req) {
    return this.scrape.scrapeAllHospitals(req.user.id, dto?.minReviews);
  }

  @ApiOperation({ summary: 'Scrape the NEXT hospital in the daily round-robin (full pipeline). Async — returns a job.' })
  @Post('next-hospital')
  scrapeNext(@Request() req) {
    return this.scrape.scrapeNextHospital(req.user.id);
  }

  @ApiOperation({ summary: 'AI-enrich hospitals (price/included/surgeon/pros-cons). Runs in background.' })
  @Post('enrich')
  enrich(@Body() body: { force?: boolean; limit?: number }) {
    // Fire-and-forget: enriching many hospitals takes minutes, so return immediately.
    this.enrichment.enrichMissing({ force: body?.force, limit: body?.limit })
      .catch(() => { /* logged inside the service */ });
    return { started: true, force: !!body?.force, limit: body?.limit ?? null };
  }

  @ApiOperation({ summary: 'Localize reviews: detect language, store English translation + native script. Background.' })
  @Post('localize-reviews')
  localizeReviews(@Body() body: { limit?: number }) {
    this.reviewLang.localizeAll({ limit: body?.limit })
      .catch(() => { /* logged inside the service */ });
    return { started: true, limit: body?.limit ?? null };
  }

  @ApiOperation({ summary: 'List recent scrape jobs' })
  @Get()
  findAll() {
    return this.scrape.findAll();
  }

  @ApiOperation({ summary: 'Get a scrape job (poll for status/counts)' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.scrape.findOne(id);
  }
}
