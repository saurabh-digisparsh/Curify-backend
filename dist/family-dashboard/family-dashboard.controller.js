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
exports.FamilyDashboardController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const family_dashboard_service_1 = require("./family-dashboard.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
let FamilyDashboardController = class FamilyDashboardController {
    constructor(service) {
        this.service = service;
    }
    getFamilyStatus(bookingId, req) {
        return this.service.getFamilyStatus(bookingId, req.user.id, req.user.role === 'ADMIN');
    }
    getUpdates(body) {
        return this.service.getUpdates({
            procedure: body.procedure || 'Surgery',
            hospital: body.hospital || 'Hospital',
            surgeon: body.surgeon || 'Doctor',
            stage: body.stage || 'in-surgery',
        });
    }
};
exports.FamilyDashboardController = FamilyDashboardController;
__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Get DB-driven family status for a booking (owner or admin only)' }),
    (0, common_1.Get)('booking/:bookingId'),
    __param(0, (0, common_1.Param)('bookingId')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], FamilyDashboardController.prototype, "getFamilyStatus", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Legacy: get surgical status updates (demo state)' }),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], FamilyDashboardController.prototype, "getUpdates", null);
exports.FamilyDashboardController = FamilyDashboardController = __decorate([
    (0, swagger_1.ApiTags)('Family Dashboard'),
    (0, common_1.Controller)('family-updates'),
    __metadata("design:paramtypes", [family_dashboard_service_1.FamilyDashboardService])
], FamilyDashboardController);
//# sourceMappingURL=family-dashboard.controller.js.map