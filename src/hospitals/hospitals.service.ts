import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { isRealCountry, natRegion } from '../common/regions';

const PROCEDURE_TO_SPECIALTY: Record<string, string> = {
  'acl reconstruction': 'Orthopedic',
  'knee replacement': 'Orthopedic',
  'hip replacement': 'Orthopedic',
  'spine surgery': 'Orthopedic',
  'spine fusion': 'Orthopedic',
  'arthroscopy': 'Orthopedic',
  'meniscus repair': 'Orthopedic',
  'shoulder surgery': 'Orthopedic',
  'cardiac bypass surgery': 'Cardiology',
  'angioplasty': 'Cardiology',
  'heart valve replacement': 'Cardiology',
  'ivf treatment': 'Fertility',
  'thyroid surgery': 'Oncology',
  'cancer treatment': 'Oncology',
  'dental implants': 'Dental',
  'cataract surgery': 'Ophthalmology',
};

function mapTreatmentToSpecialty(treatment: string): string | null {
  const key = treatment.toLowerCase();
  for (const [k, v] of Object.entries(PROCEDURE_TO_SPECIALTY)) {
    if (key.includes(k)) return v;
  }
  return null;
}

function scoreHospital(h: any, specialty: string | null, urgency: string): number {
  let score = 0;
  // Specialty match (highest weight)
  if (specialty && h.specialty === specialty) score += 35;
  // Procedure match in JSON array
  if (Array.isArray(h.procedures) && specialty) {
    const match = h.procedures.some((p: string) =>
      p.toLowerCase().includes((specialty ?? '').toLowerCase().split(' ')[0]),
    );
    if (match) score += 15;
  }
  // Fairness score (transparent pricing is valuable)
  score += ((h.fairnessScore ?? 0) / 100) * 20;
  // Overall rating (out of 5 → scale to 20 points)
  score += ((h.overallRating ?? 0) / 5) * 20;
  // Mystery shopper score
  score += ((h.mysteryShopperScore ?? 0) / 100) * 10;
  // Urgency bonus: prefer lower price when urgent (faster access)
  if (urgency === 'immediately' || urgency === 'Immediately') {
    const priceBonus = Math.max(0, (6000 - (h.quotedPriceUsd ?? 6000)) / 6000) * 5;
    score += priceBonus;
  }
  return Math.round(score);
}

@Injectable()
export class HospitalsService {
  constructor(private prisma: PrismaService, private ai: AiService) {}

  async getStats() {
    const SERVED = ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'];
    const [hospitalCount, countryCount, reviewCount, servedPatients, ratingAgg] =
      await Promise.all([
        // Homepage labels this "JCI-Accredited Hospitals" → only count JCI ones.
        this.prisma.hospital.count({ where: { jciAccredited: true } }),
        // Distinct countries among JCI-accredited hospitals.
        this.prisma.hospital
          .groupBy({ by: ['country'], where: { jciAccredited: true } })
          .then((r) => r.length),
        // Reviews are deduped per (hospitalId, contentHash) at insert, so every row
        // is already a distinct patient review. (A global contentHash group-by would
        // wrongly collapse identical texts that legitimately appear at >1 hospital.)
        this.prisma.review.count(),
        // "Patients served" = distinct patients with a real (non-pending/cancelled) booking.
        this.prisma.booking.findMany({
          where: { status: { in: SERVED as any } },
          select: { userId: true },
          distinct: ['userId'],
        }),
        // Homepage trust band shows "★ x.x verified reviews" → average over all reviews.
        this.prisma.review.aggregate({ _avg: { rating: true } }),
      ]);
    return {
      hospitalCount,
      countryCount,
      reviewCount,
      patientCount: servedPatients.length,
      // One decimal (e.g. 4.8); 0 when there are no reviews yet.
      avgRating: Math.round((ratingAgg._avg.rating ?? 0) * 10) / 10,
    };
  }

  async getMeta() {
    const hospitals = await this.prisma.hospital.findMany({
      select: { city: true, specialty: true },
    });
    const cities = [...new Set(hospitals.map(h => h.city).filter(Boolean))].sort();
    const specialties = [...new Set(hospitals.map(h => h.specialty).filter(Boolean))].sort();
    return { cities, specialties };
  }

