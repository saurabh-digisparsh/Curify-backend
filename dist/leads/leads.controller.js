"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const leads_service_1 = require("./leads.service");
const brightdata_service_1 = require("./brightdata.service");
const leads_config_1 = require("./leads.config");
let LeadsController = class LeadsController {
    constructor(leads, brightData) {
        this.leads = leads;
        this.brightData = brightData;
    }
    config() {
        return {
            sources: this.leads.sources(),
            regions: Object.entries(leads_config_1.REGION_CONFIG).map(([key, v]) => ({ key, label: v.label })),
            queryGroups: Object.keys(leads_config_1.QUERY_GROUPS),
            personas: [
                { key: 'undecided', label: 'Undecided where to go' },
                { key: 'cant_afford', label: "Can't afford at home" },
                { key: 'suffering', label: 'Suffering, no cure' },
                { key: 'researching', label: 'Researching / sharing journey' },
            ],
        };
    }
    stats() {
        return this.leads.stats();
    }
    jobs() {
        return this.leads.listJobs();
    }
    allJobs() {
        return this.leads.allJobs();
    }
    cancelJob(kind, id) {
        return kind === 'youtube' ? this.leads.cancel(id) : this.brightData.cancel(id);
    }
    jobDetails(kind, id) {
        return kind === 'youtube' ? this.leads.youtubeJobDetails(id) : this.brightData.jobDetails(id);
    }
    capturedStats() {
        return this.leads.capturedStats();
    }
    captured(page, pageSize, source, qualified, scored, minScore, dropReason, q, sort) {
        return this.leads.listCaptured({
            page: page ? +page : 1,
            pageSize: pageSize ? +pageSize : 50,
            source, dropReason, q, sort,
            qualified: qualified === undefined ? undefined : qualified === 'true',
            scored: scored === undefined ? undefined : scored === 'true',
            minScore: minScore ? +minScore : undefined,
        });
    }
    list(page, pageSize, source, region, status, type, minScore, aiOnly, persona, q, sort) {
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
    generate(body) {
        return this.leads.generate({ ...body, trigger: 'manual' });
    }
    update(id, body) {
        return this.leads.update(id, body);
    }
    remove(id) {
        return this.leads.remove(id);
    }
    brightDataStats(platform) {
        return this.brightData.captureStats(platform);
    }
    brightDataJobs() {
        return this.brightData.listJobs();
    }
    analytics(bucket) {
        return this.brightData.analytics(bucket);
    }
    classify(body) {
        return this.brightData.startCategorize(body || {});
    }
    classifyStatus() {
        return this.brightData.categorizeStatus();
    }
    analyticsPosts(category, platform, q, page, pageSize) {
        return this.brightData.analyticsPosts({
            category, platform, q,
            page: page ? +page : 1,
            pageSize: pageSize ? +pageSize : 25,
        });
    }
    captures(page, pageSize, platform, category, temperature, minSignals, q, includeDeleted, includeSpam, sort) {
        return this.brightData.listCaptures({
            page: page ? +page : 1,
            pageSize: pageSize ? +pageSize : 50,
            platform, category, temperature, q, sort,
            minSignals: minSignals ? +minSignals : undefined,
            includeDeleted: includeDeleted === 'true',
            includeSpam: includeSpam === 'true',
        });
    }
    collect(body) {
        return this.brightData.collect({ ...body, trigger: 'manual' });
    }
    capture(id) {
        return this.brightData.getCapture(id);
    }
    fetchComments(id) {
        return this.brightData.fetchComments(id);
    }
    softDeleteCapture(id) {
        return this.brightData.softDelete(id);
    }
    restoreCapture(id) {
        return this.brightData.restore(id);
    }
};
exports.LeadsController = LeadsController;
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Available sources, regions and query groups for the generate form' }),
    (0, common_1.Get)('config'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "config", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Lead counts, region/status breakdown, and YouTube quota status' }),
    (0, common_1.Get)('stats'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "stats", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Recent generation jobs' }),
    (0, common_1.Get)('jobs'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "jobs", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'All jobs across every source (YouTube + Bright Data), newest first' }),
    (0, common_1.Get)('all-jobs'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "allJobs", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Cancel a running job' }),
    (0, common_1.Post)('jobs/:kind/:id/cancel'),
    __param(0, (0, common_1.Param)('kind')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "cancelJob", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Full per-result breakdown (accept/reject + reason + source) for a job' }),
    (0, common_1.Get)('jobs/:kind/:id/details'),
    __param(0, (0, common_1.Param)('kind')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "jobDetails", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Captured-video funnel counts (analysis dataset)' }),
    (0, common_1.Get)('captured/stats'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "capturedStats", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Raw captured videos — the full funnel kept for analysis (not just qualified leads)' }),
    (0, common_1.Get)('captured'),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('pageSize')),
    __param(2, (0, common_1.Query)('source')),
    __param(3, (0, common_1.Query)('qualified')),
    __param(4, (0, common_1.Query)('scored')),
    __param(5, (0, common_1.Query)('minScore')),
    __param(6, (0, common_1.Query)('dropReason')),
    __param(7, (0, common_1.Query)('q')),
    __param(8, (0, common_1.Query)('sort')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "captured", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Paginated leads with filters (server-side)' }),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('pageSize')),
    __param(2, (0, common_1.Query)('source')),
    __param(3, (0, common_1.Query)('region')),
    __param(4, (0, common_1.Query)('status')),
    __param(5, (0, common_1.Query)('type')),
    __param(6, (0, common_1.Query)('minScore')),
    __param(7, (0, common_1.Query)('aiOnly')),
    __param(8, (0, common_1.Query)('persona')),
    __param(9, (0, common_1.Query)('q')),
    __param(10, (0, common_1.Query)('sort')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "list", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Trigger a YouTube lead-generation run (quota-capped)' }),
    (0, common_1.Post)('generate'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "generate", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Update a lead (status / notes)' }),
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "update", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Delete a lead' }),
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "remove", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Credit budget + capture funnel counts (Bright Data; optional platform filter)' }),
    (0, common_1.Get)('brightdata/stats'),
    __param(0, (0, common_1.Query)('platform')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "brightDataStats", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Recent Bright Data collection jobs' }),
    (0, common_1.Get)('brightdata/jobs'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "brightDataJobs", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Lead-analytics dashboard: AI category breakdown, per-platform matrix, volume per time bucket' }),
    (0, common_1.Get)('analytics'),
    __param(0, (0, common_1.Query)('bucket')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "analytics", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Start an AI run that classifies captures into Lead/Marketing/News/Other (async)' }),
    (0, common_1.Post)('analytics/classify'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "classify", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Progress of the AI classification run (for polling)' }),
    (0, common_1.Get)('analytics/classify/status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "classifyStatus", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Drill-down post list for analytics (social captures + YouTube leads), filtered by category/platform' }),
    (0, common_1.Get)('analytics/posts'),
    __param(0, (0, common_1.Query)('category')),
    __param(1, (0, common_1.Query)('platform')),
    __param(2, (0, common_1.Query)('q')),
    __param(3, (0, common_1.Query)('page')),
    __param(4, (0, common_1.Query)('pageSize')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "analyticsPosts", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Raw captured social posts (analysis dataset; soft-deleted hidden unless includeDeleted)' }),
    (0, common_1.Get)('brightdata/captures'),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('pageSize')),
    __param(2, (0, common_1.Query)('platform')),
    __param(3, (0, common_1.Query)('category')),
    __param(4, (0, common_1.Query)('temperature')),
    __param(5, (0, common_1.Query)('minSignals')),
    __param(6, (0, common_1.Query)('q')),
    __param(7, (0, common_1.Query)('includeDeleted')),
    __param(8, (0, common_1.Query)('includeSpam')),
    __param(9, (0, common_1.Query)('sort')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "captures", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Trigger a Bright Data collection (credit-capped at 1000)' }),
    (0, common_1.Post)('brightdata/collect'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "collect", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'One captured post (for polling comment-fetch status)' }),
    (0, common_1.Get)('brightdata/captures/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "capture", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Fetch a Reddit post\'s full comment thread (async, credit-capped)' }),
    (0, common_1.Post)('brightdata/captures/:id/comments'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "fetchComments", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Soft-delete a captured post (never physically removed)' }),
    (0, common_1.Delete)('brightdata/captures/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "softDeleteCapture", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Restore a soft-deleted capture' }),
    (0, common_1.Patch)('brightdata/captures/:id/restore'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "restoreCapture", null);
exports.LeadsController = LeadsController = __decorate([
    (0, swagger_1.ApiTags)('Admin · Leads'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('ADMIN'),
    (0, common_1.Controller)('admin/leads'),
    __metadata("design:paramtypes", [leads_service_1.LeadsService,
        brightdata_service_1.BrightDataService])
], LeadsController);
//# sourceMappingURL=leads.controller.js.map