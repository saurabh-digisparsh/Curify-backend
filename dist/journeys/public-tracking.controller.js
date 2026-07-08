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
exports.PublicTrackingController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const journeys_service_1 = require("./journeys.service");
let PublicTrackingController = class PublicTrackingController {
    constructor(service) {
        this.service = service;
    }
    track(id) {
        return this.service.publicTracking(id);
    }
};
exports.PublicTrackingController = PublicTrackingController;
__decorate([
    (0, throttler_1.Throttle)({ default: { ttl: 60_000, limit: 30 } }),
    (0, swagger_1.ApiOperation)({ summary: 'Public treatment-journey tracking by shared id (no auth)' }),
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PublicTrackingController.prototype, "track", null);
exports.PublicTrackingController = PublicTrackingController = __decorate([
    (0, swagger_1.ApiTags)('Public'),
    (0, common_1.Controller)('track'),
    __metadata("design:paramtypes", [journeys_service_1.JourneysService])
], PublicTrackingController);
//# sourceMappingURL=public-tracking.controller.js.map