import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { isRealCountry, natRegion } from '../common/regions';

// Self-onboarded hospitals are hidden from every patient-facing query until an
// admin approves them. Scraped/legacy rows have approvalStatus = null and stay
// visible; onboarded rows only surface once APPROVED.
// ponytail: onboarded rows hidden from matching until approvalStatus = APPROVED
const VISIBLE: Prisma.HospitalWhereInput = {
  OR: [{ approvalStatus: null }, { approvalStatus: 'APPROVED' }],
};
// Same gate for surgeons: a doctor added during onboarding (hospitalId set) is
// hidden until its onboarding hospital is approved. Directory surgeons (no
// onboarding hospital) are always visible.
const VISIBLE_SURGEON: Prisma.SurgeonWhereInput = {
  OR: [{ hospitalId: null }, { onboardingHospital: { approvalStatus: 'APPROVED' } }],
};

// Doctor fields safe to expose to a patient on the hospital-details screen — never
// the slotToken (doctor's private link secret) or email (PII). openSlots count lets
// the UI show who's bookable for a video consult without a second round-trip.
const PATIENT_DOCTOR_SELECT = {
  id: true, name: true, title: true, specialization: true, photoUrl: true,
  yearsExperience: true, totalProcedures: true, successRate: true,
  education: true, degrees: true, languages: true, awards: true, patientRating: true,
} as const;
// NB: teleconsultEnabled lives on OnboardingDoctor, NOT on Surgeon (the type of
// hospital.doctors). It's merged in by findOne() via publishedSurgeonId — putting
// it in this Surgeon select would make Prisma reject the query.

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

// Metro regions clubbed in the chat's city picker → the hospital-city substrings
// they cover. "Delhi NCR" (id 'delhi') spans Delhi/New Delhi/Gurugram/Noida;
// "Mumbai" spans Mumbai + Navi Mumbai. Any other id falls back to matching its own
// name. Keep in sync with the CITIES chips in frontend AssistantPage.
const CITY_ALIASES: Record<string, string[]> = {
  delhi: ['delhi', 'gurugram', 'gurgaon', 'noida', 'ncr'],
  mumbai: ['mumbai'], // "navi mumbai" contains "mumbai"
};

