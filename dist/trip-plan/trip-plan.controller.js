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
exports.TripPlanController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const swagger_1 = require("@nestjs/swagger");
const trip_plan_service_1 = require("./trip-plan.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const trip_services_1 = require("./trip-services");
const PROOF_MIMES = ['application/pdf', 'image/jpeg', 'image/png'];
let TripPlanController = class TripPlanController {
    constructor(service) {
        this.service = service;
    }
    getTemplate(procedure, destination) {
        return this.service.getTemplate(procedure ?? '', destination ?? '');
    }
    getFlights(origin, destination) {
        return this.service.getFlights(origin ?? '', destination ?? '');
    }
    getInsurance() {
        return this.service.getInsurance();
    }
    generate(body) {
        return this.service.generate(body);
    }
    listServices(hospitalId, req) {
        if (!hospitalId)
            throw new common_1.BadRequestException('hospitalId is required');
        return this.service.listServices(req.user.id, hospitalId);
    }
    setStatus(type, body, req) {
        if (!(0, trip_services_1.isServiceType)(type))
            throw new common_1.BadRequestException('Unknown service type');
        if (!body?.hospitalId)
            throw new common_1.BadRequestException('hospitalId is required');
        return this.service.setServiceStatus(req.user.id, body.hospitalId, type, body.status);
    }
    uploadProof(type, file, body, req) {
        if (!(0, trip_services_1.isServiceType)(type))
            throw new common_1.BadRequestException('Unknown service type');
        if (!file)
            throw new common_1.BadRequestException('A proof file is required');
        if (!body?.hospitalId)
            throw new common_1.BadRequestException('hospitalId is required');
        return this.service.attachProof(req.user.id, body.hospitalId, type, file, body);
    }
};
exports.TripPlanController = TripPlanController;
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Get trip plan template for procedure + destination' }),
    (0, common_1.Get)('template'),
    __param(0, (0, common_1.Query)('procedure')),
    __param(1, (0, common_1.Query)('destination')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], TripPlanController.prototype, "getTemplate", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Get flight options for a route' }),
    (0, common_1.Get)('flights'),
    __param(0, (0, common_1.Query)('origin')),
    __param(1, (0, common_1.Query)('destination')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], TripPlanController.prototype, "getFlights", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Get all insurance plans' }),
    (0, common_1.Get)('insurance'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], TripPlanController.prototype, "getInsurance", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Generate a personalized medical trip plan' }),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], TripPlanController.prototype, "generate", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: "List the patient's saved trip-service steps for a hospital" }),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('services'),
    __param(0, (0, common_1.Query)('hospitalId')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], TripPlanController.prototype, "listServices", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Mark a trip-service step confirmed / skipped / pending' }),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Patch)('services/:type'),
    __param(0, (0, common_1.Param)('type')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], TripPlanController.prototype, "setStatus", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Upload proof for a step (granted e-Visa, flight ticket) and validate' }),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('services/:type/proof'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.memoryStorage)(),
        limits: { fileSize: 10 * 1024 * 1024 },
        fileFilter: (_, file, cb) => PROOF_MIMES.includes(file.mimetype) ? cb(null, true) : cb(new Error('Use PDF, JPEG or PNG.'), false),
    })),
    __param(0, (0, common_1.Param)('type')),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, Object]),
    __metadata("design:returntype", void 0)
], TripPlanController.prototype, "uploadProof", null);
exports.TripPlanController = TripPlanController = __decorate([
    (0, swagger_1.ApiTags)('Trip Plan'),
    (0, common_1.Controller)('trip-plan'),
    __metadata("design:paramtypes", [trip_plan_service_1.TripPlanService])
], TripPlanController);
//# sourceMappingURL=trip-plan.controller.js.map