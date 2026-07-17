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
exports.VideoService = void 0;
exports.isVideoConfigured = isVideoConfigured;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const settings_service_1 = require("../admin/settings/settings.service");
const PLACEHOLDER = /^(changeme|change[_-]?me|your[_-]?(app[_-]?)?secret|your[_-]?secret[_-]?here|replace[_-]?me|secret|todo|none|xxx+)$/i;
async function isVideoConfigured(settings) {
    const [domain, appId, appSecret] = await Promise.all([
        settings.get('JITSI_DOMAIN'),
        settings.get('JITSI_APP_ID'),
        settings.get('JITSI_APP_SECRET'),
    ]);
    const ok = (v) => !!v && v.trim().length > 0 && !PLACEHOLDER.test(v.trim());
    return ok(domain) && ok(appId) && ok(appSecret);
}
let VideoService = class VideoService {
    constructor(jwt, settings) {
        this.jwt = jwt;
        this.settings = settings;
    }
    enabled() {
        return isVideoConfigured(this.settings);
    }
    async mintJitsi(roomName, user, isModerator) {
        if (!(await this.enabled())) {
            throw new common_1.ServiceUnavailableException('Video consultations are not configured yet.');
        }
        const [domain, appId, appSecret] = await Promise.all([
            this.settings.get('JITSI_DOMAIN'),
            this.settings.get('JITSI_APP_ID'),
            this.settings.get('JITSI_APP_SECRET'),
        ]);
        const displayName = user.name || (isModerator ? 'Doctor' : 'Patient');
        const jwt = await this.jwt.signAsync({
            aud: 'jitsi',
            iss: appId,
            sub: '*',
            room: roomName,
            context: { user: { id: user.id, name: displayName, moderator: isModerator } },
        }, { secret: appSecret, algorithm: 'HS256', expiresIn: '2h' });
        return { provider: 'jitsi', domain, roomName, jwt, displayName };
    }
};
exports.VideoService = VideoService;
exports.VideoService = VideoService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jwt_1.JwtService, settings_service_1.SettingsService])
], VideoService);
//# sourceMappingURL=video.service.js.map