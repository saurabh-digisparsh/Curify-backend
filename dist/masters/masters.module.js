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
exports.MastersModule = exports.MastersController = exports.MastersService = void 0;
const common_1 = require("@nestjs/common");
const common_2 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const prisma_module_1 = require("../prisma/prisma.module");
const prisma_service_1 = require("../prisma/prisma.service");
let MastersService = class MastersService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getAll() {
        const order = { where: { active: true }, orderBy: { sortOrder: 'asc' } };
        const [specialties, qualifications, languages, timezones] = await Promise.all([
            this.prisma.specialty.findMany(order),
            this.prisma.qualification.findMany(order),
            this.prisma.language.findMany(order),
            this.prisma.timezone.findMany(order),
        ]);
        return {
            specialties: specialties.map((x) => x.name),
            qualifications: qualifications.map((x) => x.name),
            languages: languages.map((x) => x.name),
            timezones: timezones.map((x) => ({ name: x.name, label: x.label })),
        };
    }
};
exports.MastersService = MastersService;
exports.MastersService = MastersService = __decorate([
    (0, common_2.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], MastersService);
let MastersController = class MastersController {
    constructor(svc) {
        this.svc = svc;
    }
    all() { return this.svc.getAll(); }
};
exports.MastersController = MastersController;
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Dropdown options: specialties, qualifications, languages, timezones' }),
    (0, common_2.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MastersController.prototype, "all", null);
exports.MastersController = MastersController = __decorate([
    (0, swagger_1.ApiTags)('Reference data'),
    (0, common_2.Controller)('masters'),
    __metadata("design:paramtypes", [MastersService])
], MastersController);
let MastersModule = class MastersModule {
};
exports.MastersModule = MastersModule;
exports.MastersModule = MastersModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule],
        controllers: [MastersController],
        providers: [MastersService],
    })
], MastersModule);
//# sourceMappingURL=masters.module.js.map