/** Does a hospital's city fall within the patient's chosen (possibly clubbed) city? */
function cityMatches(hospitalCity: string | null, cityId?: string): boolean {
  if (!cityId || cityId === 'ai-decide') return false;
  const hc = (hospitalCity || '').toLowerCase();
  const aliases = CITY_ALIASES[cityId] ?? [cityId.toLowerCase()];
  return aliases.some((a) => hc.includes(a));
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
  // Admin-designated Priority partners get the single strongest boost so they
  // are preferentially recommended to patients (set in the admin dashboard).
  if (h.priority) score += 50;
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
        this.prisma.hospital.count({ where: { jciAccredited: true, ...VISIBLE } }),
        // Distinct countries among JCI-accredited hospitals.
        this.prisma.hospital
          .groupBy({ by: ['country'], where: { jciAccredited: true, ...VISIBLE } })
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
      where: VISIBLE,
      select: { city: true, specialty: true },
    });
    const cities = [...new Set(hospitals.map(h => h.city).filter(Boolean))].sort();
    const specialties = [...new Set(hospitals.map(h => h.specialty).filter(Boolean))].sort();
    return { cities, specialties };
  }

  async getDispatch(page = 1, pageSize = 20, search = '', city = '') {
    // Anti-scrape: clamp so a single request can't pull the whole catalog
    // (e.g. ?pageSize=100000). Never serve more than 50 hospitals per page.
    page = Math.max(1, Number(page) || 1);
    pageSize = Math.min(50, Math.max(1, Number(pageSize) || 20));
    const hospitals = await this.prisma.hospital.findMany({
      where: VISIBLE,
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

    // Free-text search by hospital name + city filter (substring, case-insensitive).
    // Global stats stay whole-archive; only the grid + page count reflect the filter.
    const q = String(search || '').trim().toLowerCase();
    const cityQ = String(city || '').trim().toLowerCase();
    let filtered = items;
    if (q) filtered = filtered.filter((h) => h.title.toLowerCase().includes(q));
    if (cityQ && cityQ !== 'all') filtered = filtered.filter((h) => (h.city || '').toLowerCase() === cityQ);

    // Distinct cities across the whole catalog — for the city filter dropdown.
    const cities = [...new Set(hospitals.map((h) => h.city).filter(Boolean))].sort();

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
      cities,
      hospitals: paged,
    };
  }

  async findAll() {
    const hospitals = await this.prisma.hospital.findMany({
      where: VISIBLE,
      include: { surgeon: true, _count: { select: { reviews: true } } },
    });
    const surgeons = await this.prisma.surgeon.findMany({ where: VISIBLE_SURGEON });
    return {
      hospitals: hospitals.map((h) => ({ ...h, reviewCount: h._count.reviews })),
      surgeons,
    };
  }

  async findOne(id: string) {
    // findFirst (not findUnique) so the visibility gate can hide unapproved
    // onboarded hospitals — they 404 for patients just like a missing id.
    const hospital = await this.prisma.hospital.findFirst({
      where: { id, ...VISIBLE },
      include: {
        surgeon: true,
        reviews: true,
        // The hospital's own onboarded doctors — the "top 3 surgeons" the patient
        // picks from to schedule a video consult. Ordered by seniority so the most
        // experienced surface first.
        doctors: {
          select: PATIENT_DOCTOR_SELECT,
          orderBy: [{ yearsExperience: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });
    if (!hospital) throw new NotFoundException('Hospital not found');

    // Teleconsult booking runs on OnboardingDoctor (see TeleconsultService), which
    // links to its published Surgeon via publishedSurgeonId. Attach each doctor's
    // bookable id + enabled flag so the journey can show the scheduling section and
    // book against the RIGHT id (a Surgeon id would 404 in booking).
    const surgeonIds = hospital.doctors.map((d) => d.id);
    if (surgeonIds.length) {
      const onboarded = await this.prisma.onboardingDoctor.findMany({
        where: { publishedSurgeonId: { in: surgeonIds }, teleconsultEnabled: true },
        select: { id: true, publishedSurgeonId: true },
      });
      const bookIdBySurgeon = new Map(onboarded.map((o) => [o.publishedSurgeonId, o.id]));
      hospital.doctors = hospital.doctors.map((d) => ({
        ...d,
        teleconsultEnabled: bookIdBySurgeon.has(d.id),
        bookingDoctorId: bookIdBySurgeon.get(d.id) ?? null,
      })) as any;
    }
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
      // Newest review first, by the review's own date; undated reviews sink to the end.
      orderBy: { reviewDate: { sort: 'desc', nulls: 'last' } },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }

  async matchForPatient(params: {
    diagnosis: string;
    treatment: string;
    country: string;
    urgency: string;
    city?: string; // patient's chosen city (clubbed id, e.g. 'delhi' = Delhi NCR)
  }) {
    const hospitals = await this.prisma.hospital.findMany({
      where: VISIBLE,
      include: { surgeon: true, _count: { select: { reviews: true } } },
    });
    const surgeons = await this.prisma.surgeon.findMany({ where: VISIBLE_SURGEON });
    const specialty = mapTreatmentToSpecialty(params.treatment);

    // Rule-based scoring — no AI needed. All hospitals come from our own database.
    // The patient's city is honored as a HARD priority: hospitals in the chosen
    // region rank above all others (via inRegion), then quality score breaks ties —
    // so the top pick is in their city whenever we have one there, while other
    // cities remain in the list as fallback (and 'Let AI Decide' keeps pure quality
    // ranking). Keeps depth for rare specialties without a city with no coverage.
    const scored = hospitals
      .map(h => ({
        ...h,
        reviewCount: h._count.reviews,
        inRegion: cityMatches(h.city, params.city),
        aiMatchScore: scoreHospital(h, specialty, params.urgency),
      }))
      // City preference first, then admin Priority partners, then quality score.
      .sort((a, b) => (Number(b.inRegion) - Number(a.inRegion)) || (Number(!!b.priority) - Number(!!a.priority)) || (b.aiMatchScore - a.aiMatchScore));

    const top = scored[0];
    const inRegionCount = scored.filter((h) => h.inRegion).length;
    const topRecommendation = top?.id ?? null;
    const recommendationReason = top
      ? `Based on your ${params.treatment} with ${params.urgency} urgency, we matched ${scored.length} hospitals from our network` +
        (inRegionCount ? ` (${inRegionCount} in your preferred city)` : '') +
        `. Top pick: ${top.name} — rated ${top.overallRating ?? '—'}/5 across ${top.reviewCount} verified reviews.`
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
      where: VISIBLE,
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
