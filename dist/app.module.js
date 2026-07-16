"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const schedule_1 = require("@nestjs/schedule");
const core_1 = require("@nestjs/core");
const throttler_1 = require("@nestjs/throttler");
const ip_block_guard_1 = require("./admin/guards/ip-block.guard");
const sentinel_throttler_guard_1 = require("./admin/guards/sentinel-throttler.guard");
const prisma_module_1 = require("./prisma/prisma.module");
const auth_module_1 = require("./auth/auth.module");
const users_module_1 = require("./users/users.module");
const ai_module_1 = require("./ai/ai.module");
const upload_module_1 = require("./upload/upload.module");
const hospitals_module_1 = require("./hospitals/hospitals.module");
const stay_or_go_module_1 = require("./stay-or-go/stay-or-go.module");
const trip_plan_module_1 = require("./trip-plan/trip-plan.module");
const recovery_module_1 = require("./recovery/recovery.module");
const family_dashboard_module_1 = require("./family-dashboard/family-dashboard.module");
const bookings_module_1 = require("./bookings/bookings.module");
const payments_module_1 = require("./payments/payments.module");
const admin_module_1 = require("./admin/admin.module");
const leads_module_1 = require("./leads/leads.module");
const assistant_module_1 = require("./assistant/assistant.module");
const journeys_module_1 = require("./journeys/journeys.module");
const treatments_module_1 = require("./treatments/treatments.module");
const inquiries_module_1 = require("./inquiries/inquiries.module");
const hospital_partner_module_1 = require("./hospital-partner/hospital-partner.module");
const masters_module_1 = require("./masters/masters.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            schedule_1.ScheduleModule.forRoot(),
            throttler_1.ThrottlerModule.forRoot([
                { name: 'default', ttl: 60_000, limit: 120 },
            ]),
            prisma_module_1.PrismaModule,
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            admin_module_1.AdminModule,
            ai_module_1.AiModule,
            upload_module_1.UploadModule,
            hospitals_module_1.HospitalsModule,
            stay_or_go_module_1.StayOrGoModule,
            trip_plan_module_1.TripPlanModule,
            recovery_module_1.RecoveryModule,
            family_dashboard_module_1.FamilyDashboardModule,
            bookings_module_1.BookingsModule,
            payments_module_1.PaymentsModule,
            leads_module_1.LeadsModule,
            assistant_module_1.AssistantModule,
            journeys_module_1.JourneysModule,
            treatments_module_1.TreatmentsModule,
            inquiries_module_1.InquiriesModule,
            hospital_partner_module_1.HospitalPartnerModule,
            masters_module_1.MastersModule,
        ],
        providers: [
            { provide: core_1.APP_GUARD, useClass: ip_block_guard_1.IpBlockGuard },
            { provide: core_1.APP_GUARD, useClass: sentinel_throttler_guard_1.SentinelThrottlerGuard },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map