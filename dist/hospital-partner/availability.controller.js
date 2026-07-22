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
exports.AvailabilityController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const fs_1 = require("fs");
const partner_service_1 = require("./partner.service");
const teleconsult_service_1 = require("./teleconsult.service");
const docs_storage_1 = require("./docs.storage");
const partner_dto_1 = require("./dto/partner.dto");
let AvailabilityController = class AvailabilityController {
    constructor(svc, tele) {
        this.svc = svc;
        this.tele = tele;
    }
    get(token) { return this.svc.availabilityByToken(token); }
    set(token, dto) { return this.svc.setAvailability(token, dto); }
    consults(token) { return this.tele.doctorConsults(token); }
    video(token, teleconsultId) {
        return this.tele.doctorVideoToken(token, teleconsultId);
    }
    quote(token, id, dto) {
        return this.tele.setQuote(token, id, dto);
    }
    cancel(token, id, dto) {
        return this.tele.doctorCancel(token, id, dto.reason);
    }
    complete(token, id) {
        return this.tele.doctorComplete(token, id);
    }
    endCall(token, id) {
        return this.tele.doctorEndCall(token, id);
    }
    addDoc(token, id, file, dto) {
        return this.tele.doctorAddDoc(token, id, file, dto.kind);
    }
    async docFile(token, docId, res) {
        const { path, name } = await this.tele.docFileForDoctor(docId, token);
        res.set({ 'Content-Disposition': `inline; filename="${encodeURIComponent(name)}"` });
        return new common_1.StreamableFile((0, fs_1.createReadStream)(path));
    }
};
exports.AvailabilityController = AvailabilityController;
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Get the doctor + their weekly availability' }),
    (0, common_1.Get)(':token'),
    __param(0, (0, common_1.Param)('token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AvailabilityController.prototype, "get", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Replace the doctor’s recurring weekly windows' }),
    (0, common_1.Post)(':token'),
    __param(0, (0, common_1.Param)('token')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, partner_dto_1.SetAvailabilityDto]),
    __metadata("design:returntype", void 0)
], AvailabilityController.prototype, "set", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: "The doctor's teleconsultations (monitoring + management)" }),
    (0, common_1.Get)(':token/teleconsults'),
    __param(0, (0, common_1.Param)('token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AvailabilityController.prototype, "consults", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: "Doctor's Jitsi join token for a booked teleconsult (marks it live)" }),
    (0, common_1.Get)(':token/video/:teleconsultId'),
    __param(0, (0, common_1.Param)('token')),
    __param(1, (0, common_1.Param)('teleconsultId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AvailabilityController.prototype, "video", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Record the price quotation given to the patient' }),
    (0, common_1.Post)(':token/teleconsults/:id/quote'),
    __param(0, (0, common_1.Param)('token')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, partner_dto_1.QuoteDto]),
    __metadata("design:returntype", void 0)
], AvailabilityController.prototype, "quote", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Cancel a booked teleconsult (notifies the patient, no free consult used)' }),
    (0, common_1.Post)(':token/teleconsults/:id/cancel'),
    __param(0, (0, common_1.Param)('token')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, partner_dto_1.CancelTeleconsultDto]),
    __metadata("design:returntype", void 0)
], AvailabilityController.prototype, "cancel", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Mark a teleconsult complete' }),
    (0, common_1.Post)(':token/teleconsults/:id/complete'),
    __param(0, (0, common_1.Param)('token')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AvailabilityController.prototype, "complete", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Doctor ended the video call — clears "live", records endedAt' }),
    (0, common_1.Post)(':token/teleconsults/:id/end'),
    __param(0, (0, common_1.Param)('token')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AvailabilityController.prototype, "endCall", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Share a document into a teleconsult' }),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, common_1.Post)(':token/teleconsults/:id/documents'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', { storage: docs_storage_1.hospitalDocStorage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: docs_storage_1.docFileFilter })),
    __param(0, (0, common_1.Param)('token')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.UploadedFile)()),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, partner_dto_1.TeleconsultDocDto]),
    __metadata("design:returntype", void 0)
], AvailabilityController.prototype, "addDoc", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Stream a shared consult document (token-scoped)' }),
    (0, common_1.Get)(':token/teleconsults/documents/:docId/file'),
    __param(0, (0, common_1.Param)('token')),
    __param(1, (0, common_1.Param)('docId')),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], AvailabilityController.prototype, "docFile", null);
exports.AvailabilityController = AvailabilityController = __decorate([
    (0, swagger_1.ApiTags)('Partner · Availability (public)'),
    (0, throttler_1.Throttle)({ default: { ttl: 60_000, limit: 30 } }),
    (0, common_1.Controller)('availability'),
    __metadata("design:paramtypes", [partner_service_1.PartnerService, teleconsult_service_1.TeleconsultService])
], AvailabilityController);
//# sourceMappingURL=availability.controller.js.map