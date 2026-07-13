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
exports.InquiriesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let InquiriesService = class InquiriesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async upsert(dto) {
        const email = dto.email.toLowerCase();
        const { email: _e, travelDate, ...rest } = dto;
        const data = this.definedOnly(rest);
        if (travelDate) {
            const d = new Date(travelDate);
            if (!Number.isNaN(d.getTime()))
                data.travelDate = d;
        }
        const inq = await this.prisma.inquiry.upsert({
            where: { email },
            update: data,
            create: { email, ...data },
            select: { id: true },
        });
        return { ok: true, id: inq.id };
    }
    async markConverted(email, userId) {
        await this.prisma.inquiry.updateMany({
            where: { email: email.toLowerCase(), status: 'NEW' },
            data: { status: 'CONVERTED', userId, convertedAt: new Date() },
        });
    }
    definedOnly(obj) {
        const out = {};
        for (const [k, v] of Object.entries(obj))
            if (v !== undefined && v !== '')
                out[k] = v;
        return out;
    }
};
exports.InquiriesService = InquiriesService;
exports.InquiriesService = InquiriesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], InquiriesService);
//# sourceMappingURL=inquiries.service.js.map