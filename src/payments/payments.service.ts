import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import Razorpay = require('razorpay'); // export = (CommonJS): default import is not a constructor
import { PrismaService } from '../prisma/prisma.service';
import { BookingsService } from '../bookings/bookings.service';
import { SettingsService } from '../admin/settings/settings.service';
import { TeleconsultService } from '../hospital-partner/teleconsult.service';
import { RAZORPAY_CLIENT } from './razorpay.provider';
import { CreateOrderDto } from './dto/create-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';

// Server-side source of truth for what each plan costs — the client only names the
// plan, never the amount (ACID §"never trust the client amount"). Smallest currency
// unit: cents when RAZORPAY_CURRENCY=USD ($299 = 29900). Mirrors the frontend PLANS.
const PLAN_PRICES: Record<string, number> = {
  ESSENTIAL: 19900,
  COMFORT: 29900,
  PREMIUM: 49900,
};

// Which Checkout method blocks to show. Sent to the browser and passed to Razorpay
// Checkout `method`. These target INTERNATIONAL patients (USD): Indian EMI/paylater/
// cardless_emi do NOT apply to foreign cards, so they are never used here.
//   - card  → international cards + wallets (Apple Pay / Google Pay / PayPal)
//   - tabby → Gulf BNPL. `undefined` = no restriction, so Razorpay renders every
//     international method enabled on the account (Tabby among them). The exact
//     checkout.js key to isolate Tabby alone is not in the public docs — isolate it
//     with a Dashboard Checkout configuration, or confirm the key with Razorpay.
//     ponytail: passing an unknown `method` key can break the popup — don't guess one.
//   - all   → everything enabled on the account.
const METHOD_CONFIG: Record<string, Record<string, boolean> | undefined> = {
  card: { card: true, wallet: true },
  tabby: undefined,
  all: undefined,
};

@Injectable()
export class PaymentsService {
  private readonly log = new Logger(PaymentsService.name);
  private readonly currency = process.env.RAZORPAY_CURRENCY || 'USD';
  private readonly capture = (process.env.PAYMENTS_CAPTURE_MODE || 'auto') === 'auto' ? 1 : 0;

  constructor(
    @Inject(RAZORPAY_CLIENT) private readonly rzp: Razorpay,
    private readonly prisma: PrismaService,
    private readonly bookings: BookingsService,
    private readonly settings: SettingsService,
    private readonly teleconsults: TeleconsultService,
  ) {}

  // ── Teleconsult top-up: pay for a consult beyond the free per-journey allowance ─
  /**
   * Price and open a Razorpay order for a consult the patient has already HELD
   * (Teleconsult in PENDING_PAYMENT). Takes no amount and no price hint from the
   * client — the fee comes from the admin-controlled TELECONSULT_FEE setting, and
   * the consult must be the caller's own, still held, and not yet expired.
   */
  async createTeleconsultOrder(userId: string, teleconsultId: string) {
    const tc = await this.prisma.teleconsult.findUnique({
      where: { id: teleconsultId },
      select: { id: true, patientId: true, status: true, holdExpiresAt: true, scheduledAt: true },
    });
    // 404 for missing OR not-owner so consult ids can't be probed.
    if (!tc || tc.patientId !== userId) throw new NotFoundException('Consultation not found');
    if (tc.status !== 'PENDING_PAYMENT') {
      throw new BadRequestException('This consultation does not need payment.');
    }
    if (tc.holdExpiresAt && tc.holdExpiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('Your slot hold expired. Please pick a time again.');
    }

    // Fee is configured in whole currency units (49 = $49); Razorpay wants the
    // smallest unit. Guard against a 0/blank setting reaching checkout as a free order.
    const fee = await this.settings.getNumber('TELECONSULT_FEE');
    if (!Number.isFinite(fee) || fee <= 0) {
      throw new BadRequestException('Paid consultations are not available right now.');
    }
    const amount = Math.round(fee * 100);

    const order = await this.rzp.orders.create({
      amount,
      currency: this.currency,
      receipt: `curify_tc_${teleconsultId.slice(0, 8)}_${Date.now()}`,
      payment_capture: this.capture as any,
      notes: { userId, purpose: 'TELECONSULT', teleconsultId },
    });

    await this.prisma.payment.create({
      data: {
        userId,
        razorpayOrderId: order.id,
        amount,
        currency: this.currency,
        status: 'CREATED',
        notes: { userId, purpose: 'TELECONSULT', teleconsultId },
      },
    });

    return {
      orderId: order.id,
      amount,
      currency: this.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      method: METHOD_CONFIG.all,
    };
  }

