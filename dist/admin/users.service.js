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
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const bcrypt = require("bcryptjs");
const prisma_service_1 = require("../prisma/prisma.service");
const SAFE_SELECT = {
    id: true,
    email: true,
    name: true,
    country: true,
    phone: true,
    role: true,
    createdAt: true,
    updatedAt: true,
};
let UsersService = class UsersService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(role) {
        return this.prisma.user.findMany({
            where: role ? { role } : undefined,
            select: SAFE_SELECT,
            orderBy: { createdAt: 'desc' },
        });
    }
    async findOne(id) {
        const user = await this.prisma.user.findUnique({ where: { id }, select: SAFE_SELECT });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        return user;
    }
    async create(dto) {
        const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (exists)
            throw new common_1.ConflictException('Email already registered');
        return this.prisma.user.create({
            data: {
                email: dto.email,
                password: await bcrypt.hash(dto.password, 12),
                role: dto.role,
                name: dto.name,
                country: dto.country,
                phone: dto.phone,
                emailVerifiedAt: new Date(),
            },
            select: SAFE_SELECT,
        });
    }
    async update(id, dto) {
        await this.findOne(id);
        if (dto.email) {
            const clash = await this.prisma.user.findFirst({
                where: { email: dto.email, id: { not: id } },
            });
            if (clash)
                throw new common_1.ConflictException('Email already in use');
        }
        const data = { ...dto };
        if (dto.password)
            data.password = await bcrypt.hash(dto.password, 12);
        return this.prisma.user.update({ where: { id }, data, select: SAFE_SELECT });
    }
    async remove(id, requesterId) {
        const user = await this.findOne(id);
        if (user.role === 'ADMIN') {
            const adminCount = await this.prisma.user.count({ where: { role: 'ADMIN' } });
            if (adminCount <= 1)
                throw new common_1.BadRequestException('Cannot delete the last admin');
        }
        if (id === requesterId)
            throw new common_1.BadRequestException('You cannot delete your own account');
        await this.prisma.user.delete({ where: { id } });
        return { deleted: true, id };
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UsersService);
//# sourceMappingURL=users.service.js.map