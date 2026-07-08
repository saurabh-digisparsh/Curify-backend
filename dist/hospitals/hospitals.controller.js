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
exports.HospitalsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const hospitals_service_1 = require("./hospitals.service");
const DATA_THROTTLE = { default: { ttl: 60_000, limit: 30 } };
let HospitalsController = class HospitalsController {
    constructor(hospitalsService) {
        this.hospitalsService = hospitalsService;
    }
    getStats() {
        return this.hospitalsService.getStats();
    }
    getMeta() {
        return this.hospitalsService.getMeta();
    }
    getDispatch(page, pageSize, search, city) {
        return this.hospitalsService.getDispatch(page ? parseInt(page, 10) : 1, pageSize ? parseInt(pageSize, 10) : 20, search, city);
    }
    getComparison(page, pageSize, city, sort, treatment, urgency, search) {
        return this.hospitalsService.getComparison({
            page: page ? parseInt(page, 10) : 1,
            pageSize: pageSize ? parseInt(pageSize, 10) : 20,
            city, sort, treatment, urgency, search,
        });
    }
    findAll() {
        return this.hospitalsService.findAll();
    }
    findOne(id) {
        return this.hospitalsService.findOne(id);
    }
    getReviews(id, page, pageSize) {
        return this.hospitalsService.getReviews(id, page ? parseInt(page, 10) : 1, pageSize ? parseInt(pageSize, 10) : 200);
    }
    match(body) {
        return this.hospitalsService.matchForPatient(body);
    }
};
exports.HospitalsController = HospitalsController;
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Platform statistics (hospital count, reviews, patients)' }),
    (0, common_1.Get)('stats'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], HospitalsController.prototype, "getStats", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Hospital metadata: available specialties and cities' }),
    (0, common_1.Get)('meta'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], HospitalsController.prototype, "getMeta", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Dispatch view: paginated hospitals with review aggregates' }),
    (0, throttler_1.Throttle)(DATA_THROTTLE),
    (0, common_1.Get)('dispatch'),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('pageSize')),
    __param(2, (0, common_1.Query)('search')),
    __param(3, (0, common_1.Query)('city')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", void 0)
], HospitalsController.prototype, "getDispatch", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Paginated comparison feed (city filter, sort, journey ranking)' }),
    (0, throttler_1.Throttle)(DATA_THROTTLE),
    (0, common_1.Get)('comparison'),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('pageSize')),
    __param(2, (0, common_1.Query)('city')),
    __param(3, (0, common_1.Query)('sort')),
    __param(4, (0, common_1.Query)('treatment')),
    __param(5, (0, common_1.Query)('urgency')),
    __param(6, (0, common_1.Query)('search')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], HospitalsController.prototype, "getComparison", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'List all hospitals and surgeons' }),
    (0, throttler_1.Throttle)(DATA_THROTTLE),
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], HospitalsController.prototype, "findAll", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Get hospital details by ID' }),
    (0, throttler_1.Throttle)(DATA_THROTTLE),
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], HospitalsController.prototype, "findOne", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Get reviews for a hospital (paginated)' }),
    (0, throttler_1.Throttle)(DATA_THROTTLE),
    (0, common_1.Get)(':id/reviews'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('pageSize')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], HospitalsController.prototype, "getReviews", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Rule-based hospital matching for a patient' }),
    (0, common_1.Post)('match'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], HospitalsController.prototype, "match", null);
exports.HospitalsController = HospitalsController = __decorate([
    (0, swagger_1.ApiTags)('Hospitals'),
    (0, common_1.Controller)('hospitals'),
    __metadata("design:paramtypes", [hospitals_service_1.HospitalsService])
], HospitalsController);
//# sourceMappingURL=hospitals.controller.js.map