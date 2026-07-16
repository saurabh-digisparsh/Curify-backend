import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { buildServiceSteps, buildTimeline, atlysVisaLink, validateVisa, PROVIDERS, ServiceType, ServiceStatus } from './trip-services';
import { promises as fs } from 'fs';
import { join } from 'path';

// Approximate mid-market FX → USD for the currencies the doctor quote form offers.
// The trip plan is denominated in USD, so a non-USD quote is converted before it
// becomes a cost line. ponytail: static rates (good enough for an estimate) — swap
// for a live rates feed if quotes ever need to-the-cent accuracy.
export const FX_TO_USD: Record<string, number> = {
  USD: 1, EUR: 1.08, GBP: 1.27, INR: 0.012, AED: 0.2723, NGN: 0.00065,
};

/** Convert a doctor's quote to whole USD for the (USD-denominated) trip plan.
 *  Unknown/blank currency is treated as USD (rate 1). */
export function quoteToUsd(amount: number, currency?: string): number {
  return Math.round(amount * (FX_TO_USD[(currency || 'USD').toUpperCase()] ?? 1));
}

@Injectable()
export class TripPlanService {
  constructor(private prisma: PrismaService, private ai: AiService) {}

  async getTemplate(procedure: string, destination: string) {
    return this.prisma.tripPlanTemplate.findFirst({
      where: {
        procedure: { contains: procedure, mode: 'insensitive' },
        destination: { contains: destination, mode: 'insensitive' },
      },
    });
  }

  async getFlights(origin: string, destination: string) {
    const city = destination.split('(')[0].trim(); // normalize "Gurgaon (Delhi NCR)" → "Gurgaon"
    const flights = await this.prisma.flightOption.findMany({
      where: {
        origin: { contains: origin, mode: 'insensitive' },
        destination: { contains: city, mode: 'insensitive' },
      },
      orderBy: { price: 'asc' },
    });
    // Fallback: if no specific origin match, return general Chennai/Delhi options
    if (flights.length === 0) {
      return this.prisma.flightOption.findMany({
        where: { destination: { contains: city, mode: 'insensitive' } },
        orderBy: { price: 'asc' },
        take: 3,
      });
    }
    return flights;
  }

  async getInsurance() {
    return this.prisma.insurancePlan.findMany({ orderBy: { pricePerDay: 'asc' } });
  }

  /**
   * Overlay the doctor's accepted quote as the authoritative treatment cost:
   * override the existing treatment/surgery line (or add one), then recompute the
   * total. ponytail: assumes the quote is in the plan's currency (USD) — a non-USD
   * quote would need FX conversion; wire that only if quotes go multi-currency.
   */
  private applyTreatmentCost(plan: any, amount: number, currency?: string) {
    const cur = (currency || 'USD').toUpperCase();
    const usd = quoteToUsd(amount, cur); // plan is in USD — convert non-USD quotes
    const note = cur === 'USD'
      ? 'Confirmed by your doctor'
      : `Confirmed by your doctor (${cur} ${amount.toLocaleString('en-US')})`;
    const rx = /treatment|surgery|procedure|package|hospital|medical/i;
    const line = { item: 'Treatment (doctor-quoted)', amount: usd, note };
    let costs = plan.costs;
    if (!costs) { costs = { treatment: line }; }
    else if (Array.isArray(costs)) {
      const hit = costs.find((c: any) => c && rx.test(String(c.item || '')));
      if (hit) { hit.amount = usd; hit.note = note; } else costs.push(line);
    } else {
      const key = Object.keys(costs).find((k) => rx.test(String((costs[k]?.item ?? k))));
      if (key) { costs[key] = { ...costs[key], amount: usd, note }; } else costs.treatment = line;
    }
    plan.costs = costs;
    const all: any[] = Array.isArray(costs) ? costs : Object.values(costs);
    plan.totalEstimate = all.reduce((s, c) => s + (Number(c?.amount) || 0), 0);
    plan.treatmentQuote = { amount, currency: cur, amountUsd: usd };
    return plan;
  }

