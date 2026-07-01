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
exports.FileImportService = exports.TEMPLATE_FIELDS = void 0;
const common_1 = require("@nestjs/common");
const sync_1 = require("csv-parse/sync");
const prisma_service_1 = require("../prisma/prisma.service");
const enrichment_service_1 = require("./enrichment.service");
exports.TEMPLATE_FIELDS = ['name', 'city', 'country', 'address', 'website', 'phone', 'specialty'];
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);
const norm = (s) => (s || '').toLowerCase().replace(/\b(hospital|hospitals|clinic|centre|center|pvt|ltd|the)\b/g, '').replace(/[^a-z0-9]/g, '').trim();
const cityKey = (s) => (s || '').toLowerCase().replace(/bengaluru/, 'bangalore').replace(/[^a-z]/g, '').trim();
let FileImportService = class FileImportService {
    constructor(prisma, enrichment) {
        this.prisma = prisma;
        this.enrichment = enrichment;
    }
    parse(file) {
        const text = (file?.buffer ?? Buffer.from('')).toString('utf8').trim();
        if (!text)
            throw new common_1.BadRequestException('Empty file');
        const isJson = file.originalname?.toLowerCase().endsWith('.json') || (file.mimetype || '').includes('json') || text.startsWith('[') || text.startsWith('{');
        try {
            if (isJson) {
                const j = JSON.parse(text);
                const arr = Array.isArray(j) ? j : (j.hospitals ?? j.data ?? []);
                if (!Array.isArray(arr))
                    throw new Error('JSON must be an array of hospitals');
                return arr;
            }
            return (0, sync_1.parse)(text, { columns: true, skip_empty_lines: true, trim: true, bom: true });
        }
        catch (e) {
            throw new common_1.BadRequestException(`Could not parse file: ${e.message}`);
        }
    }
    validate(rows) {
        const out = rows.map((r) => {
            const name = String(r.name ?? '').trim();
            const city = String(r.city ?? '').trim();
            const ok = !!name && !!city;
            return {
                name, city,
                country: r.country ? String(r.country).trim() : undefined,
                address: r.address ? String(r.address).trim() : undefined,
                website: r.website ? String(r.website).trim() : undefined,
                phone: r.phone ? String(r.phone).trim() : undefined,
                specialty: r.specialty ? String(r.specialty).trim() : undefined,
                valid: ok,
                reason: ok ? '' : 'Missing required field (name and city)',
            };
        });
        return { rows: out, valid: out.filter((r) => r.valid).length, invalid: out.filter((r) => !r.valid).length };
    }
    async commit(rows) {
        const existing = await this.prisma.hospital.findMany({ select: { id: true, name: true, city: true } });
        let created = 0, updated = 0, skipped = 0;
        const dropped = [];
        for (const r of rows) {
            const name = String(r.name ?? '').trim();
            const city = String(r.city ?? '').trim();
            if (!name || !city) {
                dropped.push({ name, city, reason: 'Missing name/city' });
                skipped++;
                continue;
            }
            const data = {
                name, city,
                country: r.country || 'India',
                address: r.address || undefined,
                website: r.website || undefined,
                intlOfficePhone: r.phone || undefined,
                specialty: r.specialty || undefined,
            };
            const match = existing.find((h) => norm(h.name) === norm(name) && cityKey(h.city) === cityKey(city));
            if (match) {
                await this.prisma.hospital.update({ where: { id: match.id }, data: data });
                updated++;
            }
            else {
                const id = `file-${slug(`${name}-${city}`)}`;
                await this.prisma.hospital.upsert({ where: { id }, create: { id, ...data }, update: data });
                created++;
            }
        }
        this.enrichment.enrichMissing().catch(() => { });
        return { created, updated, skipped, dropped, enrichStarted: true };
    }
};
exports.FileImportService = FileImportService;
exports.FileImportService = FileImportService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, enrichment_service_1.EnrichmentService])
], FileImportService);
//# sourceMappingURL=file-import.service.js.map