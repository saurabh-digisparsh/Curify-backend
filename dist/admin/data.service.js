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
exports.DataService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const RESOURCES = {
    hospitals: { delegate: 'hospital', search: ['name', 'city', 'country', 'specialty'], label: 'Hospitals', group: 'Catalog' },
    surgeons: { delegate: 'surgeon', search: ['name', 'specialization', 'hospital'], label: 'Surgeons', group: 'Catalog' },
    reviews: { delegate: 'review', search: ['reviewerName', 'nationality', 'text'], label: 'Reviews', group: 'Catalog' },
    'stay-or-go': { delegate: 'stayOrGoTemplate', search: ['procedure', 'homeCountry'], label: 'Stay-or-Go Templates', group: 'Journey Content' },
    'trip-plans': { delegate: 'tripPlanTemplate', search: ['procedure', 'destination'], label: 'Trip Plan Templates', group: 'Journey Content' },
    'recovery-protocols': { delegate: 'recoveryProtocol', search: ['procedure'], label: 'Recovery Protocols', group: 'Journey Content' },
    'flight-options': { delegate: 'flightOption', search: ['origin', 'destination', 'airline'], label: 'Flight Options', group: 'Commerce' },
    'insurance-plans': { delegate: 'insurancePlan', search: ['name', 'coverage'], label: 'Insurance Plans', group: 'Commerce' },
};
let DataService = class DataService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    resources() {
        return Object.entries(RESOURCES).map(([slug, r]) => ({ slug, label: r.label, group: r.group }));
    }
    model(resource) {
        const meta = RESOURCES[resource];
        if (!meta)
            throw new common_1.BadRequestException(`Unknown resource: ${resource}`);
        const delegate = this.prisma[meta.delegate];
        if (!delegate)
            throw new common_1.BadRequestException(`Resource not available: ${resource}`);
        return { delegate, meta };
    }
    async list(resource, opts) {
        const { delegate, meta } = this.model(resource);
        const take = Math.min(opts.take ?? 50, 200);
        const skip = opts.skip ?? 0;
        const where = opts.q && meta.search.length
            ? { OR: meta.search.map((f) => ({ [f]: { contains: opts.q, mode: 'insensitive' } })) }
            : undefined;
        const [items, total] = await Promise.all([
            delegate.findMany({ where, skip, take }),
            delegate.count({ where }),
        ]);
        return { items, total, skip, take };
    }
    async getOne(resource, id) {
        const { delegate } = this.model(resource);
        const item = await delegate.findUnique({ where: { id } });
        if (!item)
            throw new common_1.NotFoundException(`${resource} ${id} not found`);
        return item;
    }
    async create(resource, body) {
        const { delegate } = this.model(resource);
        return delegate.create({ data: body });
    }
    async update(resource, id, body) {
        const { delegate } = this.model(resource);
        await this.getOne(resource, id);
        const { id: _ignore, ...data } = body;
        return delegate.update({ where: { id }, data });
    }
    async remove(resource, id) {
        const { delegate } = this.model(resource);
        await this.getOne(resource, id);
        await delegate.delete({ where: { id } });
        return { deleted: true, resource, id };
    }
};
exports.DataService = DataService;
exports.DataService = DataService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DataService);
//# sourceMappingURL=data.service.js.map