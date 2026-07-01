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
exports.AdminScrapeController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const scrape_service_1 = require("./scrape.service");
const enrichment_service_1 = require("./enrichment.service");
const review_lang_service_1 = require("./review-lang.service");
const file_import_service_1 = require("./file-import.service");
const trigger_scrape_dto_1 = require("./dto/trigger-scrape.dto");
let AdminScrapeController = class AdminScrapeController {
    constructor(scrape, enrichment, reviewLang, fileImport) {
        this.scrape = scrape;
        this.enrichment = enrichment;
        this.reviewLang = reviewLang;
        this.fileImport = fileImport;
    }
    importPreview(file) {
        return this.fileImport.validate(this.fileImport.parse(file));
    }
    importCommit(body) {
        return this.fileImport.commit(body?.rows ?? []);
    }
    trigger(dto, req) {
        return this.scrape.trigger(dto, req.user.id);
    }
    scrapeAll(req) {
        return this.scrape.scrapeAllHospitals(req.user.id);
    }
    scrapeNext(req) {
        return this.scrape.scrapeNextHospital(req.user.id);
    }
    enrich(body) {
        this.enrichment.enrichMissing({ force: body?.force, limit: body?.limit })
            .catch(() => { });
        return { started: true, force: !!body?.force, limit: body?.limit ?? null };
    }
    localizeReviews(body) {
        this.reviewLang.localizeAll({ limit: body?.limit })
            .catch(() => { });
        return { started: true, limit: body?.limit ?? null };
    }
    findAll() {
        return this.scrape.findAll();
    }
    findOne(id) {
        return this.scrape.findOne(id);
    }
};
exports.AdminScrapeController = AdminScrapeController;
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Parse + validate an uploaded hospitals CSV/JSON (dry run — no writes)' }),
    (0, common_1.Post)('import/preview'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', { storage: (0, multer_1.memoryStorage)(), limits: { fileSize: 5 * 1024 * 1024 } })),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminScrapeController.prototype, "importPreview", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Import validated hospital rows + kick off AI fill for missing details' }),
    (0, common_1.Post)('import/commit'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminScrapeController.prototype, "importCommit", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Trigger a Botasaurus scrape (async — returns a job)' }),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [trigger_scrape_dto_1.TriggerScrapeDto, Object]),
    __metadata("design:returntype", void 0)
], AdminScrapeController.prototype, "trigger", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Scrape ALL hospitals in the DB (refresh reviews). Async — returns a job.' }),
    (0, common_1.Post)('all-hospitals'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminScrapeController.prototype, "scrapeAll", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Scrape the NEXT hospital in the daily round-robin (full pipeline). Async — returns a job.' }),
    (0, common_1.Post)('next-hospital'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminScrapeController.prototype, "scrapeNext", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'AI-enrich hospitals (price/included/surgeon/pros-cons). Runs in background.' }),
    (0, common_1.Post)('enrich'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminScrapeController.prototype, "enrich", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Localize reviews: detect language, store English translation + native script. Background.' }),
    (0, common_1.Post)('localize-reviews'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminScrapeController.prototype, "localizeReviews", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'List recent scrape jobs' }),
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminScrapeController.prototype, "findAll", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Get a scrape job (poll for status/counts)' }),
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminScrapeController.prototype, "findOne", null);
exports.AdminScrapeController = AdminScrapeController = __decorate([
    (0, swagger_1.ApiTags)('Admin · Scrape'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('ADMIN'),
    (0, common_1.Controller)('admin/scrape'),
    __metadata("design:paramtypes", [scrape_service_1.ScrapeService,
        enrichment_service_1.EnrichmentService,
        review_lang_service_1.ReviewLangService,
        file_import_service_1.FileImportService])
], AdminScrapeController);
//# sourceMappingURL=scrape.controller.js.map