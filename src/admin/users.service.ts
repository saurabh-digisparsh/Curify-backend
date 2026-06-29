import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const SAFE_SELECT = {
  id: true,
  email: true,
  name: true,
  country: true,
  phone: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  /** List users, optionally filtered by role. Never returns password hashes. */
  async findAll(role?: Role) {
    return this.prisma.user.findMany({
      where: role ? { role } : undefined,
      select: SAFE_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: SAFE_SELECT });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /** Admin-only user creation — this is the ONLY way to create an ADMIN account. */
  async create(dto: CreateUserDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email already registered');

    return this.prisma.user.create({
      data: {
        email: dto.email,
        password: await bcrypt.hash(dto.password, 12),
        role: dto.role,
        name: dto.name,
        country: dto.country,
        phone: dto.phone,
      },
      select: SAFE_SELECT,
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id); // 404 if missing

    if (dto.email) {
      const clash = await this.prisma.user.findFirst({
        where: { email: dto.email, id: { not: id } },
      });
      if (clash) throw new ConflictException('Email already in use');
    }

    const data: any = { ...dto };
    if (dto.password) data.password = await bcrypt.hash(dto.password, 12);

    return this.prisma.user.update({ where: { id }, data, select: SAFE_SELECT });
  }

  /** Delete a user. Refuses to delete the last remaining admin. */
  async remove(id: string, requesterId: string) {
    const user = await this.findOne(id);

    if (user.role === 'ADMIN') {
      const adminCount = await this.prisma.user.count({ where: { role: 'ADMIN' } });
      if (adminCount <= 1) throw new BadRequestException('Cannot delete the last admin');
    }
    if (id === requesterId) throw new BadRequestException('You cannot delete your own account');

    await this.prisma.user.delete({ where: { id } });
    return { deleted: true, id };
  }
}
