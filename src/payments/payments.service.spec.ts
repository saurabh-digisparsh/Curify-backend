import { createHmac } from 'crypto';
import { PaymentsService } from './payments.service';

// Money-path self-check (ponytail rule): the two invariants that must hold or the
// ledger corrupts — (1) a replayed webhook confirms the booking exactly once,
// (2) an illegal status transition (FAILED after CAPTURED) is a no-op.
describe('PaymentsService webhook idempotency + state machine', () => {
  const SECRET = 'testsecret';
  process.env.RAZORPAY_WEBHOOK_SECRET = SECRET;
  process.env.RAZORPAY_KEY_SECRET = 'k';
  process.env.RAZORPAY_KEY_ID = 'rzp_test_x';

  function sign(body: string) {
    return createHmac('sha256', SECRET).update(body).digest('hex');
  }

  function build() {
    const payment: any = {
      id: 'p1',
      status: 'CREATED',
      bookingId: null,
      notes: { methodGroup: 'card', plan: 'COMFORT', hospitalId: 'h1' },
      razorpayOrderId: 'order_1',
      razorpayPaymentId: null,
      amount: 29900,
      currency: 'INR',
      userId: 'u1',
    };
    const events = new Set<string>();
    let bookingCreates = 0;

    const prisma: any = {
      payment: {
        findFirst: async () => ({ ...payment }),
        findUnique: async () => ({ ...payment }),
        updateMany: async ({ where, data }: any) => {
          let match = payment.id === where.id;
          if (where.status?.in) match = match && where.status.in.includes(payment.status);
          else if (typeof where.status === 'string') match = match && payment.status === where.status;
          if (!match) return { count: 0 };
          Object.assign(payment, data);
          return { count: 1 };
        },
        update: async ({ data }: any) => {
          Object.assign(payment, data);
          return { ...payment };
        },
      },
      paymentEvent: {
        create: async ({ data }: any) => {
          if (events.has(data.eventId)) {
            const e: any = new Error('duplicate');
            e.code = 'P2002';
            throw e;
          }
          events.add(data.eventId);
          return { id: 'e', ...data };
        },
      },
    };
    const bookings: any = {
      create: async () => {
        bookingCreates++;
        return { bookingId: 'b1', paymentRef: 'pay_1', status: 'CONFIRMED' };
      },
    };
    // Settings + teleconsults are only reached by TELECONSULT-purpose payments;
    // these fixtures are plan payments, so stubs that would throw if used are fine.
    const settings: any = { getNumber: async () => 49 };
    const teleconsults: any = {
      activatePaidConsult: async () => {
        throw new Error('plan payments must not touch the teleconsult path');
      },
    };
    const svc = new PaymentsService({} as any, prisma, bookings, settings, teleconsults);
    return { svc, payment, get creates() { return bookingCreates; } };
  }

  const capturedBody = JSON.stringify({
    event: 'payment.captured',
    payload: { payment: { entity: { id: 'pay_1', order_id: 'order_1', method: 'card' } } },
  });

  it('replaying the same captured webhook confirms the booking exactly once', async () => {
    const t = build();
    const sig = sign(capturedBody);

    const first = await t.svc.handleWebhook(capturedBody, sig, 'evt_1');
    expect(first).toEqual({ ok: true });
    expect(t.payment.status).toBe('CAPTURED');
    expect(t.payment.bookingId).toBe('b1');

    const replay = await t.svc.handleWebhook(capturedBody, sig, 'evt_1');
    expect(replay).toEqual({ duplicate: true });
    expect(t.creates).toBe(1); // booking created only once
  });

  it('rejects an out-of-order payment.failed after CAPTURED (no-op)', async () => {
    const t = build();
    await t.svc.handleWebhook(capturedBody, sign(capturedBody), 'evt_1');
    expect(t.payment.status).toBe('CAPTURED');

    const failedBody = JSON.stringify({
      event: 'payment.failed',
      payload: { payment: { entity: { id: 'pay_1', order_id: 'order_1', error_description: 'x' } } },
    });
    await t.svc.handleWebhook(failedBody, sign(failedBody), 'evt_2');
    expect(t.payment.status).toBe('CAPTURED'); // stays captured; illegal transition ignored
  });

  it('rejects a webhook with a bad signature', async () => {
    const t = build();
    await expect(t.svc.handleWebhook(capturedBody, 'deadbeef', 'evt_9')).rejects.toThrow();
  });
});