  // ── Step 1: create a Razorpay order + local Payment(CREATED) ──────────────
  async createOrder(userId: string, dto: CreateOrderDto) {
    const amount = PLAN_PRICES[dto.plan];
    if (!amount) throw new BadRequestException('Unknown plan');

    const hospital = await this.prisma.hospital.findUnique({ where: { id: dto.hospitalId } });
    if (!hospital) throw new NotFoundException('Hospital not found');

    const methodGroup = dto.methodGroup ?? 'all';

    // Create the order at Razorpay first; if the DB write below fails, the order
    // is harmless (unpaid orders auto-expire) and the webhook/reconcile can recover.
    const order = await this.rzp.orders.create({
      amount,
      currency: this.currency,
      receipt: `curify_${userId.slice(0, 8)}_${Date.now()}`,
      payment_capture: this.capture as any,
      notes: { userId, plan: dto.plan, hospitalId: dto.hospitalId, methodGroup },
    });

    await this.prisma.payment.create({
      data: {
        userId,
        razorpayOrderId: order.id,
        amount,
        currency: this.currency,
        status: 'CREATED',
        notes: {
          userId,
          plan: dto.plan,
          hospitalId: dto.hospitalId,
          reportId: dto.reportId ?? null,
          methodGroup,
        },
      },
    });

    // key id is public; secret never leaves the server.
    return {
      orderId: order.id,
      amount,
      currency: this.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      method: METHOD_CONFIG[methodGroup],
    };
  }

  // ── Step 3: verify signature, capture, confirm booking ────────────────────
  async verify(userId: string, dto: VerifyPaymentDto) {
    const payment = await this.prisma.payment.findUnique({
      where: { razorpayOrderId: dto.razorpay_order_id },
    });
    // 404 for missing OR not-owner so order ids can't be probed.
    if (!payment || payment.userId !== userId) throw new NotFoundException('Payment not found');

    const valid = this.verifySignature(
      dto.razorpay_order_id,
      dto.razorpay_payment_id,
      dto.razorpay_signature,
    );

    if (!valid) {
      // CREATED → FAILED (conditional; ignore if already advanced).
      await this.prisma.payment.updateMany({
        where: { id: payment.id, status: 'CREATED' },
        data: { status: 'FAILED', failureReason: 'signature_mismatch' },
      });
      throw new BadRequestException('Payment signature verification failed');
    }

    const won = await this.markCaptured(payment.id, {
      paymentId: dto.razorpay_payment_id,
      signature: dto.razorpay_signature,
    });

    // Winner of the CAPTURED transition fulfils the order. If the webhook beat us
    // to it, `won` is false and we just return whatever it produced.
    if (won) {
      const bookingId = await this.fulfil(payment.id, {
        downPayment: dto.downPayment,
        installments: dto.installments,
      });
      return { status: 'CAPTURED', bookingId };
    }

    const fresh = await this.prisma.payment.findUnique({ where: { id: payment.id } });
    return { status: fresh?.status ?? 'CAPTURED', bookingId: fresh?.bookingId ?? null };
  }

