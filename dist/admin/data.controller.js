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
exports.AdminDataController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const data_service_1 = require("./data.service");
let AdminDataController = class AdminDataController {
    constructor(data) {
        this.data = data;
    }
    resources() {
        return this.data.resources();
    }
    list(resource, q, skip, take) {
        return this.data.list(resource, {
            q,
            skip: skip ? parseInt(skip, 10) : undefined,
            take: take ? parseInt(take, 10) : undefined,
        });
    }
    getOne(resource, id) {
        return this.data.getOne(resource, id);
    }
    create(resource, body) {
        return this.data.create(resource, body);
    }
    update(resource, id, body) {
        return this.data.update(resource, id, body);
    }
    remove(resource, id) {
        return this.data.remove(resource, id);
    }
};
exports.AdminDataController = AdminDataController;
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'List editable resource types (Data Manager tabs)' }),
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminDataController.prototype, "resources", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'List rows of a resource (search + pagination)' }),
    (0, common_1.Get)(':resource'),
    __param(0, (0, common_1.Param)('resource')),
    __param(1, (0, common_1.Query)('q')),
    __param(2, (0, common_1.Query)('skip')),
    __param(3, (0, common_1.Query)('take')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", void 0)
], AdminDataController.prototype, "list", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Get one row' }),
    (0, common_1.Get)(':resource/:id'),
    __param(0, (0, common_1.Param)('resource')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AdminDataController.prototype, "getOne", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Create a row' }),
    (0, common_1.Post)(':resource'),
    __param(0, (0, common_1.Param)('resource')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AdminDataController.prototype, "create", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Update a row' }),
    (0, common_1.Patch)(':resource/:id'),
    __param(0, (0, common_1.Param)('resource')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], AdminDataController.prototype, "update", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Delete a row' }),
    (0, common_1.Delete)(':resource/:id'),
    __param(0, (0, common_1.Param)('resource')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AdminDataController.prototype, "remove", null);
exports.AdminDataController = AdminDataController = __decorate([
    (0, swagger_1.ApiTags)('Admin · Data'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('ADMIN'),
    (0, common_1.Controller)('admin/data'),
    __metadata("design:paramtypes", [data_service_1.DataService])
], AdminDataController);
//# sourceMappingURL=data.controller.js.map