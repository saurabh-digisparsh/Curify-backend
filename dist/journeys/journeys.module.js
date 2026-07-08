"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JourneysModule = void 0;
const common_1 = require("@nestjs/common");
const journeys_controller_1 = require("./journeys.controller");
const public_tracking_controller_1 = require("./public-tracking.controller");
const journeys_service_1 = require("./journeys.service");
const admin_hospital_chat_controller_1 = require("./admin-hospital-chat.controller");
const prisma_module_1 = require("../prisma/prisma.module");
const ai_module_1 = require("../ai/ai.module");
let JourneysModule = class JourneysModule {
};
exports.JourneysModule = JourneysModule;
exports.JourneysModule = JourneysModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, ai_module_1.AiModule],
        controllers: [journeys_controller_1.JourneysController, public_tracking_controller_1.PublicTrackingController, admin_hospital_chat_controller_1.AdminHospitalChatController],
        providers: [journeys_service_1.JourneysService],
    })
], JourneysModule);
//# sourceMappingURL=journeys.module.js.map