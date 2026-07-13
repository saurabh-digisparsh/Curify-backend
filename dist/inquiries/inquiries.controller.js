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
exports.InquiriesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const inquiries_service_1 = require("./inquiries.service");
const upsert_inquiry_dto_1 = require("./dto/upsert-inquiry.dto");
let InquiriesController = class InquiriesController {
    constructor(svc) {
        this.svc = svc;
    }
    upsert(dto) {
        return this.svc.upsert(dto);
    }
};
exports.InquiriesController = InquiriesController;
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Capture/update an anonymous chat lead (pre-signup; identity + funnel only)' }),
    (0, throttler_1.Throttle)({ default: { ttl: 60_000, limit: 20 } }),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [upsert_inquiry_dto_1.UpsertInquiryDto]),
    __metadata("design:returntype", void 0)
], InquiriesController.prototype, "upsert", null);
exports.InquiriesController = InquiriesController = __decorate([
    (0, swagger_1.ApiTags)('Inquiries'),
    (0, common_1.Controller)('inquiries'),
    __metadata("design:paramtypes", [inquiries_service_1.InquiriesService])
], InquiriesController);
//# sourceMappingURL=inquiries.controller.js.map