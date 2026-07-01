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
Object.defineProperty(exports, "__esModule", { value: true });
exports.IpBlockGuard = void 0;
const common_1 = require("@nestjs/common");
const sentinel_service_1 = require("../sentinel.service");
const sentinel_util_1 = require("../sentinel.util");
let IpBlockGuard = class IpBlockGuard {
    constructor(sentinel) {
        this.sentinel = sentinel;
    }
    canActivate(context) {
        const req = context.switchToHttp().getRequest();
        const path = req.originalUrl || req.url || '';
        if (path.startsWith('/api/admin') || path.startsWith('/api/auth'))
            return true;
        const ip = (0, sentinel_util_1.clientIp)(req);
        if (ip && this.sentinel.isBlocked(ip)) {
            void this.sentinel.record('BLOCKED', {
                ip,
                path: req.originalUrl,
                method: req.method,
                userAgent: req.headers['user-agent'],
            });
            throw new common_1.ForbiddenException('Access denied');
        }
        return true;
    }
};
exports.IpBlockGuard = IpBlockGuard;
exports.IpBlockGuard = IpBlockGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [sentinel_service_1.SentinelService])
], IpBlockGuard);
//# sourceMappingURL=ip-block.guard.js.map