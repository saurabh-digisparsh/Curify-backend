import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';

@Injectable()
export class TreatmentsService {
  constructor(private prisma: PrismaService, private ai: AiService) {}

  /** The active catalog for the intake picker, in display order. */
  list() {
    return this.prisma.treatment.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      select: { slug: true, label: true, specialty: true },
    });
  }

  /**
   * Classify a patient's free-typed "Other" treatment. Returns the matching
   * catalog entry, or — when the AI recognizes a real treatment not in the
   * catalog — creates a new (aiAdded) row and returns it. Rejects input the AI
   * judges non-medical so the caller can fall back to the raw text.
   */
  async classify(text: string) {
    const catalog = await this.prisma.treatment.findMany({
      where: { active: true },
      select: { slug: true, label: true, specialty: true },
    });
    const r = await this.ai.classifyTreatment({ text, catalog });

    // Matched an existing catalog entry.
    if (r.slug) {
      const existing = catalog.find((c) => c.slug === r.slug);
      if (existing) return { ...existing, matched: true, created: false };
    }
    // AI rejected it (greeting / gibberish / not a treatment).
    if (!r.label) throw new BadRequestException('Not a recognizable treatment');

    // Don't create a condition-level duplicate: if a GENERIC specialty chip for the
    // resolved specialty already exists (its label IS the specialty, e.g. "Dermatology"),
    // reuse it. We deliberately do NOT reuse a specialty represented only by a specific
    // procedure (e.g. "Liver Transplant" for Gastroenterology) — that would mis-map an
    // unrelated condition; instead we add the proper specialty below.
    const norm = (s?: string | null) => (s || '').replace(/[^\p{L}\p{N}\s&()'-]/gu, '').trim().toLowerCase();
    const spec = norm(r.specialty);
    if (spec) {
      const generic = catalog.find((c) => norm(c.specialty) === spec && norm(c.label) === spec);
      if (generic) return { ...generic, matched: true, created: false };
    }

    // Genuinely new specialty (not an existing chip) → add it as a specialty entry.
    const added = await this.add(r.label, r.specialty);
    return { ...added, matched: false, created: true };
  }

  /** Insert a new treatment; reuse an existing row if the slug collides. */
  private async add(label: string, specialty: string | null) {
    const slug = this.slugify(label);
    const existing = await this.prisma.treatment.findUnique({
      where: { slug },
      select: { slug: true, label: true, specialty: true },
    });
    if (existing) return existing; // same slug already present → reuse, don't duplicate
    // Append after the curated list so admin ordering is preserved.
    const max = await this.prisma.treatment.aggregate({ _max: { sortOrder: true } });
    return this.prisma.treatment.create({
      data: { slug, label, specialty, aiAdded: true, sortOrder: (max._max.sortOrder ?? 0) + 1 },
      select: { slug: true, label: true, specialty: true },
    });
  }

  private slugify(label: string): string {
    return (
      label
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'treatment'
    );
  }
}
