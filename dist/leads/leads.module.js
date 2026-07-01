"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadsModule = void 0;
const common_1 = require("@nestjs/common");
const auth_module_1 = require("../auth/auth.module");
const ai_module_1 = require("../ai/ai.module");
const leads_controller_1 = require("./leads.controller");
const leads_service_1 = require("./leads.service");
const youtube_service_1 = require("./youtube.service");
const brightdata_service_1 = require("./brightdata.service");
const leads_scheduler_1 = require("./leads.scheduler");
let LeadsModule = class LeadsModule {
};
exports.LeadsModule = LeadsModule;
exports.LeadsModule = LeadsModule = __decorate([
    (0, common_1.Module)({
        imports: [auth_module_1.AuthModule, ai_module_1.AiModule],
        controllers: [leads_controller_1.LeadsController],
        providers: [leads_service_1.LeadsService, youtube_service_1.YouTubeService, brightdata_service_1.BrightDataService, leads_scheduler_1.LeadsScheduler],
    })
], LeadsModule);
//# sourceMappingURL=leads.module.js.map