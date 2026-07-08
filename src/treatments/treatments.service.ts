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

    // Real treatment, not in the catalog → add it (auto-add per product decision).
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
