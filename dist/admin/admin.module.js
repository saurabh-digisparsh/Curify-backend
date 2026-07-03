"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminModule = void 0;
const common_1 = require("@nestjs/common");
const auth_module_1 = require("../auth/auth.module");
const ai_module_1 = require("../ai/ai.module");
const users_controller_1 = require("./users.controller");
const users_service_1 = require("./users.service");
const stats_controller_1 = require("./stats.controller");
const stats_service_1 = require("./stats.service");
const data_controller_1 = require("./data.controller");
const data_service_1 = require("./data.service");
const scrape_controller_1 = require("./scrape.controller");
const scrape_service_1 = require("./scrape.service");
const scrape_scheduler_1 = require("./scrape.scheduler");
const enrichment_service_1 = require("./enrichment.service");
const review_lang_service_1 = require("./review-lang.service");
const file_import_service_1 = require("./file-import.service");
const sentinel_controller_1 = require("./sentinel.controller");
const sentinel_service_1 = require("./sentinel.service");
const settings_controller_1 = require("./settings/settings.controller");
const settings_service_1 = require("./settings/settings.service");
let AdminModule = class AdminModule {
};
exports.AdminModule = AdminModule;
exports.AdminModule = AdminModule = __decorate([
    (0, common_1.Module)({
        imports: [auth_module_1.AuthModule, ai_module_1.AiModule],
        controllers: [
            users_controller_1.AdminUsersController,
            stats_controller_1.AdminStatsController,
            data_controller_1.AdminDataController,
            scrape_controller_1.AdminScrapeController,
            sentinel_controller_1.SentinelController,
            settings_controller_1.AdminSettingsController,
        ],
        providers: [users_service_1.UsersService, stats_service_1.StatsService, data_service_1.DataService, scrape_service_1.ScrapeService, scrape_scheduler_1.ScrapeScheduler, enrichment_service_1.EnrichmentService, review_lang_service_1.ReviewLangService, file_import_service_1.FileImportService, sentinel_service_1.SentinelService, settings_service_1.SettingsService],
        exports: [sentinel_service_1.SentinelService, settings_service_1.SettingsService],
    })
], AdminModule);
//# sourceMappingURL=admin.module.js.map