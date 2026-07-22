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
exports.FamilyDashboardService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const ai_service_1 = require("../ai/ai.service");
const NEXT_STEP_MAP = {
    'pre-op-checks': 'Move to anaesthesia prep — approx. 30 min',
    anaesthesia: 'Enter operating theatre — approx. 15 min',
    'in-surgery': 'Transfer to recovery room — approx. 2 hrs from now',
    'in-recovery': 'Moved to ward — approx. 4 hrs',
    'in-ward': 'Discharge planned for tomorrow morning',
    discharged: 'Follow-up consultation in 7 days',
};
const DEFAULT_CONTACTS = [
    { label: 'Curify Support', value: '+1-800-CURIFY', type: 'phone' },
    { label: 'curify.com/support', value: 'support@curify.com', type: 'email' },
];
let FamilyDashboardService = class FamilyDashboardService {
    constructor(prisma, ai) {
        this.prisma = prisma;
        this.ai = ai;
    }
    async getFamilyStatus(bookingId, requesterId, isAdmin = false) {
        const booking = await this.prisma.booking.findUnique({
            where: { id: bookingId },
            include: {
                hospital: { select: { name: true, city: true, intlOfficePhone: true, intlOfficeEmail: true } },
                statusUpdates: { orderBy: { createdAt: 'desc' }, take: 10 },
                milestones: { orderBy: { sequence: 'asc' } },
            },
        });
        if (!booking) {
            return this.getDemoState();
        }
        if (!isAdmin && booking.userId !== requesterId) {
            throw new common_1.ForbiddenException('You do not have access to this booking');
        }
        const latestStatus = booking.statusUpdates[0]?.status ?? 'in-surgery';
        const contacts = [
            ...(booking.hospital.intlOfficePhone
                ? [{ label: `${booking.hospital.name} — International Office`, value: booking.hospital.intlOfficePhone, type: 'phone' }]
                : []),
            ...(booking.hospital.intlOfficeEmail
                ? [{ label: 'International Email', value: booking.hospital.intlOfficeEmail, type: 'email' }]
                : []),
            ...DEFAULT_CONTACTS,
        ];
        return {
            bookingId,
            hospitalName: booking.hospital.name,
            city: booking.hospital.city,
            currentStatus: latestStatus,
            estimatedNext: NEXT_STEP_MAP[latestStatus] ?? 'Updates will be provided by the care team.',
            milestones: booking.milestones.map(m => ({
                id: m.id,
                label: m.label,
                done: m.done,
                active: m.active,
                sequence: m.sequence,
            })),
            updates: booking.statusUpdates.map(u => ({
                id: u.id,
                status: u.status,
                message: u.message,
                icon: u.icon,
                time: u.createdAt.toISOString(),
            })),
            contacts,
            source: 'db',
        };
    }
    getDemoState() {
        return {
            bookingId: 'demo',
            hospitalName: 'Apollo Hospitals Chennai',
            city: 'Chennai',
            currentStatus: 'in-surgery',
            estimatedNext: NEXT_STEP_MAP['in-surgery'],
            milestones: [
                { id: '1', label: 'Pre-Op Checks', done: true, active: false, sequence: 1 },
                { id: '2', label: 'Anaesthesia', done: true, active: false, sequence: 2 },
                { id: '3', label: 'In Theatre', done: false, active: true, sequence: 3 },
                { id: '4', label: 'Recovery Room', done: false, active: false, sequence: 4 },
                { id: '5', label: 'Ward', done: false, active: false, sequence: 5 },
                { id: '6', label: 'Flying Home', done: false, active: false, sequence: 6 },
            ],
            updates: [
                { id: 'u1', status: 'in-surgery', message: 'Dr. Malhotra has begun the procedure. Everything is proceeding as planned.', icon: '⚕️', time: new Date(Date.now() - 30 * 60000).toISOString() },
                { id: 'u2', status: 'anaesthesia', message: 'Patient is under general anaesthesia. Surgical team is fully assembled.', icon: '💉', time: new Date(Date.now() - 60 * 60000).toISOString() },
                { id: 'u3', status: 'pre-op-checks', message: 'All pre-operative checks completed. Patient is calm and ready.', icon: '✅', time: new Date(Date.now() - 90 * 60000).toISOString() },
            ],
            contacts: [
                { label: 'Apollo Chennai — International Office', value: '+91-44-2829-0200', type: 'phone' },
                { label: 'Nursing Station', value: '+91-44-2829-0300', type: 'phone' },
                { label: 'Emergency', value: '+91-44-2829-0911', type: 'phone' },
                ...DEFAULT_CONTACTS,
            ],
            source: 'demo',
        };
    }
    async getUpdates(_params) {
        return this.getDemoState();
    }
};
exports.FamilyDashboardService = FamilyDashboardService;
exports.FamilyDashboardService = FamilyDashboardService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, ai_service_1.AiService])
], FamilyDashboardService);
//# sourceMappingURL=family-dashboard.service.js.map