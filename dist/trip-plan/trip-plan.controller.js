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
const swagger_1 = require("@nestjs/swagger");
const trip_plan_service_1 = require("./trip-plan.service");
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
exports.TripPlanController = TripPlanController = __decorate([
    (0, swagger_1.ApiTags)('Trip Plan'),
    (0, common_1.Controller)('trip-plan'),
    __metadata("design:paramtypes", [trip_plan_service_1.TripPlanService])
], TripPlanController);
//# sourceMappingURL=trip-plan.controller.js.map