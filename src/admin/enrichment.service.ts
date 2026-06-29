import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);

function computeFairness(quoted?: number | null, benchmark?: number | null): number | null {
  if (!quoted || !benchmark) return null;
  const markup = ((quoted - benchmark) / benchmark) * 100;
  return Math.max(45, Math.min(99, Math.round(100 - markup)));
}

/**
 * Fills the AI-derived comparison-card fields on a hospital (price, included,
 * pros/cons, specialty, procedures, surgeon) and computes fairnessScore.
 * Single source of truth used by both the scrape pipeline (new hospitals) and
 * the admin bulk-enrich endpoint.
 */
@Injectable()
export class EnrichmentService {
  private readonly logger = new Logger(EnrichmentService.name);

  constructor(private prisma: PrismaService, private ai: AiService) {}

  /** Enrich one hospital. Skips (no-op) if it already has a price unless force=true. */
  async enrichHospital(hospitalId: string, force = false): Promise<boolean> {
    const h = await this.prisma.hospital.findUnique({ where: { id: hospitalId } });
    if (!h) return false;
    if (h.quotedPriceUsd != null && !force) return false;

    const reviews = await this.prisma.review.findMany({
      where: { hospitalId },
      select: { text: true, rating: true, nationality: true },
      take: 6,
      orderBy: { createdAt: 'desc' },
    });

    const data = await this.ai.generateHospitalEnrichment({
      name: h.name, city: h.city, country: h.country,
      overallRating: h.overallRating, jciAccredited: h.jciAccredited, reviews,
    });
    if (!data?.quotedPriceUsd) throw new Error('AI returned no price');

    // Link / create the surgeon (incl. realistic profile stats for the detail card).
    let surgeonId: string | undefined;
    if (data.surgeon?.name) {
      const s = data.surgeon;
      const id = `srg-${slugify(s.name)}`;
      const num = (v: any) => (Number.isFinite(v) ? v : null);
      const stats = {
        title: s.title ?? null,
        specialization: s.specialization ?? null,
        yearsExperience: num(s.yearsExperience) != null ? Math.round(s.yearsExperience) : null,
        totalProcedures: num(s.totalProcedures) != null ? Math.round(s.totalProcedures) : null,
        successRate: num(s.successRate),
        complications: num(s.complications),
        patientRating: num(s.patientRating),
        avgSurgeryTime: s.avgSurgeryTime ?? null,
        nextAvailable: s.nextAvailable ?? null,
        publications: num(s.publications) != null ? Math.round(s.publications) : null,
        education: Array.isArray(s.education) ? s.education : undefined,
        languages: Array.isArray(s.languages) ? s.languages : undefined,
        awards: Array.isArray(s.awards) ? s.awards : undefined,
      };
      await this.prisma.surgeon.upsert({
        where: { id },
        create: { id, name: s.name, hospital: h.name, country: 'India', ...stats },
        update: { ...stats },
      });
      surgeonId = id;
    }

    const quoted = Math.round(data.quotedPriceUsd);
    const localPrice = data.localPriceUsd ? Math.round(data.localPriceUsd) : null;
    const benchmark = data.localBenchmarkUsd ? Math.round(data.localBenchmarkUsd) : localPrice;

    await this.prisma.hospital.update({
      where: { id: hospitalId },
      data: {
        specialty: data.specialty ?? undefined,
        procedures: Array.isArray(data.procedures) ? data.procedures : undefined,
        quotedPriceUsd: quoted,
        localPriceUsd: localPrice,
        localBenchmarkUsd: benchmark,
        included: Array.isArray(data.included) ? data.included : undefined,
        notIncluded: Array.isArray(data.notIncluded) ? data.notIncluded : undefined,
        pros: Array.isArray(data.pros) ? data.pros : undefined,
        cons: Array.isArray(data.cons) ? data.cons : undefined,
        fairnessScore: computeFairness(quoted, benchmark) ?? undefined,
        surgeonId,
      },
    });
    return true;
  }

  /** Bulk-enrich hospitals missing a price (or all, with force). Best-effort, paced. */
  async enrichMissing(opts: { force?: boolean; limit?: number } = {}) {
    const where = opts.force ? {} : { quotedPriceUsd: null };
    const hospitals = await this.prisma.hospital.findMany({ where, select: { id: true, name: true } });
    const todo = opts.limit ? hospitals.slice(0, opts.limit) : hospitals;
    this.logger.log(`Enriching ${todo.length} hospitals (force=${!!opts.force})`);

    let enriched = 0, failed = 0;
    for (const h of todo) {
      try {
        await this.enrichHospital(h.id, opts.force);
        enriched++;
      } catch (e: any) {
        failed++;
        this.logger.warn(`enrich failed for ${h.name}: ${e.message}`);
      }
      await new Promise((r) => setTimeout(r, 350));
    }
    this.logger.log(`Enrichment done: enriched=${enriched} failed=${failed}`);
    return { total: todo.length, enriched, failed };
  }
}
