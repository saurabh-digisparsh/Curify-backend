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
exports.SentinelController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const sentinel_service_1 = require("./sentinel.service");
let SentinelController = class SentinelController {
    constructor(sentinel) {
        this.sentinel = sentinel;
    }
    overview() {
        return this.sentinel.overview();
    }
    block(body, req) {
        const by = req.user?.email || req.user?.id;
        return this.sentinel.block(body.ip, body.reason, by);
    }
    unblock(body) {
        return this.sentinel.unblock(body.ip);
    }
};
exports.SentinelController = SentinelController;
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Suspicious-activity watch list + summary' }),
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SentinelController.prototype, "overview", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Block an IP address' }),
    (0, common_1.Post)('block'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], SentinelController.prototype, "block", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Unblock an IP address' }),
    (0, common_1.Post)('unblock'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SentinelController.prototype, "unblock", null);
exports.SentinelController = SentinelController = __decorate([
    (0, swagger_1.ApiTags)('Admin · Sentinel'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('ADMIN'),
    (0, common_1.Controller)('admin/sentinel'),
    __metadata("design:paramtypes", [sentinel_service_1.SentinelService])
], SentinelController);
//# sourceMappingURL=sentinel.controller.js.map