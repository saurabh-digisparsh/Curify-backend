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
exports.SettingsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const settings_registry_1 = require("./settings.registry");
function mask(value) {
    if (!value)
        return '';
    const tail = value.slice(-4);
    return value.length <= 4 ? '••••' : `••••••••${tail}`;
}
let SettingsService = class SettingsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async overrides() {
        const rows = await this.prisma.systemSetting.findMany();
        return new Map(rows.map((r) => [r.key, r.value]));
    }
    resolve(def, overrides) {
        if (overrides.has(def.key))
            return { raw: overrides.get(def.key), source: 'override' };
        const envVal = def.env ? process.env[def.env] : undefined;
        if (envVal != null && envVal !== '')
            return { raw: envVal, source: 'env' };
        return { raw: def.default, source: 'default' };
    }
    coerce(def, raw) {
        switch (def.type) {
            case 'int':
                return raw === '' ? 0 : parseInt(raw, 10);
            case 'float':
                return raw === '' ? 0 : parseFloat(raw);
            case 'boolean':
                return raw === 'true' || raw === '1';
            default:
                return raw;
        }
    }
    toView(def, overrides) {
        const { raw, source } = this.resolve(def, overrides);
        const base = {
            key: def.key,
            label: def.label,
            description: def.description,
            category: def.category,
            type: def.type,
            secret: !!def.secret,
            readOnly: !!def.readOnly,
            min: def.min,
            max: def.max,
            source,
            isOverridden: source === 'override',
        };
        if (def.secret) {
            return { ...base, isSet: raw !== '', masked: mask(raw) };
        }
        return { ...base, value: this.coerce(def, raw) };
    }
    async list() {
        const overrides = await this.overrides();
        const order = ['integrations', 'leadgen', 'scheduling', 'system'];
        return order.map((category) => ({
            category,
            label: settings_registry_1.CATEGORY_META[category].label,
            description: settings_registry_1.CATEGORY_META[category].description,
            settings: settings_registry_1.SETTINGS_REGISTRY.filter((d) => d.category === category).map((d) => this.toView(d, overrides)),
        }));
    }
    normalize(def, value) {
        switch (def.type) {
            case 'int': {
                const n = typeof value === 'number' ? value : parseInt(String(value), 10);
                if (!Number.isFinite(n) || !Number.isInteger(n)) {
                    throw new common_1.BadRequestException(`${def.label} must be a whole number`);
                }
                if (def.min != null && n < def.min)
                    throw new common_1.BadRequestException(`${def.label} must be ≥ ${def.min}`);
                if (def.max != null && n > def.max)
                    throw new common_1.BadRequestException(`${def.label} must be ≤ ${def.max}`);
                return String(n);
            }
            case 'float': {
                const n = typeof value === 'number' ? value : parseFloat(String(value));
                if (!Number.isFinite(n))
                    throw new common_1.BadRequestException(`${def.label} must be a number`);
                if (def.min != null && n < def.min)
                    throw new common_1.BadRequestException(`${def.label} must be ≥ ${def.min}`);
                if (def.max != null && n > def.max)
                    throw new common_1.BadRequestException(`${def.label} must be ≤ ${def.max}`);
                return String(n);
            }
            case 'boolean': {
                const b = value === true || value === 'true' || value === '1';
                return b ? 'true' : 'false';
            }
            default:
                return value == null ? '' : String(value);
        }
    }
    async update(key, value, updatedBy) {
        const def = settings_registry_1.SETTINGS_BY_KEY[key];
        if (!def)
            throw new common_1.NotFoundException(`Unknown setting: ${key}`);
        if (def.readOnly)
            throw new common_1.BadRequestException(`${def.label} is read-only`);
        const normalized = this.normalize(def, value);
        await this.prisma.systemSetting.upsert({
            where: { key },
            create: { key, value: normalized, category: def.category, updatedBy },
            update: { value: normalized, updatedBy },
        });
        const overrides = await this.overrides();
        return this.toView(def, overrides);
    }
    async reset(key) {
        const def = settings_registry_1.SETTINGS_BY_KEY[key];
        if (!def)
            throw new common_1.NotFoundException(`Unknown setting: ${key}`);
        await this.prisma.systemSetting.deleteMany({ where: { key } });
        const overrides = await this.overrides();
        return this.toView(def, overrides);
    }
    async get(key) {
        const def = settings_registry_1.SETTINGS_BY_KEY[key];
        if (!def)
            throw new common_1.NotFoundException(`Unknown setting: ${key}`);
        return this.resolve(def, await this.overrides()).raw;
    }
    async getNumber(key) {
        return Number(await this.get(key));
    }
    async getBool(key) {
        const raw = await this.get(key);
        return raw === 'true' || raw === '1';
    }
};
exports.SettingsService = SettingsService;
exports.SettingsService = SettingsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SettingsService);
//# sourceMappingURL=settings.service.js.map