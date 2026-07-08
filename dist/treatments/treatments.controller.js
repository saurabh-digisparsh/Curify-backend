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
exports.TreatmentsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const treatments_service_1 = require("./treatments.service");
const classify_treatment_dto_1 = require("./dto/classify-treatment.dto");
let TreatmentsController = class TreatmentsController {
    constructor(svc) {
        this.svc = svc;
    }
    list() {
        return this.svc.list();
    }
    classify(dto) {
        return this.svc.classify(dto.text);
    }
};
exports.TreatmentsController = TreatmentsController;
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'List the active treatment catalog (intake picker)' }),
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], TreatmentsController.prototype, "list", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Classify a free-typed "Other" treatment (AI); auto-adds a new catalog entry when none fits' }),
    (0, throttler_1.Throttle)({ default: { ttl: 60_000, limit: 10 } }),
    (0, common_1.Post)('classify'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [classify_treatment_dto_1.ClassifyTreatmentDto]),
    __metadata("design:returntype", void 0)
], TreatmentsController.prototype, "classify", null);
exports.TreatmentsController = TreatmentsController = __decorate([
    (0, swagger_1.ApiTags)('Treatments'),
    (0, common_1.Controller)('treatments'),
    __metadata("design:paramtypes", [treatments_service_1.TreatmentsService])
], TreatmentsController);
//# sourceMappingURL=treatments.controller.js.map