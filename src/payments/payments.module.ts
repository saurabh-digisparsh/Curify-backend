import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BookingsModule } from '../bookings/bookings.module';
import { PaymentsController } from './payments.controller';
import { WebhooksController } from './webhooks.controller';
import { PaymentsService } from './payments.service';
import { razorpayProvider } from './razorpay.provider';

@Module({
  imports: [PrismaModule, BookingsModule], // BookingsModule exports BookingsService (reused to confirm bookings)
  controllers: [PaymentsController, WebhooksController],
  providers: [PaymentsService, razorpayProvider],
})
export class PaymentsModule {}
