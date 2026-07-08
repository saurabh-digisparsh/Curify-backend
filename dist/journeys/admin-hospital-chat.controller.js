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
exports.AdminHospitalChatController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const journeys_service_1 = require("./journeys.service");
let AdminHospitalChatController = class AdminHospitalChatController {
    constructor(service) {
        this.service = service;
    }
    list() {
        return this.service.listChats();
    }
    one(journeyId) {
        return this.service.getChatForStaff(journeyId);
    }
    reply(journeyId, body) {
        return this.service.addHospitalMessage(journeyId, body || {});
    }
};
exports.AdminHospitalChatController = AdminHospitalChatController;
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'List every journey chat (newest first)' }),
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminHospitalChatController.prototype, "list", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Read one chat transcript' }),
    (0, common_1.Get)(':journeyId'),
    __param(0, (0, common_1.Param)('journeyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminHospitalChatController.prototype, "one", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Reply as the hospital (optionally post a quote)' }),
    (0, common_1.Post)(':journeyId/reply'),
    __param(0, (0, common_1.Param)('journeyId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AdminHospitalChatController.prototype, "reply", null);
exports.AdminHospitalChatController = AdminHospitalChatController = __decorate([
    (0, swagger_1.ApiTags)('Admin · Hospital Chats'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('ADMIN'),
    (0, common_1.Controller)('admin/hospital-chats'),
    __metadata("design:paramtypes", [journeys_service_1.JourneysService])
], AdminHospitalChatController);
//# sourceMappingURL=admin-hospital-chat.controller.js.map