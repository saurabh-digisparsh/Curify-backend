import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { LeadsService, GenerateParams } from './leads.service';
import { BrightDataService, CollectParams } from './brightdata.service';
import { QUERY_GROUPS, REGION_CONFIG } from './leads.config';

@ApiTags('Admin · Leads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/leads')
export class LeadsController {
  constructor(
    private readonly leads: LeadsService,
    private readonly brightData: BrightDataService,
  ) {}

  @ApiOperation({ summary: 'Available sources, regions and query groups for the generate form' })
  @Get('config')
  config() {
    return {
      sources: this.leads.sources(),
      regions: Object.entries(REGION_CONFIG).map(([key, v]) => ({ key, label: v.label })),
      queryGroups: Object.keys(QUERY_GROUPS),
      personas: [
        { key: 'undecided', label: 'Undecided where to go' },
        { key: 'cant_afford', label: "Can't afford at home" },
        { key: 'suffering', label: 'Suffering, no cure' },
        { key: 'researching', label: 'Researching / sharing journey' },
      ],
    };
  }

  @ApiOperation({ summary: 'Lead counts, region/status breakdown, and YouTube quota status' })
  @Get('stats')
  stats() {
    return this.leads.stats();
  }

  @ApiOperation({ summary: 'Recent generation jobs' })
  @Get('jobs')
  jobs() {
    return this.leads.listJobs();
  }

  // ── Job management (all sources: YouTube + Bright Data) ───────────────────────

  @ApiOperation({ summary: 'All jobs across every source (YouTube + Bright Data), newest first' })
  @Get('all-jobs')
  allJobs() {
    return this.leads.allJobs();
  }

  @ApiOperation({ summary: 'Cancel a running job' })
  @Post('jobs/:kind/:id/cancel')
  cancelJob(@Param('kind') kind: string, @Param('id') id: string) {
    return kind === 'youtube' ? this.leads.cancel(id) : this.brightData.cancel(id);
  }

  @ApiOperation({ summary: 'Full per-result breakdown (accept/reject + reason + source) for a job' })
  @Get('jobs/:kind/:id/details')
  jobDetails(@Param('kind') kind: string, @Param('id') id: string) {
    return kind === 'youtube' ? this.leads.youtubeJobDetails(id) : this.brightData.jobDetails(id);
  }

  @ApiOperation({ summary: 'Captured-video funnel counts (analysis dataset)' })
  @Get('captured/stats')
  capturedStats() {
    return this.leads.capturedStats();
  }

  @ApiOperation({ summary: 'Raw captured videos — the full funnel kept for analysis (not just qualified leads)' })
  @Get('captured')
  captured(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('source') source?: string,
    @Query('qualified') qualified?: string,
    @Query('scored') scored?: string,
    @Query('minScore') minScore?: string,
    @Query('dropReason') dropReason?: string,
    @Query('q') q?: string,
    @Query('sort') sort?: string,
  ) {
    return this.leads.listCaptured({
      page: page ? +page : 1,
      pageSize: pageSize ? +pageSize : 50,
      source, dropReason, q, sort,
      qualified: qualified === undefined ? undefined : qualified === 'true',
      scored: scored === undefined ? undefined : scored === 'true',
      minScore: minScore ? +minScore : undefined,
    });
  }

