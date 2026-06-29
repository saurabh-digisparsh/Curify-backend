import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_MILESTONES = [
  { label: 'Pre-Op Checks', done: true,  active: false, sequence: 1 },
  { label: 'Anaesthesia',   done: true,  active: false, sequence: 2 },
  { label: 'In Theatre',    done: false, active: true,  sequence: 3 },
  { label: 'Recovery Room', done: false, active: false, sequence: 4 },
  { label: 'Ward',          done: false, active: false, sequence: 5 },
  { label: 'Flying Home',   done: false, active: false, sequence: 6 },
];

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    userId?: string;
    reportId?: string;
    hospitalId: string;
    plan?: string;
    totalAmount?: number;
    currency?: string;
    paymentRef?: string;
  }) {
    // Ensure hospital exists
    const hospital = await this.prisma.hospital.findUnique({ where: { id: data.hospitalId } });
    if (!hospital) throw new NotFoundException('Hospital not found');

    // Create a demo user if no userId provided (dev/demo flow)
    let userId = data.userId;
    if (!userId) {
      const demoUser = await this.prisma.user.upsert({
        where: { email: 'demo@curify.com' },
        update: {},
        create: { email: 'demo@curify.com', password: 'demo', name: 'Demo Patient' },
      });
      userId = demoUser.id;
    }

    const booking = await this.prisma.booking.create({
      data: {
        userId,
        reportId: data.reportId ?? null,
        hospitalId: data.hospitalId,
        plan: (data.plan as any) ?? 'COMFORT',
        status: 'CONFIRMED',
        totalAmount: data.totalAmount ?? null,
        currency: data.currency ?? 'USD',
        paymentRef: data.paymentRef ?? `CRF-${Date.now()}`,
      },
    });

    // Seed default milestones
    await this.prisma.bookingMilestone.createMany({
      data: DEFAULT_MILESTONES.map(m => ({ ...m, bookingId: booking.id })),
    });

    // Create initial status update
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

  async findOne(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { hospital: true, statusUpdates: true, milestones: { orderBy: { sequence: 'asc' } } },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }
}
