"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TripPlanService = exports.FX_TO_USD = void 0;
exports.quoteToUsd = quoteToUsd;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const ai_service_1 = require("../ai/ai.service");
const trip_services_1 = require("./trip-services");
const fs_1 = require("fs");
const path_1 = require("path");
exports.FX_TO_USD = {
    USD: 1, EUR: 1.08, GBP: 1.27, INR: 0.012, AED: 0.2723, NGN: 0.00065,
};
function quoteToUsd(amount, currency) {
    return Math.round(amount * (exports.FX_TO_USD[(currency || 'USD').toUpperCase()] ?? 1));
}
let TripPlanService = class TripPlanService {
    constructor(prisma, ai) {
        this.prisma = prisma;
        this.ai = ai;
    }
    async getTemplate(procedure, destination) {
        return this.prisma.tripPlanTemplate.findFirst({
            where: {
                procedure: { contains: procedure, mode: 'insensitive' },
                destination: { contains: destination, mode: 'insensitive' },
            },
        });
    }
    async getFlights(origin, destination) {
        const city = destination.split('(')[0].trim();
        const flights = await this.prisma.flightOption.findMany({
            where: {
                origin: { contains: origin, mode: 'insensitive' },
                destination: { contains: city, mode: 'insensitive' },
            },
            orderBy: { price: 'asc' },
        });
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
    applyTreatmentCost(plan, amount, currency) {
        const cur = (currency || 'USD').toUpperCase();
        const usd = quoteToUsd(amount, cur);
        const note = cur === 'USD'
            ? 'Confirmed by your doctor'
            : `Confirmed by your doctor (${cur} ${amount.toLocaleString('en-US')})`;
        const rx = /treatment|surgery|procedure|package|hospital|medical/i;
        const line = { item: 'Treatment (doctor-quoted)', amount: usd, note };
        let costs = plan.costs;
        if (!costs) {
            costs = { treatment: line };
        }
        else if (Array.isArray(costs)) {
            const hit = costs.find((c) => c && rx.test(String(c.item || '')));
            if (hit) {
                hit.amount = usd;
                hit.note = note;
            }
            else
                costs.push(line);
        }
        else {
            const key = Object.keys(costs).find((k) => rx.test(String((costs[k]?.item ?? k))));
            if (key) {
                costs[key] = { ...costs[key], amount: usd, note };
            }
            else
                costs.treatment = line;
        }
        plan.costs = costs;
        const all = Array.isArray(costs) ? costs : Object.values(costs);
        plan.totalEstimate = all.reduce((s, c) => s + (Number(c?.amount) || 0), 0);
        plan.treatmentQuote = { amount, currency: cur, amountUsd: usd };
        return plan;
    }
    async generate(params) {
        const hospital = await this.prisma.hospital.findUnique({
            where: { id: params.hospitalId },
            include: { surgeon: true },
        });
        if (!hospital)
            throw new common_1.NotFoundException('Hospital not found');
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
                features: p.features,
                recommended: p.recommended,
            })),
            teleconsultDoctor: {
                name: 'Dr. Priya Sharma',
                title: 'Pre-op Coordination Specialist',
                photo: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=120&h=120&fit=crop&crop=face',
                hospital: hospital.name,
            },
        };
        const pax = params.travelers && params.travelers > 0 ? params.travelers : 1;
        const days = params.stayNights && params.stayNights > 0 ? params.stayNights : 14;
        const flightUnit = flights[0]?.price ?? 0;
        const nightlyUsd = 45;
        const hotelEstimate = params.accommodation === 'none' ? 0 : days * nightlyUsd;
        const insurancePlan = insurance[0];
        const costs = {
            treatment: { item: 'Treatment package', amount: hospital.quotedPriceUsd ?? 0, note: hospital.name },
            flights: { item: `Flights (${pax} traveller${pax > 1 ? 's' : ''})`, amount: flightUnit * pax, note: flights[0]?.airline ?? 'Estimated economy fare' },
            visa: { item: `India e-Visa (${pax})`, amount: 25 * pax, note: 'Official e-Visa fee' },
            hotel: { item: `Accommodation (${days} nights)`, amount: hotelEstimate, note: 'Estimate — hospital recovery housing may be included' },
            insurance: { item: 'Travel & medical insurance', amount: insurancePlan ? insurancePlan.pricePerDay * days : 0, note: insurancePlan?.name ?? 'Comprehensive cover' },
            misc: { item: 'Local transport & incidentals', amount: 200, note: 'Airport transfers, meals, buffer' },
        };
        const totalEstimate = Object.values(costs).reduce((s, c) => s + (c.amount || 0), 0);
        const timeline = (0, trip_services_1.buildTimeline)({ treatment: params.treatment, stayNights: params.stayNights });
        let travelTips = [
            `Carry your hospital appointment letter and doctor quote — immigration may ask the purpose of visit.`,
            `Keep digital + printed copies of your e-Visa, passport and medical reports.`,
            `Arrange an eSIM or local SIM on arrival so your coordinator can reach you.`,
        ];
        let insuranceAlert = {
            type: 'info',
            text: `A ${days}-day recovery in ${hospital.city} should be covered by travel + medical insurance.`,
            recommendation: insurancePlan?.name ?? 'Comprehensive medical cover',
        };
        try {
            const enriched = await this.ai.enrichTripTips({ hospitalName: hospital.name, city: hospital.city, treatment: params.treatment || params.diagnosis, country: params.country, stayNights: days });
            if (Array.isArray(enriched?.travelTips) && enriched.travelTips.length)
                travelTips = enriched.travelTips;
            if (enriched?.insuranceAlert)
                insuranceAlert = enriched.insuranceAlert;
        }
        catch { }
        const services = (0, trip_services_1.buildServiceSteps)({
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
            atlysVisaUrl: (0, trip_services_1.atlysVisaLink)(),
            source: 'computed',
            ...staticData,
        };
        return params.treatmentCost != null ? this.applyTreatmentCost(result, params.treatmentCost, params.treatmentCurrency) : result;
    }
    listServices(userId, hospitalId) {
        return this.prisma.tripServiceStep.findMany({
            where: { userId, hospitalId },
            orderBy: { createdAt: 'asc' },
        });
    }
    setServiceStatus(userId, hospitalId, type, status) {
        return this.upsertStep(userId, hospitalId, type, { status });
    }
    async attachProof(userId, hospitalId, type, file, fields) {
        const proofPath = await this.saveProof(userId, hospitalId, type, file);
        let status = 'confirmed';
        let meta = { uploadedAt: new Date().toISOString(), filename: file.originalname };
        if (type === 'visa') {
            const result = (0, trip_services_1.validateVisa)(fields);
            meta = { ...meta, ...result, visaNumber: fields.visaNumber };
            status = result.valid ? 'confirmed' : 'pending';
        }
        return this.upsertStep(userId, hospitalId, type, { proofPath, status, meta });
    }
    upsertStep(userId, hospitalId, type, data) {
        return this.prisma.tripServiceStep.upsert({
            where: { userId_hospitalId_type: { userId, hospitalId, type } },
            create: { userId, hospitalId, type, provider: trip_services_1.PROVIDERS[type], status: data.status ?? 'pending', proofPath: data.proofPath, meta: data.meta ?? undefined },
            update: { ...data, meta: data.meta ?? undefined },
        });
    }
    async saveProof(userId, hospitalId, type, file) {
        const rel = (0, path_1.join)('trip-proofs', userId, `${hospitalId}-${type}-${Date.now()}.${(file.originalname.split('.').pop() || 'bin').toLowerCase()}`);
        const abs = (0, path_1.join)(process.cwd(), 'uploads', rel);
        await fs_1.promises.mkdir((0, path_1.join)(abs, '..'), { recursive: true });
        await fs_1.promises.writeFile(abs, file.buffer);
        return rel.replace(/\\/g, '/');
    }
};
exports.TripPlanService = TripPlanService;
exports.TripPlanService = TripPlanService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, ai_service_1.AiService])
], TripPlanService);
//# sourceMappingURL=trip-plan.service.js.map