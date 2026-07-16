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
exports.HospitalsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const ai_service_1 = require("../ai/ai.service");
const regions_1 = require("../common/regions");
const VISIBLE = {
    OR: [{ approvalStatus: null }, { approvalStatus: 'APPROVED' }],
};
const VISIBLE_SURGEON = {
    OR: [{ hospitalId: null }, { onboardingHospital: { approvalStatus: 'APPROVED' } }],
};
const PATIENT_DOCTOR_SELECT = {
    id: true, name: true, title: true, specialization: true, photoUrl: true,
    yearsExperience: true, totalProcedures: true, successRate: true,
    education: true, degrees: true, languages: true, awards: true, patientRating: true,
};
const PROCEDURE_TO_SPECIALTY = {
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
function mapTreatmentToSpecialty(treatment) {
    const key = treatment.toLowerCase();
    for (const [k, v] of Object.entries(PROCEDURE_TO_SPECIALTY)) {
        if (key.includes(k))
            return v;
    }
    return null;
}
const CITY_ALIASES = {
    delhi: ['delhi', 'gurugram', 'gurgaon', 'noida', 'ncr'],
    mumbai: ['mumbai'],
};
function cityMatches(hospitalCity, cityId) {
    if (!cityId || cityId === 'ai-decide')
        return false;
    const hc = (hospitalCity || '').toLowerCase();
    const aliases = CITY_ALIASES[cityId] ?? [cityId.toLowerCase()];
    return aliases.some((a) => hc.includes(a));
}
function scoreHospital(h, specialty, urgency) {
    let score = 0;
    if (specialty && h.specialty === specialty)
        score += 35;
    if (Array.isArray(h.procedures) && specialty) {
        const match = h.procedures.some((p) => p.toLowerCase().includes((specialty ?? '').toLowerCase().split(' ')[0]));
        if (match)
            score += 15;
    }
    score += ((h.fairnessScore ?? 0) / 100) * 20;
    score += ((h.overallRating ?? 0) / 5) * 20;
    score += ((h.mysteryShopperScore ?? 0) / 100) * 10;
    if (urgency === 'immediately' || urgency === 'Immediately') {
        const priceBonus = Math.max(0, (6000 - (h.quotedPriceUsd ?? 6000)) / 6000) * 5;
        score += priceBonus;
    }
    if (h.priority)
        score += 50;
    return Math.round(score);
}
let HospitalsService = class HospitalsService {
    constructor(prisma, ai) {
        this.prisma = prisma;
        this.ai = ai;
    }
    async getStats() {
        const SERVED = ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'];
        const [hospitalCount, countryCount, reviewCount, servedPatients, ratingAgg] = await Promise.all([
            this.prisma.hospital.count({ where: { jciAccredited: true, ...VISIBLE } }),
            this.prisma.hospital
                .groupBy({ by: ['country'], where: { jciAccredited: true, ...VISIBLE } })
                .then((r) => r.length),
            this.prisma.review.count(),
            this.prisma.booking.findMany({
                where: { status: { in: SERVED } },
                select: { userId: true },
                distinct: ['userId'],
            }),
            this.prisma.review.aggregate({ _avg: { rating: true } }),
        ]);
        return {
            hospitalCount,
            countryCount,
            reviewCount,
            patientCount: servedPatients.length,
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
        page = Math.max(1, Number(page) || 1);
        pageSize = Math.min(50, Math.max(1, Number(pageSize) || 20));
        const hospitals = await this.prisma.hospital.findMany({
            where: VISIBLE,
            select: { id: true, name: true, city: true, country: true, overallRating: true, jciAccredited: true, imageUrl: true },
        });
        const reviews = await this.prisma.review.findMany({
            select: { hospitalId: true, nationality: true, rating: true },
        });
        const per = new Map();
        const globalCountries = new Map();
        const allCountries = new Set();
        for (const r of reviews) {
            const a = per.get(r.hospitalId) ??
                { count: 0, ratingSum: 0, ratingN: 0, countries: new Map(), regions: new Map() };
            a.count++;
            if (r.rating != null) {
                a.ratingSum += r.rating;
                a.ratingN++;
            }
            const nat = (r.nationality || '').trim();
            const region = (0, regions_1.natRegion)(nat);
            a.regions.set(region, (a.regions.get(region) ?? 0) + 1);
            if ((0, regions_1.isRealCountry)(nat)) {
                a.countries.set(nat, (a.countries.get(nat) ?? 0) + 1);
                globalCountries.set(nat, (globalCountries.get(nat) ?? 0) + 1);
                allCountries.add(nat);
            }
            per.set(r.hospitalId, a);
        }
        const sortDesc = (m) => [...m.entries()].sort((x, y) => y[1] - x[1]);
        const items = hospitals.map((h) => {
            const a = per.get(h.id);
            const count = a?.count ?? 0;
            return {
                slug: h.id, title: h.name, city: h.city,
                jciAccredited: h.jciAccredited, imageUrl: h.imageUrl,
                reviews: count,
                avgRating: h.overallRating ?? (a && a.ratingN ? a.ratingSum / a.ratingN : null),
                avg_rating: h.overallRating != null ? h.overallRating.toFixed(1) : (a && a.ratingN ? (a.ratingSum / a.ratingN).toFixed(1) : '—'),
                countries: a ? a.countries.size : 0,
                region_breakdown: a ? sortDesc(a.regions) : [],
                top_countries: a ? sortDesc(a.countries).slice(0, 4) : [],
            };
        });
        items.sort((x, y) => y.reviews - x.reviews);
        const q = String(search || '').trim().toLowerCase();
        const cityQ = String(city || '').trim().toLowerCase();
        let filtered = items;
        if (q)
            filtered = filtered.filter((h) => h.title.toLowerCase().includes(q));
        if (cityQ && cityQ !== 'all')
            filtered = filtered.filter((h) => (h.city || '').toLowerCase() === cityQ);
        const cities = [...new Set(hospitals.map((h) => h.city).filter(Boolean))].sort();
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
    async findOne(id) {
        const hospital = await this.prisma.hospital.findFirst({
            where: { id, ...VISIBLE },
            include: {
                surgeon: true,
                reviews: true,
                doctors: {
                    select: PATIENT_DOCTOR_SELECT,
                    orderBy: [{ yearsExperience: 'desc' }, { createdAt: 'asc' }],
                },
            },
        });
        if (!hospital)
            throw new common_1.NotFoundException('Hospital not found');
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
            }));
        }
        return hospital;
    }
    async getReviews(hospitalId, page = 1, pageSize = 200) {
        page = Math.max(1, Number(page) || 1);
        pageSize = Math.min(200, Math.max(1, Number(pageSize) || 50));
        return this.prisma.review.findMany({
            where: { hospitalId },
            orderBy: { reviewDate: { sort: 'desc', nulls: 'last' } },
            skip: (page - 1) * pageSize,
            take: pageSize,
        });
    }
    async matchForPatient(params) {
        const hospitals = await this.prisma.hospital.findMany({
            where: VISIBLE,
            include: { surgeon: true, _count: { select: { reviews: true } } },
        });
        const surgeons = await this.prisma.surgeon.findMany({ where: VISIBLE_SURGEON });
        const specialty = mapTreatmentToSpecialty(params.treatment);
        const scored = hospitals
            .map(h => ({
            ...h,
            reviewCount: h._count.reviews,
            inRegion: cityMatches(h.city, params.city),
            aiMatchScore: scoreHospital(h, specialty, params.urgency),
        }))
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
    async getComparison(params) {
        const page = Math.max(1, Number(params.page) || 1);
        const pageSize = Math.min(50, Math.max(1, Number(params.pageSize) || 20));
        const all = await this.prisma.hospital.findMany({
            where: VISIBLE,
            include: { surgeon: true, _count: { select: { reviews: true } } },
        });
        let list = all.map((h) => ({ ...h, reviewCount: h._count.reviews }));
        let topRecommendation = null;
        let recommendationReason = null;
        if (params.treatment) {
            const specialty = mapTreatmentToSpecialty(params.treatment);
            list = list
                .map((h) => ({ ...h, aiMatchScore: scoreHospital(h, specialty, params.urgency || 'flexible') }))
                .sort((a, b) => b.aiMatchScore - a.aiMatchScore);
            const top = list[0];
            topRecommendation = top?.id ?? null;
            recommendationReason = top
                ? `Top pick for your ${params.treatment}: ${top.name} — rated ${top.overallRating ?? '—'}/5 across ${top.reviewCount} verified reviews.`
                : null;
        }
        const cities = [...new Set(all.map((h) => h.city.split(' ')[0]).filter(Boolean))].sort();
        if (params.city && params.city !== 'all') {
            const c = params.city.toLowerCase();
            list = list.filter((h) => h.city.toLowerCase().includes(c));
        }
        const q = params.search?.trim().toLowerCase();
        if (q)
            list = list.filter((h) => h.name.toLowerCase().includes(q));
        if (params.sort === 'rating')
            list.sort((a, b) => (b.overallRating ?? 0) - (a.overallRating ?? 0));
        else if (params.sort === 'reviews')
            list.sort((a, b) => b.reviewCount - a.reviewCount);
        const total = list.length;
        const pageCount = Math.max(1, Math.ceil(total / pageSize));
        const clamped = Math.min(page, pageCount);
        const hospitals = list.slice((clamped - 1) * pageSize, (clamped - 1) * pageSize + pageSize);
        return { hospitals, total, page: clamped, pageCount, cities, topRecommendation, recommendationReason };
    }
};
exports.HospitalsService = HospitalsService;
exports.HospitalsService = HospitalsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, ai_service_1.AiService])
], HospitalsService);
//# sourceMappingURL=hospitals.service.js.map