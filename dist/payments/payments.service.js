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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var PaymentsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const Razorpay = require("razorpay");
const prisma_service_1 = require("../prisma/prisma.service");
const bookings_service_1 = require("../bookings/bookings.service");
const settings_service_1 = require("../admin/settings/settings.service");
const teleconsult_service_1 = require("../hospital-partner/teleconsult.service");
const razorpay_provider_1 = require("./razorpay.provider");
const PLAN_PRICES = {
    ESSENTIAL: 19900,
    COMFORT: 29900,
    PREMIUM: 49900,
};
const METHOD_CONFIG = {
    card: { card: true, wallet: true },
    tabby: undefined,
    all: undefined,
};
let PaymentsService = PaymentsService_1 = class PaymentsService {
    constructor(rzp, prisma, bookings, settings, teleconsults) {
        this.rzp = rzp;
        this.prisma = prisma;
        this.bookings = bookings;
        this.settings = settings;
        this.teleconsults = teleconsults;
        this.log = new common_1.Logger(PaymentsService_1.name);
        this.currency = process.env.RAZORPAY_CURRENCY || 'USD';
        this.capture = (process.env.PAYMENTS_CAPTURE_MODE || 'auto') === 'auto' ? 1 : 0;
    }
    async createTeleconsultOrder(userId, teleconsultId) {
        const tc = await this.prisma.teleconsult.findUnique({
            where: { id: teleconsultId },
            select: { id: true, patientId: true, status: true, holdExpiresAt: true, scheduledAt: true },
        });
        if (!tc || tc.patientId !== userId)
            throw new common_1.NotFoundException('Consultation not found');
        if (tc.status !== 'PENDING_PAYMENT') {
            throw new common_1.BadRequestException('This consultation does not need payment.');
        }
        if (tc.holdExpiresAt && tc.holdExpiresAt.getTime() <= Date.now()) {
            throw new common_1.BadRequestException('Your slot hold expired. Please pick a time again.');
        }
        const fee = await this.settings.getNumber('TELECONSULT_FEE');
        if (!Number.isFinite(fee) || fee <= 0) {
            throw new common_1.BadRequestException('Paid consultations are not available right now.');
        }
        const amount = Math.round(fee * 100);
        const order = await this.rzp.orders.create({
            amount,
            currency: this.currency,
            receipt: `curify_tc_${teleconsultId.slice(0, 8)}_${Date.now()}`,
            payment_capture: this.capture,
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
    async createOrder(userId, dto) {
        const amount = PLAN_PRICES[dto.plan];
        if (!amount)
            throw new common_1.BadRequestException('Unknown plan');
        const hospital = await this.prisma.hospital.findUnique({ where: { id: dto.hospitalId } });
        if (!hospital)
            throw new common_1.NotFoundException('Hospital not found');
        const methodGroup = dto.methodGroup ?? 'all';
        const order = await this.rzp.orders.create({
            amount,
            currency: this.currency,
            receipt: `curify_${userId.slice(0, 8)}_${Date.now()}`,
            payment_capture: this.capture,
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
        return {
            orderId: order.id,
            amount,
            currency: this.currency,
            keyId: process.env.RAZORPAY_KEY_ID,
            method: METHOD_CONFIG[methodGroup],
        };
    }
    async verify(userId, dto) {
        const payment = await this.prisma.payment.findUnique({
            where: { razorpayOrderId: dto.razorpay_order_id },
        });
        if (!payment || payment.userId !== userId)
            throw new common_1.NotFoundException('Payment not found');
        const valid = this.verifySignature(dto.razorpay_order_id, dto.razorpay_payment_id, dto.razorpay_signature);
        if (!valid) {
            await this.prisma.payment.updateMany({
                where: { id: payment.id, status: 'CREATED' },
                data: { status: 'FAILED', failureReason: 'signature_mismatch' },
            });
            throw new common_1.BadRequestException('Payment signature verification failed');
        }
        const won = await this.markCaptured(payment.id, {
            paymentId: dto.razorpay_payment_id,
            signature: dto.razorpay_signature,
        });
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
    async handleWebhook(rawBody, signature, eventId) {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
        const expected = (0, crypto_1.createHmac)('sha256', secret).update(rawBody).digest('hex');
        const ok = !!signature &&
            signature.length === expected.length &&
            (0, crypto_1.timingSafeEqual)(Buffer.from(signature), Buffer.from(expected));
        if (!ok)
            throw new common_1.BadRequestException('Invalid webhook signature');
        const body = JSON.parse(rawBody);
        const type = body.event;
        const entity = body.payload?.payment?.entity ??
            body.payload?.order?.entity ??
            body.payload?.refund?.entity ??
            {};
        const orderId = entity.order_id ?? entity.id;
        const paymentId = body.payload?.payment?.entity?.id;
        const payment = await this.prisma.payment.findFirst({
            where: orderId
                ? { OR: [{ razorpayOrderId: orderId }, { razorpayPaymentId: orderId }] }
                : { razorpayPaymentId: paymentId },
        });
        if (!payment) {
            this.log.warn(`Webhook ${type} for unknown order/payment ${orderId ?? paymentId} — ignored`);
            return { ignored: true };
        }
        try {
            await this.prisma.paymentEvent.create({
                data: { paymentId: payment.id, eventId: eventId ?? `${type}:${paymentId ?? orderId}`, type, payload: body },
            });
        }
        catch (e) {
            if (e?.code === 'P2002')
                return { duplicate: true };
            throw e;
        }
        await this.applyEvent(payment.id, type, entity);
        return { ok: true };
    }
    verifySignature(orderId, paymentId, signature) {
        const expected = (0, crypto_1.createHmac)('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${orderId}|${paymentId}`)
            .digest('hex');
        const a = Buffer.from(expected);
        const b = Buffer.from(signature);
        return a.length === b.length && (0, crypto_1.timingSafeEqual)(a, b);
    }
    async markCaptured(paymentId, data) {
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
    async fulfil(paymentId, extra) {
        const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
        const notes = (payment?.notes ?? {});
        if (notes.purpose === 'TELECONSULT') {
            await this.teleconsults.activatePaidConsult(notes.teleconsultId, paymentId);
            return null;
        }
        return this.confirmBooking(paymentId, extra);
    }
    async confirmBooking(paymentId, extra) {
        const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
        if (!payment)
            return null;
        if (payment.bookingId)
            return payment.bookingId;
        const notes = (payment.notes ?? {});
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
    async applyEvent(paymentId, type, entity) {
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
                if (won)
                    await this.fulfil(paymentId);
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
};
exports.PaymentsService = PaymentsService;
exports.PaymentsService = PaymentsService = PaymentsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(razorpay_provider_1.RAZORPAY_CLIENT)),
    __metadata("design:paramtypes", [Razorpay,
        prisma_service_1.PrismaService,
        bookings_service_1.BookingsService,
        settings_service_1.SettingsService,
        teleconsult_service_1.TeleconsultService])
], PaymentsService);
//# sourceMappingURL=payments.service.js.map