  async getDispatch(page = 1, pageSize = 20, search = '') {
    // Anti-scrape: clamp so a single request can't pull the whole catalog
    // (e.g. ?pageSize=100000). Never serve more than 50 hospitals per page.
    page = Math.max(1, Number(page) || 1);
    pageSize = Math.min(50, Math.max(1, Number(pageSize) || 20));
    const hospitals = await this.prisma.hospital.findMany({
      select: { id: true, name: true, city: true, country: true, overallRating: true, jciAccredited: true, imageUrl: true },
    });
    const reviews = await this.prisma.review.findMany({
      select: { hospitalId: true, nationality: true, rating: true },
    });

    // Per-hospital aggregation: count, rating, distinct countries, region & country breakdowns.
    type Agg = { count: number; ratingSum: number; ratingN: number; countries: Map<string, number>; regions: Map<string, number> };
    const per = new Map<string, Agg>();
    const globalCountries = new Map<string, number>();
    const allCountries = new Set<string>();

    for (const r of reviews) {
      const a = per.get(r.hospitalId) ??
        { count: 0, ratingSum: 0, ratingN: 0, countries: new Map(), regions: new Map() };
      a.count++;
      if (r.rating != null) { a.ratingSum += r.rating; a.ratingN++; }
      const nat = (r.nationality || '').trim();
      const region = natRegion(nat);
      a.regions.set(region, (a.regions.get(region) ?? 0) + 1);
      if (isRealCountry(nat)) {
        a.countries.set(nat, (a.countries.get(nat) ?? 0) + 1);
        globalCountries.set(nat, (globalCountries.get(nat) ?? 0) + 1);
        allCountries.add(nat);
      }
      per.set(r.hospitalId, a);
    }

    const sortDesc = (m: Map<string, number>) =>
      [...m.entries()].sort((x, y) => y[1] - x[1]);

    const items = hospitals.map((h) => {
      const a = per.get(h.id);
      const count = a?.count ?? 0;
      return {
        slug: h.id, title: h.name, city: h.city,
        jciAccredited: h.jciAccredited, imageUrl: h.imageUrl,
        reviews: count,
        // Show the hospital's real overall rating, not the average of the curated
        // foreign-review subset (which skews the number). Fall back to that only if no rating.
        avgRating: h.overallRating ?? (a && a.ratingN ? a.ratingSum / a.ratingN : null),
        avg_rating: h.overallRating != null ? h.overallRating.toFixed(1) : (a && a.ratingN ? (a.ratingSum / a.ratingN).toFixed(1) : '—'),
        countries: a ? a.countries.size : 0,
        // Known geographic regions + an "Other Regions" catch-all for unmapped origins.
        region_breakdown: a ? sortDesc(a.regions) : [],
        top_countries: a ? sortDesc(a.countries).slice(0, 4) : [],
      };
    });
    // Biggest hospitals first.
    items.sort((x, y) => y.reviews - x.reviews);

    // Free-text search by hospital name (substring, case-insensitive). Global
    // stats stay whole-archive; only the grid + page count reflect the filter.
    const q = String(search || '').trim().toLowerCase();
    const filtered = q ? items.filter((h) => h.title.toLowerCase().includes(q)) : items;

    // Server-side pagination — return only the requested page slice.
    const start = Math.max(0, (page - 1) * pageSize);
    const paged = filtered.slice(start, start + pageSize);

    return {
      global: {
        totalReviews: reviews.length,
        totalHospitals: hospitals.length,
        totalCountries: allCountries.size,
        topCountries: sortDesc(globalCountries).slice(0, 3),
      },
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(filtered.length / pageSize)),
      hospitals: paged,
    };
  }

  async findAll() {
    const hospitals = await this.prisma.hospital.findMany({
      include: { surgeon: true, _count: { select: { reviews: true } } },
    });
    const surgeons = await this.prisma.surgeon.findMany();
    return {
      hospitals: hospitals.map((h) => ({ ...h, reviewCount: h._count.reviews })),
      surgeons,
    };
  }

  async findOne(id: string) {
    const hospital = await this.prisma.hospital.findUnique({
      where: { id },
      include: { surgeon: true, reviews: true },
    });
    if (!hospital) throw new NotFoundException('Hospital not found');
    return hospital;
  }

  async getReviews(hospitalId: string, page = 1, pageSize = 200) {
    // Anti-scrape: hard-cap the page size so the endpoint can't be turned into a
    // bulk dump. The reviews page needs every review for one hospital to build its
    // region breakdown, and per-hospital counts are small (≤ ~200), so the default
    // covers a full hospital in one request while the cap blocks abuse.
    page = Math.max(1, Number(page) || 1);
    pageSize = Math.min(200, Math.max(1, Number(pageSize) || 50));
    return this.prisma.review.findMany({
      where: { hospitalId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }

  async matchForPatient(params: {
    diagnosis: string;
    treatment: string;
    country: string;
    urgency: string;
  }) {
    const hospitals = await this.prisma.hospital.findMany({
      include: { surgeon: true, _count: { select: { reviews: true } } },
    });
    const surgeons = await this.prisma.surgeon.findMany();
    const specialty = mapTreatmentToSpecialty(params.treatment);

    // Rule-based scoring — no AI needed. All hospitals come from our own database.
    const scored = hospitals
      .map(h => ({ ...h, reviewCount: h._count.reviews, aiMatchScore: scoreHospital(h, specialty, params.urgency) }))
      .sort((a, b) => b.aiMatchScore - a.aiMatchScore);

    const top = scored[0];
    const topRecommendation = top?.id ?? null;
    const recommendationReason = top
      ? `Based on your ${params.treatment} with ${params.urgency} urgency, we matched ${scored.length} hospitals from our network. Top pick: ${top.name} — rated ${top.overallRating ?? '—'}/5 across ${top.reviewCount} verified reviews.`
      : 'No hospitals matched your criteria.';

    return {
      hospitals: scored,
      surgeons,
      topRecommendation,
      recommendationReason,
    };
  }

  /**
   * Server-side paginated comparison feed. Ranks the FULL DB set (match order in
   * journey mode), then applies city filter + sort + pagination so the page only
   * ever ships one page (20). Returns the distinct city list and the global top
   * recommendation so the UI can render filters and the "AI Top Pick" badge.
   */
  async getComparison(params: {
    page?: number; pageSize?: number; city?: string; sort?: string;
    treatment?: string; urgency?: string; search?: string;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(params.pageSize) || 20));

    const all = await this.prisma.hospital.findMany({
      include: { surgeon: true, _count: { select: { reviews: true } } },
    });
    let list = all.map((h) => ({ ...h, reviewCount: h._count.reviews }));

    // Journey ranking → global top pick (computed over the full set, before paging).
    let topRecommendation: string | null = null;
    let recommendationReason: string | null = null;
    if (params.treatment) {
      const specialty = mapTreatmentToSpecialty(params.treatment);
      list = list
        .map((h) => ({ ...h, aiMatchScore: scoreHospital(h, specialty, params.urgency || 'flexible') }))
        .sort((a, b) => (b as any).aiMatchScore - (a as any).aiMatchScore);
      const top = list[0];
      topRecommendation = top?.id ?? null;
      recommendationReason = top
        ? `Top pick for your ${params.treatment}: ${top.name} — rated ${top.overallRating ?? '—'}/5 across ${top.reviewCount} verified reviews.`
        : null;
    }

    // Distinct cities (first word) for the filter — from the full set, not the page.
    const cities = [...new Set(all.map((h) => h.city.split(' ')[0]).filter(Boolean))].sort();

    if (params.city && params.city !== 'all') {
      const c = params.city.toLowerCase();
      list = list.filter((h) => h.city.toLowerCase().includes(c));
    }

    // Free-text search by hospital name (substring, case-insensitive).
    const q = params.search?.trim().toLowerCase();
    if (q) list = list.filter((h) => h.name.toLowerCase().includes(q));

    if (params.sort === 'rating') list.sort((a, b) => (b.overallRating ?? 0) - (a.overallRating ?? 0));
    else if (params.sort === 'reviews') list.sort((a, b) => b.reviewCount - a.reviewCount);
    // else: keep relevance/match order (journey) or DB order.

    const total = list.length;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const clamped = Math.min(page, pageCount);
    const hospitals = list.slice((clamped - 1) * pageSize, (clamped - 1) * pageSize + pageSize);

    return { hospitals, total, page: clamped, pageCount, cities, topRecommendation, recommendationReason };
  }
}