  // ── Step 4: webhook — durable source of truth, idempotent ─────────────────
  async handleWebhook(rawBody: string, signature: string | undefined, eventId: string | undefined) {
    // Razorpay signs the raw body with the webhook secret (HMAC-SHA256, hex).
    // Same algorithm as the SDK's validateWebhookSignature — done with stdlib crypto
    // and a timing-safe compare to avoid SDK ESM/CJS interop quirks.
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET as string;
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const ok =
      !!signature &&
      signature.length === expected.length &&
      timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    if (!ok) throw new BadRequestException('Invalid webhook signature');

    const body = JSON.parse(rawBody);
    const type: string = body.event;
    const entity =
      body.payload?.payment?.entity ??
      body.payload?.order?.entity ??
      body.payload?.refund?.entity ??
      {};
    const orderId: string | undefined = entity.order_id ?? entity.id;
    const paymentId: string | undefined = body.payload?.payment?.entity?.id;

    // Locate our Payment by order (order.paid) or payment id (refunds reference payment).
    const payment = await this.prisma.payment.findFirst({
      where: orderId
        ? { OR: [{ razorpayOrderId: orderId }, { razorpayPaymentId: orderId }] }
        : { razorpayPaymentId: paymentId },
    });
    if (!payment) {
      this.log.warn(`Webhook ${type} for unknown order/payment ${orderId ?? paymentId} — ignored`);
      return { ignored: true };
    }

    // Idempotency: record the event first. A duplicate eventId (Razorpay retry)
    // throws P2002 → we ack 200 without re-processing.
    try {
      await this.prisma.paymentEvent.create({
        data: { paymentId: payment.id, eventId: eventId ?? `${type}:${paymentId ?? orderId}`, type, payload: body },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') return { duplicate: true };
      throw e;
    }

    await this.applyEvent(payment.id, type, entity);
    return { ok: true };
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private verifySignature(orderId: string, paymentId: string, signature: string): boolean {
    const expected = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET as string)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  // Atomic CREATED/AUTHORIZED → CAPTURED. Returns true only for the writer that
  // actually made the transition (so exactly one caller confirms the booking).
  private async markCaptured(
    paymentId: string,
    data: { paymentId: string; signature?: string; method?: string; emiMonths?: number },
  ): Promise<boolean> {
    const res = await this.prisma.payment.updateMany({
      where: { id: paymentId, status: { in: ['CREATED', 'AUTHORIZED'] } },
      data: {
        status: 'CAPTURED',
        razorpayPaymentId: data.paymentId,
        razorpaySignature: data.signature,
        method: data.method,
        emiMonths: data.emiMonths,
      },
    });
    return res.count === 1;
  }

  /**
   * Deliver what a captured Payment bought. Runs exactly once per payment (the
   * caller must have won the CAPTURED gate). Branches on the `purpose` stamped
   * into notes at order time; a missing purpose means a treatment plan, which is
   * what every payment written before teleconsult top-ups existed is.
   */
  private async fulfil(
    paymentId: string,
    extra?: { downPayment?: number; installments?: number },
  ): Promise<string | null> {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    const notes = (payment?.notes ?? {}) as any;
    if (notes.purpose === 'TELECONSULT') {
      // Turns the held slot into a real booking + sends the join links. Returns
      // false if it was already activated or the slot was lost — both are logged
      // there, and neither should fail the payment response.
      await this.teleconsults.activatePaidConsult(notes.teleconsultId, paymentId);
      return null; // teleconsult top-ups create no Booking
    }
    return this.confirmBooking(paymentId, extra);
  }

  // Create the Booking for a captured Payment, exactly once. Reuses BookingsService
  // (milestones, status updates). Guarded by the caller winning the CAPTURED gate.
  // ponytail: booking create + bookingId link aren't a single DB transaction; the
  //   CAPTURED gate makes confirmBooking run once, so a duplicate booking can't
  //   occur. Wrap both in $transaction if BookingsService is refactored to take a tx.
  private async confirmBooking(
    paymentId: string,
    extra?: { downPayment?: number; installments?: number },
  ): Promise<string | null> {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) return null;
    if (payment.bookingId) return payment.bookingId;

    const notes = (payment.notes ?? {}) as any;
    // Tabby (Gulf) is a pay-in-instalments method → record the booking as BNPL.
    const paymentMethod = notes.methodGroup === 'tabby' ? 'BNPL' : 'FULL';

    const booking = await this.bookings.create({
      userId: payment.userId,
      hospitalId: notes.hospitalId,
      reportId: notes.reportId ?? undefined,
      plan: notes.plan,
      totalAmount: payment.amount,
      currency: payment.currency,
      paymentRef: payment.razorpayPaymentId ?? payment.razorpayOrderId,
      paymentMethod,
      downPayment: extra?.downPayment ?? notes.downPayment ?? undefined,
      installments: extra?.installments ?? notes.installments ?? undefined,
    });

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { bookingId: booking.bookingId },
    });
    return booking.bookingId;
  }

  // Status state machine — every transition is a conditional update, so out-of-order
  // or replayed webhooks that don't match the expected `from` state are no-ops.
  private async applyEvent(paymentId: string, type: string, entity: any) {
    switch (type) {
      case 'payment.authorized':
        await this.prisma.payment.updateMany({
          where: { id: paymentId, status: 'CREATED' },
          data: { status: 'AUTHORIZED' },
        });
        break;
      case 'payment.captured':
      case 'order.paid': {
        const won = await this.markCaptured(paymentId, {
          paymentId: entity.id,
          method: entity.method,
        });
        if (won) await this.fulfil(paymentId); // fallback if sync verify never ran
        break;
      }
      case 'payment.failed':
        await this.prisma.payment.updateMany({
          where: { id: paymentId, status: { in: ['CREATED', 'AUTHORIZED'] } },
          data: { status: 'FAILED', failureReason: entity.error_description ?? 'failed' },
        });
        break;
      case 'refund.created':
      case 'refund.processed':
        await this.prisma.payment.updateMany({
          where: { id: paymentId, status: { in: ['CAPTURED', 'DISPUTED'] } },
          data: { status: 'REFUNDED' },
        });
        break;
      case 'payment.dispute.created':
        await this.prisma.payment.updateMany({
          where: { id: paymentId, status: 'CAPTURED' },
          data: { status: 'DISPUTED' },
        });
        break;
      case 'payment.dispute.lost':
        await this.prisma.payment.updateMany({
          where: { id: paymentId, status: 'DISPUTED' },
          data: { status: 'REFUNDED' },
        });
        break;
      case 'payment.dispute.won':
        await this.prisma.payment.updateMany({
          where: { id: paymentId, status: 'DISPUTED' },
          data: { status: 'CAPTURED' },
        });
        break;
      default:
        this.log.debug(`Unhandled webhook event ${type}`);
    }
  }
}
