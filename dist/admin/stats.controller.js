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
exports.AdminStatsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const stats_service_1 = require("./stats.service");
let AdminStatsController = class AdminStatsController {
    constructor(stats) {
        this.stats = stats;
    }
    overview() {
        return this.stats.overview();
    }
    inserts(granularity) {
        return this.stats.insertsSeries(granularity || 'monthly');
    }
};
exports.AdminStatsController = AdminStatsController;
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Dashboard analytics + logistics overview' }),
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminStatsController.prototype, "overview", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Records inserted per time bucket (daily|monthly|quarterly|yearly)' }),
    (0, common_1.Get)('inserts'),
    __param(0, (0, common_1.Query)('granularity')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminStatsController.prototype, "inserts", null);
exports.AdminStatsController = AdminStatsController = __decorate([
    (0, swagger_1.ApiTags)('Admin · Dashboard'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('ADMIN'),
    (0, common_1.Controller)('admin/stats'),
    __metadata("design:paramtypes", [stats_service_1.StatsService])
], AdminStatsController);
//# sourceMappingURL=stats.controller.js.map