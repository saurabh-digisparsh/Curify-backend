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
exports.AssistantController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const ai_service_1 = require("../ai/ai.service");
const CHAT_THROTTLE = { default: { ttl: 60_000, limit: 10 } };
const TRANSLATE_THROTTLE = { default: { ttl: 300_000, limit: 30 } };
let AssistantController = class AssistantController {
    constructor(ai) {
        this.ai = ai;
    }
    chat(body) {
        return this.ai.assistantChat({
            messages: Array.isArray(body?.messages) ? body.messages : [],
            language: typeof body?.language === 'string' ? body.language.slice(0, 10) : undefined,
        });
    }
    analyze(body) {
        const description = String(body?.description || '').trim().slice(0, 4000);
        if (description.length < 10)
            throw new common_1.BadRequestException('description too short');
        return this.ai.analyzeReport({
            description,
            treatment: typeof body?.treatment === 'string' ? body.treatment.slice(0, 100) : undefined,
            country: typeof body?.country === 'string' ? body.country.slice(0, 100) : undefined,
            urgency: typeof body?.urgency === 'string' ? body.urgency.slice(0, 50) : undefined,
        });
    }
    translateUi(body) {
        const language = String(body?.language || '').toLowerCase();
        if (!/^[a-z]{2,3}$/.test(language))
            throw new common_1.BadRequestException('Invalid language code');
        if (!body?.strings || typeof body.strings !== 'object' || Array.isArray(body.strings)) {
            throw new common_1.BadRequestException('strings must be an object');
        }
        if (JSON.stringify(body.strings).length > 20_000)
            throw new common_1.BadRequestException('Catalog too large');
        return this.ai.translateUi({ language, strings: body.strings });
    }
};
exports.AssistantController = AssistantController;
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Patient AI assistant chat (pre-signup, stateless — nothing persisted)' }),
    (0, throttler_1.Throttle)(CHAT_THROTTLE),
    (0, common_1.Post)('chat'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AssistantController.prototype, "chat", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Transient description-only analysis for the chat patient flow (no file, nothing persisted)' }),
    (0, throttler_1.Throttle)(CHAT_THROTTLE),
    (0, common_1.Post)('analyze'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AssistantController.prototype, "analyze", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'AI-translate the UI string catalog into a target language (cached client-side)' }),
    (0, throttler_1.Throttle)(TRANSLATE_THROTTLE),
    (0, common_1.Post)('translate-ui'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AssistantController.prototype, "translateUi", null);
exports.AssistantController = AssistantController = __decorate([
    (0, swagger_1.ApiTags)('Assistant'),
    (0, common_1.Controller)('assistant'),
    __metadata("design:paramtypes", [ai_service_1.AiService])
], AssistantController);
//# sourceMappingURL=assistant.controller.js.map