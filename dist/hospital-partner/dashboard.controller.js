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
exports.DashboardController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const fs_1 = require("fs");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const partner_service_1 = require("./partner.service");
const teleconsult_service_1 = require("./teleconsult.service");
const partner_dto_1 = require("./dto/partner.dto");
let DashboardController = class DashboardController {
    constructor(svc, tele) {
        this.svc = svc;
        this.tele = tele;
    }
    dashboard(req) { return this.svc.dashboard(req.user.id); }
    setPassword(dto, req) { return this.svc.setPassword(req.user.id, dto.password); }
    addDoctor(dto, req) { return this.svc.addDoctor(req.user.id, dto); }
    updateDoctor(id, dto, req) { return this.svc.updateDoctor(req.user.id, id, dto); }
    leave(id, dto, req) { return this.svc.setDoctorLeave(req.user.id, id, dto.onLeave); }
    removeDoctor(id, req) { return this.svc.removeDoctor(req.user.id, id); }
    link(id, req) { return this.svc.sendAvailabilityLink(req.user.id, id); }
    pricing(dto, req) { return this.svc.setPricing(req.user.id, dto); }
    services(dto, req) { return this.svc.setServices(req.user.id, dto); }
    generateNarrative(req) { return this.svc.generateNarrative(req.user.id); }
    reviews(req, rating, region, verified) {
        return this.svc.dashboardReviews(req.user.id, {
            rating: rating ? Number(rating) : undefined,
            region: region || undefined,
            verified: verified === 'true' ? true : verified === 'false' ? false : undefined,
        });
    }
    goLive(req) { return this.svc.goLive(req.user.id); }
    teleconsults(req) { return this.tele.hospitalConsults(req.user.id); }
    async teleDocFile(docId, req, res) {
        const { path, name } = await this.tele.docFileForHospital(docId, req.user.id);
        res.set({ 'Content-Disposition': `inline; filename="${encodeURIComponent(name)}"` });
        return new common_1.StreamableFile((0, fs_1.createReadStream)(path));
    }
    async docFile(docId, req, res) {
        const { path, name } = await this.svc.docFile(docId, req.user.id, req.user.role === 'ADMIN');
        res.set({ 'Content-Disposition': `inline; filename="${encodeURIComponent(name)}"` });
        return new common_1.StreamableFile((0, fs_1.createReadStream)(path));
    }
};
exports.DashboardController = DashboardController;
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Dashboard payload + setup checklist' }),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "dashboard", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Set your own password (first sign-in)' }),
    (0, common_1.Post)('set-password'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [partner_dto_1.SetPasswordDto, Object]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "setPassword", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Add a doctor' }),
    (0, common_1.Post)('doctors'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [partner_dto_1.DoctorDto, Object]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "addDoctor", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Update a doctor' }),
    (0, common_1.Put)('doctors/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, partner_dto_1.DoctorDto, Object]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "updateDoctor", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Set a doctor on leave / active' }),
    (0, common_1.Post)('doctors/:id/leave'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, partner_dto_1.DoctorLeaveDto, Object]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "leave", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Remove a doctor' }),
    (0, common_1.Delete)('doctors/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "removeDoctor", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: "Send/resend a doctor's private availability link" }),
    (0, common_1.Post)('doctors/:id/availability-link'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "link", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Set pricing & capacity' }),
    (0, common_1.Put)('pricing'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [partner_dto_1.PricingDto, Object]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "pricing", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Set patient services (languages, insurers, facilities)' }),
    (0, common_1.Put)('services'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [partner_dto_1.ServicesDto, Object]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "services", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'AI-generate the package narrative (pros/cons + included) for editing' }),
    (0, common_1.Post)('narrative/generate'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "generateNarrative", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: "This hospital's patient reviews (filterable)" }),
    (0, common_1.Get)('reviews'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('rating')),
    __param(2, (0, common_1.Query)('region')),
    __param(3, (0, common_1.Query)('verified')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "reviews", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Go live — publish into patient matching' }),
    (0, common_1.Post)('go-live'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "goLive", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Teleconsultation monitoring — all consults + stats' }),
    (0, common_1.Get)('teleconsults'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "teleconsults", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Stream a shared teleconsult document (owner)' }),
    (0, common_1.Get)('teleconsults/documents/:docId/file'),
    __param(0, (0, common_1.Param)('docId')),
    __param(1, (0, common_1.Request)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], DashboardController.prototype, "teleDocFile", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Stream a verification document (owner or admin)' }),
    (0, roles_decorator_1.Roles)('HOSPITAL', 'ADMIN'),
    (0, common_1.Get)('documents/:docId/file'),
    __param(0, (0, common_1.Param)('docId')),
    __param(1, (0, common_1.Request)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], DashboardController.prototype, "docFile", null);
exports.DashboardController = DashboardController = __decorate([
    (0, swagger_1.ApiTags)('Partner · Dashboard'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('HOSPITAL'),
    (0, common_1.Controller)('partner/dashboard'),
    __metadata("design:paramtypes", [partner_service_1.PartnerService, teleconsult_service_1.TeleconsultService])
], DashboardController);
//# sourceMappingURL=dashboard.controller.js.map