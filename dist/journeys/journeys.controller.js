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
exports.JourneysController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const journeys_service_1 = require("./journeys.service");
let JourneysController = class JourneysController {
    constructor(service) {
        this.service = service;
    }
    list(req, page, pageSize) {
        return this.service.list(req.user.id, page ? { page: parseInt(page, 10), pageSize: pageSize ? parseInt(pageSize, 10) : 10 } : undefined);
    }
    get(req, id) {
        return this.service.get(req.user.id, id);
    }
    create(req, body) {
        return this.service.create(req.user.id, body || {});
    }
    update(req, id, body) {
        return this.service.update(req.user.id, id, body || {});
    }
    remove(req, id) {
        return this.service.remove(req.user.id, id);
    }
};
exports.JourneysController = JourneysController;
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'List my journeys (most recent first). With ?page, returns a paginated envelope.' }),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('pageSize')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], JourneysController.prototype, "list", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Get one of my journeys' }),
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], JourneysController.prototype, "get", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Create a new journey' }),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], JourneysController.prototype, "create", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Update my journey (answers, step, AI snapshots, status)' }),
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], JourneysController.prototype, "update", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Delete one of my journeys' }),
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], JourneysController.prototype, "remove", null);
exports.JourneysController = JourneysController = __decorate([
    (0, swagger_1.ApiTags)('Journeys'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('journeys'),
    __metadata("design:paramtypes", [journeys_service_1.JourneysService])
], JourneysController);
//# sourceMappingURL=journeys.controller.js.map