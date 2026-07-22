import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BookingsModule } from '../bookings/bookings.module';
import { AdminModule } from '../admin/admin.module'; // SettingsService (TELECONSULT_FEE)
import { HospitalPartnerModule } from '../hospital-partner/hospital-partner.module';
import { PaymentsController } from './payments.controller';
import { WebhooksController } from './webhooks.controller';
import { PaymentsService } from './payments.service';
import { razorpayProvider } from './razorpay.provider';

@Module({
  // BookingsModule exports BookingsService (reused to confirm bookings).
  // HospitalPartnerModule exports TeleconsultService so a captured payment can turn
  // a held slot into a real consult. The dependency is one-way (payments →
  // hospital-partner); the teleconsult side never imports payments, so no cycle.
  imports: [PrismaModule, BookingsModule, AdminModule, HospitalPartnerModule],
  controllers: [PaymentsController, WebhooksController],
  providers: [PaymentsService, razorpayProvider],
})
export class PaymentsModule {}