  @ApiOperation({ summary: 'Paginated leads with filters (server-side)' })
  @Get()
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('source') source?: string,
    @Query('region') region?: string,
    @Query('status') status?: string,
    @Query('type') type?: 'video' | 'short',
    @Query('minScore') minScore?: string,
    @Query('aiOnly') aiOnly?: string,
    @Query('persona') persona?: string,
    @Query('q') q?: string,
    @Query('sort') sort?: string,
  ) {
    return this.leads.list({
      page: page ? +page : 1,
      pageSize: pageSize ? +pageSize : 12,
      source, region, status, type,
      minScore: minScore ? +minScore : undefined,
      aiOnly: aiOnly === 'true',
      persona,
      q, sort,
    });
  }

  @ApiOperation({ summary: 'Trigger a YouTube lead-generation run (quota-capped)' })
  @Post('generate')
  generate(@Body() body: GenerateParams) {
    return this.leads.generate({ ...body, trigger: 'manual' });
  }

  @ApiOperation({ summary: 'Update a lead (status / notes)' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: { status?: string; notes?: string }) {
    return this.leads.update(id, body);
  }

  @ApiOperation({ summary: 'Delete a lead' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.leads.remove(id);
  }

  // ── Bright Data social capture (Reddit / Quora / Instagram / Facebook) ────────

  @ApiOperation({ summary: 'Credit budget + capture funnel counts (Bright Data; optional platform filter)' })
  @Get('brightdata/stats')
  brightDataStats(@Query('platform') platform?: string) {
    return this.brightData.captureStats(platform);
  }

  @ApiOperation({ summary: 'Recent Bright Data collection jobs' })
  @Get('brightdata/jobs')
  brightDataJobs() {
    return this.brightData.listJobs();
  }

  // ── Lead analytics (AI category breakdown + monthly volume) ───────────────────

  @ApiOperation({ summary: 'Lead-analytics dashboard: AI category breakdown, per-platform matrix, volume per time bucket' })
  @Get('analytics')
  analytics(@Query('bucket') bucket?: 'day' | 'month' | 'quarter' | 'year') {
    return this.brightData.analytics(bucket);
  }

  @ApiOperation({ summary: 'Start an AI run that classifies captures into Lead/Marketing/News/Other (async)' })
  @Post('analytics/classify')
  classify(@Body() body: { reclassify?: boolean; limit?: number }) {
    return this.brightData.startCategorize(body || {});
  }

  @ApiOperation({ summary: 'Progress of the AI classification run (for polling)' })
  @Get('analytics/classify/status')
  classifyStatus() {
    return this.brightData.categorizeStatus();
  }

  @ApiOperation({ summary: 'Re-score all stored captures from saved text (DB-only backfill of corridor-aware heat/signals)' })
  @Post('analytics/rescore')
  rescore() {
    return this.brightData.rescoreCaptures();
  }

  @ApiOperation({ summary: 'Reset + few-shot re-classify: keep DB-sourced exemplars, clear other labels, re-classify from scratch' })
  @Post('analytics/reset-reclassify')
  resetReclassify() {
    return this.brightData.resetAndReclassify();
  }

  @ApiOperation({ summary: 'Classification scorecard: confusion matrix + precision/recall/F1 from human-reviewed rows' })
  @Get('analytics/scorecard')
  scorecard() {
    return this.brightData.classificationScorecard();
  }

  @ApiOperation({ summary: 'Drill-down post list for analytics (social captures + YouTube leads), filtered by category/platform' })
  @Get('analytics/posts')
  analyticsPosts(
    @Query('category') category?: string,
    @Query('platform') platform?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.brightData.analyticsPosts({
      category, platform, q,
      page: page ? +page : 1,
      pageSize: pageSize ? +pageSize : 25,
    });
  }

  @ApiOperation({ summary: 'Raw captured social posts (analysis dataset; soft-deleted hidden unless includeDeleted)' })
  @Get('brightdata/captures')
  captures(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('platform') platform?: string,
    @Query('category') category?: string,
    @Query('temperature') temperature?: string,
    @Query('minSignals') minSignals?: string,
    @Query('q') q?: string,
    @Query('includeDeleted') includeDeleted?: string,
    @Query('includeSpam') includeSpam?: string,
    @Query('sort') sort?: string,
    @Query('needsReview') needsReview?: string,
  ) {
    return this.brightData.listCaptures({
      page: page ? +page : 1,
      pageSize: pageSize ? +pageSize : 50,
      platform, category, temperature, q, sort,
      minSignals: minSignals ? +minSignals : undefined,
      includeDeleted: includeDeleted === 'true',
      includeSpam: includeSpam === 'true',
      needsReview: needsReview === 'true',
    });
  }

  @ApiOperation({ summary: 'Trigger a Bright Data collection (credit-capped at 1000)' })
  @Post('brightdata/collect')
  collect(@Body() body: CollectParams) {
    return this.brightData.collect({ ...body, trigger: 'manual' });
  }

  @ApiOperation({ summary: 'One captured post (for polling comment-fetch status)' })
  @Get('brightdata/captures/:id')
  capture(@Param('id') id: string) {
    return this.brightData.getCapture(id);
  }

  @ApiOperation({ summary: 'Fetch a Reddit post\'s full comment thread (async, credit-capped)' })
  @Post('brightdata/captures/:id/comments')
  fetchComments(@Param('id') id: string) {
    return this.brightData.fetchComments(id);
  }

  @ApiOperation({ summary: 'Soft-delete a captured post (never physically removed)' })
  @Delete('brightdata/captures/:id')
  softDeleteCapture(@Param('id') id: string) {
    return this.brightData.softDelete(id);
  }

  @ApiOperation({ summary: 'Human-in-the-loop: confirm/override a captured post\'s AI category (marks reviewed)' })
  @Patch('brightdata/captures/:id/category')
  reviewCategory(@Param('id') id: string, @Body() body: { category: string }, @Req() req: any) {
    const category = String(body?.category || '').toUpperCase();
    if (!['LEAD', 'PARTNER', 'MARKETING', 'NEWS', 'OTHER'].includes(category)) throw new BadRequestException('invalid category');
    const reviewer = req?.user?.email || req?.user?.userId || req?.user?.sub || 'admin';
    return this.brightData.setCategoryByHuman(id, category as any, reviewer);
  }

  @ApiOperation({ summary: 'Restore a soft-deleted capture' })
  @Patch('brightdata/captures/:id/restore')
  restoreCapture(@Param('id') id: string) {
    return this.brightData.restore(id);
  }
}
