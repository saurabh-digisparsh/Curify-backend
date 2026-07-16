import Razorpay = require('razorpay');
import { PrismaService } from '../prisma/prisma.service';
import { BookingsService } from '../bookings/bookings.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
export declare class PaymentsService {
    private readonly rzp;
    private readonly prisma;
    private readonly bookings;
    private readonly log;
    private readonly currency;
    private readonly capture;
    constructor(rzp: Razorpay, prisma: PrismaService, bookings: BookingsService);
    createOrder(userId: string, dto: CreateOrderDto): Promise<{
        orderId: string;
        amount: number;
        currency: string;
        keyId: string;
        method: Record<string, boolean>;
    }>;
    verify(userId: string, dto: VerifyPaymentDto): Promise<{
        status: string;
        bookingId: string;
    }>;
    handleWebhook(rawBody: string, signature: string | undefined, eventId: string | undefined): Promise<{
        ignored: boolean;
        duplicate?: undefined;
        ok?: undefined;
    } | {
        duplicate: boolean;
        ignored?: undefined;
        ok?: undefined;
    } | {
        ok: boolean;
        ignored?: undefined;
        duplicate?: undefined;
    }>;
    private verifySignature;
    private markCaptured;
    private confirmBooking;
    private applyEvent;
}
