"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecoveryModule = void 0;
const common_1 = require("@nestjs/common");
const recovery_controller_1 = require("./recovery.controller");
const recovery_service_1 = require("./recovery.service");
const ai_module_1 = require("../ai/ai.module");
const prisma_module_1 = require("../prisma/prisma.module");
let RecoveryModule = class RecoveryModule {
};
exports.RecoveryModule = RecoveryModule;
exports.RecoveryModule = RecoveryModule = __decorate([
    (0, common_1.Module)({
        imports: [ai_module_1.AiModule, prisma_module_1.PrismaModule],
        controllers: [recovery_controller_1.RecoveryController],
        providers: [recovery_service_1.RecoveryService],
    })
], RecoveryModule);
//# sourceMappingURL=recovery.module.js.map