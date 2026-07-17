"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HospitalPartnerModule = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const prisma_module_1 = require("../prisma/prisma.module");
const auth_module_1 = require("../auth/auth.module");
const admin_module_1 = require("../admin/admin.module");
const partner_service_1 = require("./partner.service");
const bulk_import_service_1 = require("./bulk-import.service");
const notification_service_1 = require("./notification.service");
const accreditation_service_1 = require("./accreditation.service");
const video_service_1 = require("./video.service");
const teleconsult_service_1 = require("./teleconsult.service");
const application_controller_1 = require("./application.controller");
const dashboard_controller_1 = require("./dashboard.controller");
const availability_controller_1 = require("./availability.controller");
const teleconsult_controller_1 = require("./teleconsult.controller");
const admin_controller_1 = require("./admin.controller");
let HospitalPartnerModule = class HospitalPartnerModule {
};
exports.HospitalPartnerModule = HospitalPartnerModule;
exports.HospitalPartnerModule = HospitalPartnerModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, auth_module_1.AuthModule, admin_module_1.AdminModule, jwt_1.JwtModule.register({})],
        controllers: [dashboard_controller_1.DashboardController, application_controller_1.ApplicationController, availability_controller_1.AvailabilityController, teleconsult_controller_1.TeleconsultController, admin_controller_1.PartnerAdminController],
        providers: [partner_service_1.PartnerService, bulk_import_service_1.BulkImportService, notification_service_1.NotificationService, accreditation_service_1.AccreditationService, video_service_1.VideoService, teleconsult_service_1.TeleconsultService],
    })
], HospitalPartnerModule);
//# sourceMappingURL=hospital-partner.module.js.map