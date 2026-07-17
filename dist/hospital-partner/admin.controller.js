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
exports.PartnerAdminController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const partner_service_1 = require("./partner.service");
const partner_dto_1 = require("./dto/partner.dto");
let PartnerAdminController = class PartnerAdminController {
    constructor(svc) {
        this.svc = svc;
    }
    list(status) { return this.svc.listApplications(status); }
    get(id) { return this.svc.getForAdmin(id); }
    reviewDoc(docId, dto, req) { return this.svc.reviewDoc(docId, dto, req.user.id); }
    setStatus(id, body) { return this.svc.setApplicationStatus(id, body.status); }
    resendOtp(id) { return this.svc.adminResendOtp(id); }
    resendCredentials(id) { return this.svc.adminResendCredentials(id); }
    setPriority(id, body) { return this.svc.setPriority(id, !!body.priority); }
};
exports.PartnerAdminController = PartnerAdminController;
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'List applications (optionally by status)' }),
    (0, swagger_1.ApiQuery)({ name: 'status', enum: client_1.OnboardingStatus, required: false }),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PartnerAdminController.prototype, "list", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Get one application (full)' }),
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PartnerAdminController.prototype, "get", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Verify or reject a document' }),
    (0, common_1.Patch)('documents/:docId'),
    __param(0, (0, common_1.Param)('docId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, partner_dto_1.ReviewDocDto, Object]),
    __metadata("design:returntype", void 0)
], PartnerAdminController.prototype, "reviewDoc", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Override application status (approve/reject stuck cases)' }),
    (0, common_1.Post)(':id/status'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], PartnerAdminController.prototype, "setStatus", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Help a stuck hospital: re-send its email verification code' }),
    (0, common_1.Post)(':id/resend-otp'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PartnerAdminController.prototype, "resendOtp", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Help a stuck hospital: (re)issue dashboard credentials' }),
    (0, common_1.Post)(':id/resend-credentials'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PartnerAdminController.prototype, "resendCredentials", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Set the admin-controlled "Priority partner" ranking flag' }),
    (0, common_1.Post)(':id/priority'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], PartnerAdminController.prototype, "setPriority", null);
exports.PartnerAdminController = PartnerAdminController = __decorate([
    (0, swagger_1.ApiTags)('Admin · Hospital Onboarding'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('ADMIN'),
    (0, common_1.Controller)('admin/partner'),
    __metadata("design:paramtypes", [partner_service_1.PartnerService])
], PartnerAdminController);
//# sourceMappingURL=admin.controller.js.map