import { Module } from '@nestjs/common';
import { Controller, Get, Injectable } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';

// Reference master data (specialties, qualifications, languages, timezones) that
// powers the doctor-profile dropdowns. DB-driven + seeded (scripts/seed_masters.ts).
@Injectable()
export class MastersService {
  constructor(private prisma: PrismaService) {}
  async getAll() {
    const order = { where: { active: true }, orderBy: { sortOrder: 'asc' as const } };
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
}

@ApiTags('Reference data')
@Controller('masters')
export class MastersController {
  constructor(private readonly svc: MastersService) {}
  @ApiOperation({ summary: 'Dropdown options: specialties, qualifications, languages, timezones' })
  @Get()
  all() { return this.svc.getAll(); }
}

@Module({
  imports: [PrismaModule],
  controllers: [MastersController],
  providers: [MastersService],
})
export class MastersModule {}
