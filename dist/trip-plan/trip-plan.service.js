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
exports.TripPlanService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const ai_service_1 = require("../ai/ai.service");
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
    async generate(params) {
        const hospital = await this.prisma.hospital.findUnique({
            where: { id: params.hospitalId },
            include: { surgeon: true },
        });
        if (!hospital)
            throw new common_1.NotFoundException('Hospital not found');
        const template = await this.getTemplate(params.treatment, hospital.city);
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
            partners: {
                visa: { name: 'Atlys', tagline: 'Visa handled by Atlys' },
                flights: { name: 'Booking.com', tagline: 'Flights via Booking.com' },
                transport: { name: 'EaseMyTrip', tagline: 'Local transport by EaseMyTrip' },
            },
            teleconsultDoctor: {
                name: 'Dr. Priya Sharma',
                title: 'Pre-op Coordination Specialist',
                photo: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=120&h=120&fit=crop&crop=face',
                hospital: hospital.name,
            },
        };
        if (template) {
            return {
                hospitalId: hospital.id,
                hospitalName: hospital.name,
                city: hospital.city,
                country: hospital.country,
                timeline: template.timeline,
                costs: template.costs,
                totalEstimate: template.totalEstimate,
                travelTips: template.travelTips,
                insuranceAlert: template.insuranceAlert,
                source: 'template',
                ...staticData,
            };
        }
        const tripPlan = await this.ai.generateTripPlan({
            hospital,
            surgeon: hospital.surgeon,
            diagnosis: params.diagnosis,
            treatment: params.treatment,
            country: params.country,
            departureCity: params.departureCity,
            travelDate: params.travelDate,
            travelers: params.travelers,
            stayNights: params.stayNights,
            accommodation: params.accommodation,
            notes: params.notes,
        });
        try {
            await this.prisma.tripPlanTemplate.create({
                data: {
                    procedure: params.treatment,
                    destination: hospital.city,
                    timeline: tripPlan.timeline ?? [],
                    costs: tripPlan.costs ?? {},
                    totalEstimate: tripPlan.totalEstimate ?? '',
                    travelTips: tripPlan.travelTips ?? [],
                },
            });
        }
        catch { }
        return {
            hospitalId: hospital.id,
            hospitalName: hospital.name,
            city: hospital.city,
            country: hospital.country,
            ...tripPlan,
            source: 'ai',
            ...staticData,
        };
    }
};
exports.TripPlanService = TripPlanService;
exports.TripPlanService = TripPlanService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, ai_service_1.AiService])
], TripPlanService);
//# sourceMappingURL=trip-plan.service.js.map