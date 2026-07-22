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
exports.UploadController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const multer_1 = require("multer");
const fs_1 = require("fs");
const upload_service_1 = require("./upload.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const ALLOWED_MIMES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
let UploadController = class UploadController {
    constructor(uploadService) {
        this.uploadService = uploadService;
    }
    async upload(file, body, req) {
        return this.uploadService.analyzeAndStore({
            userId: req.user.id,
            file,
            ...body,
        });
    }
    async uploadMulti(files, body, req) {
        return this.uploadService.analyzeAndStore({ userId: req.user.id, files, ...body });
    }
    reanalyze(id, req) {
        return this.uploadService.reanalyze(id, req.user.id, req.user.role === 'ADMIN');
    }
    getAnalysis(id, req) {
        return this.uploadService.getReport(id, req.user.id, req.user.role === 'ADMIN');
    }
    listFiles(req) {
        return this.uploadService.listMyDocuments(req.user.id);
    }
    async file(reportId, index, req, res) {
        const { path, name, mime } = await this.uploadService.documentFile(reportId, Number(index), req.user.id, req.user.role === 'ADMIN');
        res.set({
            'Content-Type': mime || 'application/octet-stream',
            'Content-Disposition': `inline; filename="${encodeURIComponent(name)}"`,
            'Cache-Control': 'private, no-store',
        });
        return new common_1.StreamableFile((0, fs_1.createReadStream)(path));
    }
};
exports.UploadController = UploadController;
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Upload a medical report and get AI analysis' }),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, common_1.Post)(),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.memoryStorage)(),
        limits: { fileSize: 10 * 1024 * 1024 },
        fileFilter: (_, file, cb) => {
            if (ALLOWED_MIMES.includes(file.mimetype))
                cb(null, true);
            else
                cb(new Error('Unsupported format. Use PDF, JPEG, PNG, or DOCX.'), false);
        },
    })),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], UploadController.prototype, "upload", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Upload MULTIPLE medical documents and get one combined AI analysis' }),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, common_1.Post)('multi'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FilesInterceptor)('files', 8, {
        storage: (0, multer_1.memoryStorage)(),
        limits: { fileSize: 10 * 1024 * 1024 },
        fileFilter: (_, file, cb) => {
            if (ALLOWED_MIMES.includes(file.mimetype))
                cb(null, true);
            else
                cb(new Error('Unsupported format. Use PDF, JPEG, PNG, or DOCX.'), false);
        },
    })),
    __param(0, (0, common_1.UploadedFiles)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, Object, Object]),
    __metadata("design:returntype", Promise)
], UploadController.prototype, "uploadMulti", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: "Re-run an existing report's analysis on its stored documents (owner only, capped)" }),
    (0, common_1.Post)('reanalyze/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], UploadController.prototype, "reanalyze", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Get a stored analysis by ID (owner or admin only)' }),
    (0, common_1.Get)('analysis/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], UploadController.prototype, "getAnalysis", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'List every document I have uploaded, grouped by journey' }),
    (0, common_1.Get)('files'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], UploadController.prototype, "listFiles", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Stream one of my uploaded documents (owner or admin only)' }),
    (0, common_1.Get)('files/:reportId/:index'),
    __param(0, (0, common_1.Param)('reportId')),
    __param(1, (0, common_1.Param)('index')),
    __param(2, (0, common_1.Request)()),
    __param(3, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, Object]),
    __metadata("design:returntype", Promise)
], UploadController.prototype, "file", null);
exports.UploadController = UploadController = __decorate([
    (0, swagger_1.ApiTags)('Upload & Analysis'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('upload'),
    __metadata("design:paramtypes", [upload_service_1.UploadService])
], UploadController);
//# sourceMappingURL=upload.controller.js.map