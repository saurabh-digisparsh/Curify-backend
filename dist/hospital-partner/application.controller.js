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
exports.ApplicationController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const partner_service_1 = require("./partner.service");
const docs_storage_1 = require("./docs.storage");
const partner_dto_1 = require("./dto/partner.dto");
let ApplicationController = class ApplicationController {
    constructor(svc) {
        this.svc = svc;
    }
    apply(dto) { return this.svc.apply(dto); }
    get(id, token) { return this.svc.getApplication(id, token); }
    contact(id, token, dto) { return this.svc.setContact(id, token, dto); }
    resend(id, token) { return this.svc.resendOtps(id, token); }
    verify(id, token, dto) { return this.svc.verifyOtp(id, token, dto); }
    lookupAccreditation(id, token) { return this.svc.lookupAccreditation(id, token); }
    accreditation(id, token, dto) { return this.svc.addAccreditation(id, token, dto); }
    notAccredited(id, token) { return this.svc.markNotAccredited(id, token); }
    upload(id, token, file, dto) {
        return this.svc.uploadDoc(id, token, file, dto);
    }
    removeDoc(id, docId, token) { return this.svc.removeDoc(id, token, docId); }
    agreement(id, token, dto, req) {
        return this.svc.signAgreement(id, token, dto, req.ip);
    }
    provision(id, token) { return this.svc.provision(id, token); }
};
exports.ApplicationController = ApplicationController;
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Start an application (returns id + session token)' }),
    (0, common_1.Post)('apply'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [partner_dto_1.ApplyDto]),
    __metadata("design:returntype", void 0)
], ApplicationController.prototype, "apply", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Resume an in-progress application' }),
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ApplicationController.prototype, "get", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Set authorised contact + send email/WhatsApp OTPs' }),
    (0, common_1.Put)(':id/contact'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('token')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, partner_dto_1.ContactDto]),
    __metadata("design:returntype", void 0)
], ApplicationController.prototype, "contact", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Resend both OTPs' }),
    (0, common_1.Post)(':id/resend-otp'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ApplicationController.prototype, "resend", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Verify one channel OTP (email or whatsapp)' }),
    (0, common_1.Post)(':id/verify'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('token')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, partner_dto_1.VerifyOtpDto]),
    __metadata("design:returntype", void 0)
], ApplicationController.prototype, "verify", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Auto-verify accreditation from the scraped registry (by hospital name + city)' }),
    (0, common_1.Post)(':id/accreditation/lookup'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ApplicationController.prototype, "lookupAccreditation", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Add an NABH/JCI accreditation (registry fast-track)' }),
    (0, common_1.Post)(':id/accreditation'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('token')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, partner_dto_1.AccreditationDto]),
    __metadata("design:returntype", void 0)
], ApplicationController.prototype, "accreditation", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Declare not-accredited → document-check path' }),
    (0, common_1.Post)(':id/not-accredited'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ApplicationController.prototype, "notAccredited", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Upload a verification document' }),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, common_1.Post)(':id/documents'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', { storage: docs_storage_1.hospitalDocStorage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: docs_storage_1.docFileFilter })),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('token')),
    __param(2, (0, common_1.UploadedFile)()),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, partner_dto_1.UploadDocDto]),
    __metadata("design:returntype", void 0)
], ApplicationController.prototype, "upload", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Delete a verification document' }),
    (0, common_1.Delete)(':id/documents/:docId'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('docId')),
    __param(2, (0, common_1.Query)('token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], ApplicationController.prototype, "removeDoc", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Sign the commission agreement (typed-name e-signature)' }),
    (0, common_1.Post)(':id/agreement'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('token')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, partner_dto_1.AgreementDto, Object]),
    __metadata("design:returntype", void 0)
], ApplicationController.prototype, "agreement", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Provision the dashboard + deliver credentials' }),
    (0, common_1.Post)(':id/provision'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ApplicationController.prototype, "provision", null);
exports.ApplicationController = ApplicationController = __decorate([
    (0, swagger_1.ApiTags)('Partner · Application (public)'),
    (0, throttler_1.Throttle)({ default: { ttl: 60_000, limit: 40 } }),
    (0, common_1.Controller)('partner'),
    __metadata("design:paramtypes", [partner_service_1.PartnerService])
], ApplicationController);
//# sourceMappingURL=application.controller.js.map