  async generate(params: {
    hospitalId: string; diagnosis: string; treatment: string; country: string;
    departureCity?: string; travelDate?: string; travelers?: number; stayNights?: number;
    passport?: string; visaHelp?: string; accommodation?: string; notes?: string;
    treatmentCost?: number; treatmentCurrency?: string;
  }) {
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: params.hospitalId },
      include: { surgeon: true },
    });
    if (!hospital) throw new NotFoundException('Hospital not found');

    // Flights/insurance are real DB inventory (used for price estimates + the
    // options list). Departure city falls back to the patient's country.
    const [flights, insurance] = await Promise.all([
      this.getFlights(params.departureCity || params.country, hospital.city),
      this.getInsurance(),
    ]);

    const staticData = {
      flightOptions: flights.map(f => ({
        id: f.id,
        airline: f.airline,
        route: `${f.origin} → ${f.destination}`,
        duration: f.duration,
        stops: f.stops ?? '',
        price: f.price,
        class: 'Economy',
        bestValue: f.label === 'Best Value',
      })),
      insurancePlans: insurance.map(p => ({
        id: p.id,
        name: p.name,
        tagline: p.tagline ?? '',
        price: p.pricePerDay,
        coverage: p.coverage,
        features: p.features as string[],
        recommended: p.recommended,
      })),
      teleconsultDoctor: {
        name: 'Dr. Priya Sharma',
        title: 'Pre-op Coordination Specialist',
        photo: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=120&h=120&fit=crop&crop=face',
        hospital: hospital.name,
      },
    };

    // ── Deterministic cost estimate (no template) ─────────────────────────────
    const pax = params.travelers && params.travelers > 0 ? params.travelers : 1;
    const days = params.stayNights && params.stayNights > 0 ? params.stayNights : 14;
    const flightUnit = flights[0]?.price ?? 0;        // cheapest matched fare, per traveller
    const nightlyUsd = 45;                             // ponytail: flat nightly rate; pull live rates once the hotel API is wired
    const hotelEstimate = params.accommodation === 'none' ? 0 : days * nightlyUsd;
    const insurancePlan = insurance[0];                // cheapest plan (ordered asc)
    const costs: Record<string, { item: string; amount: number; note: string }> = {
      treatment: { item: 'Treatment package', amount: hospital.quotedPriceUsd ?? 0, note: hospital.name },
      flights: { item: `Flights (${pax} traveller${pax > 1 ? 's' : ''})`, amount: flightUnit * pax, note: flights[0]?.airline ?? 'Estimated economy fare' },
      visa: { item: `India e-Visa (${pax})`, amount: 25 * pax, note: 'Official e-Visa fee' },
      hotel: { item: `Accommodation (${days} nights)`, amount: hotelEstimate, note: 'Estimate — hospital recovery housing may be included' },
      insurance: { item: 'Travel & medical insurance', amount: insurancePlan ? insurancePlan.pricePerDay * days : 0, note: insurancePlan?.name ?? 'Comprehensive cover' },
      misc: { item: 'Local transport & incidentals', amount: 200, note: 'Airport transfers, meals, buffer' },
    };
    const totalEstimate = Object.values(costs).reduce((s, c) => s + (c.amount || 0), 0);

    // Timeline is computed from real dates; AI only enriches tips/advisory text
    // (best-effort — a slow/failed AI call falls back to computed defaults, so it
    // never blocks the plan). ponytail: enrichment still runs inline; move it to
    // streaming/async if the ~2-5s adds up.
    const timeline = buildTimeline({ treatment: params.treatment, stayNights: params.stayNights });
    let travelTips = [
      `Carry your hospital appointment letter and doctor quote — immigration may ask the purpose of visit.`,
      `Keep digital + printed copies of your e-Visa, passport and medical reports.`,
      `Arrange an eSIM or local SIM on arrival so your coordinator can reach you.`,
    ];
    let insuranceAlert: any = {
      type: 'info',
      text: `A ${days}-day recovery in ${hospital.city} should be covered by travel + medical insurance.`,
      recommendation: insurancePlan?.name ?? 'Comprehensive medical cover',
    };
    try {
      const enriched = await this.ai.enrichTripTips({ hospitalName: hospital.name, city: hospital.city, treatment: params.treatment || params.diagnosis, country: params.country, stayNights: days });
      if (Array.isArray(enriched?.travelTips) && enriched.travelTips.length) travelTips = enriched.travelTips;
      if (enriched?.insuranceAlert) insuranceAlert = enriched.insuranceAlert;
    } catch { /* computed defaults stand */ }

    const services = buildServiceSteps({
      hospital,
      departureCity: params.departureCity || params.country,
      travelDate: params.travelDate,
      travelers: pax,
      stayNights: params.stayNights,
      flightEstimate: flightUnit ? flightUnit * pax : undefined,
      hotelEstimate,
    });

    const result = {
      hospitalId: hospital.id,
      hospitalName: hospital.name,
      city: hospital.city,
      country: hospital.country,
      timeline,
      costs,
      totalEstimate,
      travelTips,
      insuranceAlert,
      services,
      atlysVisaUrl: atlysVisaLink(),
      source: 'computed',
      ...staticData,
    };
    return params.treatmentCost != null ? this.applyTreatmentCost(result, params.treatmentCost, params.treatmentCurrency) : result;
  }

  // ── Persisted service-step progress (authed, owner-scoped) ──────────────────
  // The computed checklist comes from generate(); these persist what the patient
  // *did* — confirmed/skipped a step, uploaded proof — so the dashboard resumes.

  /** All persisted steps for this patient's trip to a hospital. */
  listServices(userId: string, hospitalId: string) {
    return this.prisma.tripServiceStep.findMany({
      where: { userId, hospitalId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Mark a step confirmed / skipped / pending (self-service steps). */
  setServiceStatus(userId: string, hospitalId: string, type: ServiceType, status: ServiceStatus) {
    return this.upsertStep(userId, hospitalId, type, { status });
  }

  /**
   * Attach an uploaded proof document (granted e-Visa, flight ticket) to a step.
   * Visa proof is consistency-validated; a pass auto-confirms, a fail keeps the
   * step pending with the reason so the patient can fix and re-upload.
   */
  async attachProof(
    userId: string, hospitalId: string, type: ServiceType,
    file: Express.Multer.File,
    fields: { visaNumber?: string; visaExpiry?: string; travelDate?: string },
  ) {
    const proofPath = await this.saveProof(userId, hospitalId, type, file);
    let status: ServiceStatus = 'confirmed';
    let meta: Record<string, any> = { uploadedAt: new Date().toISOString(), filename: file.originalname };
    if (type === 'visa') {
      const result = validateVisa(fields);
      meta = { ...meta, ...result, visaNumber: fields.visaNumber };
      status = result.valid ? 'confirmed' : 'pending';
    }
    return this.upsertStep(userId, hospitalId, type, { proofPath, status, meta });
  }

  private upsertStep(
    userId: string, hospitalId: string, type: ServiceType,
    data: { status?: ServiceStatus; proofPath?: string; meta?: Record<string, any> },
  ) {
    return this.prisma.tripServiceStep.upsert({
      where: { userId_hospitalId_type: { userId, hospitalId, type } },
      create: { userId, hospitalId, type, provider: PROVIDERS[type], status: data.status ?? 'pending', proofPath: data.proofPath, meta: data.meta ?? undefined },
      update: { ...data, meta: data.meta ?? undefined },
    });
  }

  /** Persist a proof file under uploads/trip-proofs/<userId>/ and return its
   *  relative path. ponytail: local disk mirrors the app's existing uploads/ dir;
   *  swap to object storage when uploads move off-box. */
  private async saveProof(userId: string, hospitalId: string, type: ServiceType, file: Express.Multer.File) {
    const rel = join('trip-proofs', userId, `${hospitalId}-${type}-${Date.now()}.${(file.originalname.split('.').pop() || 'bin').toLowerCase()}`);
    const abs = join(process.cwd(), 'uploads', rel);
    await fs.mkdir(join(abs, '..'), { recursive: true });
    await fs.writeFile(abs, file.buffer);
    return rel.replace(/\\/g, '/');
  }
}
