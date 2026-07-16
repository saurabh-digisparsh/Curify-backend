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
exports.TeleconsultController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const fs_1 = require("fs");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const teleconsult_service_1 = require("./teleconsult.service");
const docs_storage_1 = require("./docs.storage");
const partner_dto_1 = require("./dto/partner.dto");
let TeleconsultController = class TeleconsultController {
    constructor(svc) {
        this.svc = svc;
    }
    mine(req) {
        return this.svc.mine(req.user.id);
    }
    slots(doctorId) {
        return this.svc.availableSlots(doctorId);
    }
    book(req, dto) {
        return this.svc.book(req.user.id, dto);
    }
    video(req, id) {
        return this.svc.patientVideoToken(req.user.id, id);
    }
    cancel(req, id) {
        return this.svc.cancel(req.user.id, id);
    }
    acceptQuote(req, id) {
        return this.svc.acceptQuote(req.user.id, id);
    }
    addDoc(req, id, file, dto) {
        return this.svc.patientAddDoc(req.user.id, id, file, dto.kind);
    }
    async docFile(req, docId, res) {
        const { path, name } = await this.svc.docFileForPatient(docId, req.user.id);
        res.set({ 'Content-Disposition': `inline; filename="${encodeURIComponent(name)}"` });
        return new common_1.StreamableFile((0, fs_1.createReadStream)(path));
    }
};
exports.TeleconsultController = TeleconsultController;
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'My teleconsults (with quote + documents)' }),
    (0, common_1.Get)('mine'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], TeleconsultController.prototype, "mine", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Open teleconsult slots for a doctor (next 2 weeks)' }),
    (0, common_1.Get)('doctors/:doctorId/slots'),
    __param(0, (0, common_1.Param)('doctorId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TeleconsultController.prototype, "slots", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Book a teleconsult with a doctor' }),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, partner_dto_1.BookTeleconsultDto]),
    __metadata("design:returntype", void 0)
], TeleconsultController.prototype, "book", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'My Jitsi join token for a teleconsult' }),
    (0, common_1.Get)(':id/video'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], TeleconsultController.prototype, "video", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Cancel my teleconsult' }),
    (0, common_1.Post)(':id/cancel'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], TeleconsultController.prototype, "cancel", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: "Accept the doctor's quote (unlocks trip planning)" }),
    (0, common_1.Post)(':id/accept-quote'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], TeleconsultController.prototype, "acceptQuote", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Share a document into my teleconsult' }),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, common_1.Post)(':id/documents'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', { storage: docs_storage_1.hospitalDocStorage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: docs_storage_1.docFileFilter })),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.UploadedFile)()),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object, partner_dto_1.TeleconsultDocDto]),
    __metadata("design:returntype", void 0)
], TeleconsultController.prototype, "addDoc", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Stream a shared document from my teleconsult' }),
    (0, common_1.Get)('documents/:docId/file'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('docId')),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], TeleconsultController.prototype, "docFile", null);
exports.TeleconsultController = TeleconsultController = __decorate([
    (0, swagger_1.ApiTags)('Teleconsults'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('teleconsults'),
    __metadata("design:paramtypes", [teleconsult_service_1.TeleconsultService])
], TeleconsultController);
//# sourceMappingURL=teleconsult.controller.js.map