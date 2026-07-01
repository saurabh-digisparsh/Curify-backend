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
exports.SentinelThrottlerGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const throttler_1 = require("@nestjs/throttler");
const sentinel_service_1 = require("../sentinel.service");
const sentinel_util_1 = require("../sentinel.util");
let SentinelThrottlerGuard = class SentinelThrottlerGuard extends throttler_1.ThrottlerGuard {
    constructor(options, storageService, reflector, sentinel) {
        super(options, storageService, reflector);
        this.sentinel = sentinel;
    }
    async throwThrottlingException(context, detail) {
        const req = context.switchToHttp().getRequest();
        const ip = (0, sentinel_util_1.clientIp)(req);
        if (ip) {
            void this.sentinel.record('RATE_LIMIT', {
                ip,
                path: req.originalUrl,
                method: req.method,
                userAgent: req.headers['user-agent'],
            });
        }
        return super.throwThrottlingException(context, detail);
    }
};
exports.SentinelThrottlerGuard = SentinelThrottlerGuard;
exports.SentinelThrottlerGuard = SentinelThrottlerGuard = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, throttler_1.InjectThrottlerOptions)()),
    __param(1, (0, throttler_1.InjectThrottlerStorage)()),
    __metadata("design:paramtypes", [Object, Object, core_1.Reflector,
        sentinel_service_1.SentinelService])
], SentinelThrottlerGuard);
//# sourceMappingURL=sentinel-throttler.guard.js.map