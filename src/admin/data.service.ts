import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Maps a URL-friendly resource slug to its Prisma delegate + searchable text
 * fields. Adding a new admin-editable table is a one-line change here.
 */
const RESOURCES: Record<string, { delegate: string; search: string[]; label: string; group: string }> = {
  hospitals:            { delegate: 'hospital',         search: ['name', 'city', 'country', 'specialty'], label: 'Hospitals',             group: 'Catalog' },
  surgeons:             { delegate: 'surgeon',          search: ['name', 'specialization', 'hospital'],   label: 'Surgeons',              group: 'Catalog' },
  reviews:              { delegate: 'review',           search: ['reviewerName', 'nationality', 'text'],  label: 'Reviews',               group: 'Catalog' },
  'stay-or-go':         { delegate: 'stayOrGoTemplate', search: ['procedure', 'homeCountry'],             label: 'Stay-or-Go Templates',  group: 'Journey Content' },
  'trip-plans':         { delegate: 'tripPlanTemplate', search: ['procedure', 'destination'],             label: 'Trip Plan Templates',   group: 'Journey Content' },
  'recovery-protocols': { delegate: 'recoveryProtocol', search: ['procedure'],                            label: 'Recovery Protocols',    group: 'Journey Content' },
  'flight-options':     { delegate: 'flightOption',     search: ['origin', 'destination', 'airline'],     label: 'Flight Options',        group: 'Commerce' },
  'insurance-plans':    { delegate: 'insurancePlan',    search: ['name', 'coverage'],                     label: 'Insurance Plans',       group: 'Commerce' },
};

@Injectable()
export class DataService {
  constructor(private prisma: PrismaService) {}

  /** The catalog of editable resources — powers the Data Manager (grouped tabs). */
  resources() {
    return Object.entries(RESOURCES).map(([slug, r]) => ({ slug, label: r.label, group: r.group }));
  }

  private model(resource: string) {
    const meta = RESOURCES[resource];
    if (!meta) throw new BadRequestException(`Unknown resource: ${resource}`);
    const delegate = (this.prisma as any)[meta.delegate];
    if (!delegate) throw new BadRequestException(`Resource not available: ${resource}`);
    return { delegate, meta };
  }

  async list(resource: string, opts: { q?: string; skip?: number; take?: number }) {
    const { delegate, meta } = this.model(resource);
    const take = Math.min(opts.take ?? 50, 200);
    const skip = opts.skip ?? 0;

    const where =
      opts.q && meta.search.length
        ? { OR: meta.search.map((f) => ({ [f]: { contains: opts.q, mode: 'insensitive' } })) }
        : undefined;

    const [items, total] = await Promise.all([
      delegate.findMany({ where, skip, take }),
      delegate.count({ where }),
    ]);
    return { items, total, skip, take };
  }

  async getOne(resource: string, id: string) {
    const { delegate } = this.model(resource);
    const item = await delegate.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`${resource} ${id} not found`);
    return item;
  }

  async create(resource: string, body: Record<string, any>) {
    const { delegate } = this.model(resource);
    return delegate.create({ data: body });
  }

  async update(resource: string, id: string, body: Record<string, any>) {
    const { delegate } = this.model(resource);
    await this.getOne(resource, id);
    const { id: _ignore, ...data } = body; // never overwrite the primary key
    return delegate.update({ where: { id }, data });
  }

  async remove(resource: string, id: string) {
    const { delegate } = this.model(resource);
    await this.getOne(resource, id);
    await delegate.delete({ where: { id } });
    return { deleted: true, resource, id };
  }
}
