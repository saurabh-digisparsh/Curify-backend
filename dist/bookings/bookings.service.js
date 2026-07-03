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
exports.BookingsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const DEFAULT_MILESTONES = [
    { label: 'Pre-Op Checks', done: true, active: false, sequence: 1 },
    { label: 'Anaesthesia', done: true, active: false, sequence: 2 },
    { label: 'In Theatre', done: false, active: true, sequence: 3 },
    { label: 'Recovery Room', done: false, active: false, sequence: 4 },
    { label: 'Ward', done: false, active: false, sequence: 5 },
    { label: 'Flying Home', done: false, active: false, sequence: 6 },
];
let BookingsService = class BookingsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(data) {
        const hospital = await this.prisma.hospital.findUnique({ where: { id: data.hospitalId } });
        if (!hospital)
            throw new common_1.NotFoundException('Hospital not found');
        const userId = data.userId;
        const booking = await this.prisma.booking.create({
            data: {
                userId,
                reportId: data.reportId ?? null,
                hospitalId: data.hospitalId,
                plan: data.plan ?? 'COMFORT',
                status: 'CONFIRMED',
                totalAmount: data.totalAmount ?? null,
                currency: data.currency ?? 'USD',
                paymentRef: data.paymentRef ?? `CRF-${Date.now()}`,
            },
        });
        await this.prisma.bookingMilestone.createMany({
            data: DEFAULT_MILESTONES.map(m => ({ ...m, bookingId: booking.id })),
        });
        await this.prisma.bookingStatusUpdate.create({
            data: {
                bookingId: booking.id,
                status: 'pre-op-checks',
                message: 'Booking confirmed. Pre-operative checks will begin on your arrival day.',
                icon: '✅',
            },
        });
        return { bookingId: booking.id, paymentRef: booking.paymentRef, status: booking.status };
    }
    async findOne(id, requesterId, isAdmin = false) {
        const booking = await this.prisma.booking.findUnique({
            where: { id },
            include: { hospital: true, statusUpdates: true, milestones: { orderBy: { sequence: 'asc' } } },
        });
        if (!booking || (!isAdmin && booking.userId !== requesterId)) {
            throw new common_1.NotFoundException('Booking not found');
        }
        return booking;
    }
};
exports.BookingsService = BookingsService;
exports.BookingsService = BookingsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BookingsService);
//# sourceMappingURL=bookings.service.js.map