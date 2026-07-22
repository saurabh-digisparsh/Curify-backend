import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { deriveUrgent } from '../common/travel';

/** Fields a client may set — everything else (id, userId, timestamps) is server-owned. */
const WRITABLE = [
  'title', 'status', 'treatment', 'city', 'urgency', 'homeCountry', 'description',
  'travelDate', 'step', 'reportId', 'analysis', 'stayOrGo', 'hospitalId', 'tripPlan',
] as const;
type Writable = Partial<Record<(typeof WRITABLE)[number], any>>;

@Injectable()
export class JourneysService {
  constructor(private prisma: PrismaService, private ai: AiService) {}

  private pick(body: Writable) {
    const data: any = {};
    for (const k of WRITABLE) if (body[k] !== undefined) data[k] = body[k];
    // travelDate is client-set; `urgent` is DERIVED here and never trusted from the
    // client. Coerce the ISO string to a Date; drop an unparseable value silently.
    if (data.travelDate != null) {
      const d = new Date(data.travelDate);
      if (Number.isNaN(d.getTime())) delete data.travelDate;
      else { data.travelDate = d; data.urgent = deriveUrgent(d); }
    }
    return data;
  }

  async list(userId: string, opts?: { page?: number; pageSize?: number }) {
    // No pagination requested → full list (sidebar count, journey lookup).
    if (!opts) {
      return this.prisma.journey.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' } });
    }
    const page = Math.max(1, Number(opts.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(opts.pageSize) || 10));
    const where = { userId };
    const [total, journeys] = await Promise.all([
      this.prisma.journey.count({ where }),
      this.prisma.journey.findMany({
        where, orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize, take: pageSize,
      }),
    ]);
    return { journeys, total, page, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async get(userId: string, id: string) {
    // Ownership enforced by scoping the query to the caller — no cross-user reads.
    const journey = await this.prisma.journey.findFirst({ where: { id, userId } });
    if (!journey) throw new NotFoundException('Journey not found');
    return journey;
  }

  create(userId: string, body: Writable) {
    return this.prisma.journey.create({ data: { userId, ...this.pick(body) } });
  }

  async update(userId: string, id: string, body: Writable) {
    await this.get(userId, id); // ownership check
    return this.prisma.journey.update({ where: { id }, data: this.pick(body) });
  }

  /**
   * PUBLIC tracking payload for a shared journey link (no auth). Returns ONLY a
   * curated, low-sensitivity subset — the travel itinerary + status — never the
   * medical report/analysis. The cuid id acts as an unlisted share token.
   */
  async publicTracking(id: string) {
    const j = await this.prisma.journey.findUnique({ where: { id } });
    if (!j) throw new NotFoundException('Journey not found');
    const tp: any = j.tripPlan || {};
    const ti = tp.travelInfo || {};
    let hospital: { name: string; city: string; intlOfficePhone: string | null; intlOfficeEmail: string | null } | null = null;
    if (j.hospitalId) {
      hospital = await this.prisma.hospital.findUnique({
        where: { id: j.hospitalId },
        select: { name: true, city: true, intlOfficePhone: true, intlOfficeEmail: true },
      });
    }
    return {
      treatment: j.treatment,
      procedure: (j.analysis as any)?.diagnosis?.condition || j.treatment || null,
      homeCountry: j.homeCountry,
      departureCity: ti.departureCity ?? null,
      travelDate: ti.travelDate ?? null,
      hospitalName: hospital?.name ?? null,
      hospitalCity: hospital?.city ?? tp.city ?? null,
      hospitalPhone: hospital?.intlOfficePhone ?? null,
      hospitalEmail: hospital?.intlOfficeEmail ?? null,
      step: j.step,
      status: j.status,
    };
  }

  /** Delete a journey. Ownership enforced via get() (scoped to the caller). */
  async remove(userId: string, id: string) {
    await this.get(userId, id); // ownership check — 404s if not the caller's
    await this.prisma.journey.delete({ where: { id } });
    return { ok: true };
  }
}
