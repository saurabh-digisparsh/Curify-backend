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
var ReviewLangService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewLangService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const ai_service_1 = require("../ai/ai.service");
const NON_LATIN = /[֐-׿؀-ۿЀ-ӿ一-鿿぀-ヿ가-힯ঀ-৿ऀ-ॿ฀-๿԰-֏ሀ-፿]/;
let ReviewLangService = ReviewLangService_1 = class ReviewLangService {
    constructor(prisma, ai) {
        this.prisma = prisma;
        this.ai = ai;
        this.logger = new common_1.Logger(ReviewLangService_1.name);
    }
    isCandidate(r) {
        if (r.textEn)
            return false;
        if (r.lang && r.lang !== 'en')
            return true;
        return NON_LATIN.test(r.text || '');
    }
    async localizeReview(id) {
        const r = await this.prisma.review.findUnique({ where: { id }, select: { id: true, text: true, lang: true, textEn: true } });
        if (!r || !this.isCandidate(r))
            return 'skip';
        const d = await this.ai.localizeReview(r.text);
        if (!d?.lang)
            throw new Error('no lang');
        if (d.isEnglish) {
            await this.prisma.review.update({ where: { id }, data: { lang: 'en', textEn: null } });
            return 'english';
        }
        const native = d.native && NON_LATIN.test(d.native) ? d.native.slice(0, 5000) : r.text;
        await this.prisma.review.update({
            where: { id },
            data: { lang: d.lang, textEn: (d.english || '').slice(0, 6000), text: native },
        });
        return 'translated';
    }
    async localizeHospital(hospitalId) {
        const rows = await this.prisma.review.findMany({
            where: { hospitalId },
            select: { id: true, text: true, lang: true, textEn: true },
        });
        let translated = 0, english = 0;
        for (const r of rows) {
            if (!this.isCandidate(r))
                continue;
            try {
                const res = await this.localizeReview(r.id);
                if (res === 'translated')
                    translated++;
                else if (res === 'english')
                    english++;
            }
            catch (e) {
                this.logger.warn(`localize failed for review ${r.id}: ${e.message}`);
            }
            await new Promise((res) => setTimeout(res, 120));
        }
        return { translated, english };
    }
    async localizeAll(opts = {}) {
        const rows = await this.prisma.review.findMany({ select: { id: true, text: true, lang: true, textEn: true } });
        const candidates = rows.filter((r) => this.isCandidate(r)).slice(0, opts.limit ?? rows.length);
        this.logger.log(`Localizing ${candidates.length} reviews`);
        let translated = 0, english = 0, failed = 0;
        for (const r of candidates) {
            try {
                const res = await this.localizeReview(r.id);
                if (res === 'translated')
                    translated++;
                else if (res === 'english')
                    english++;
            }
            catch (e) {
                failed++;
                this.logger.warn(`localize failed ${r.id}: ${e.message}`);
            }
            await new Promise((res) => setTimeout(res, 120));
        }
        this.logger.log(`Localize done: translated=${translated} english=${english} failed=${failed}`);
        return { total: candidates.length, translated, english, failed };
    }
};
exports.ReviewLangService = ReviewLangService;
exports.ReviewLangService = ReviewLangService = ReviewLangService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, ai_service_1.AiService])
], ReviewLangService);
//# sourceMappingURL=review-lang.service.js.map