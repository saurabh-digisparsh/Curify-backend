import { TeleconsultStatus } from '@prisma/client';
import { TeleconsultService } from './teleconsult.service';

/**
 * The money gate: 2 free consultations per journey, pay from the 3rd. These check
 * the decision itself (how many are used → is the next one paid), because the
 * client is never trusted for it and getting the count wrong either gives calls
 * away or charges for one that should be free.
 */
describe('TeleconsultService — free consultation allowance', () => {
  // Fake DB holding one journey's consults; count() applies the same status +
  // journey filter the service asks for.
  function build(rows: { status: TeleconsultStatus; journeyId: string | null }[], fee = 49) {
    const prisma: any = {
      teleconsult: {
        count: async ({ where }: any) =>
          rows.filter(
            (r) => r.journeyId === where.journeyId && where.status.in.includes(r.status),
          ).length,
      },
    };
    const settings: any = { getNumber: async () => fee };
    return new TeleconsultService(prisma, {} as any, {} as any, settings);
  }
  const on = (n: number, status: TeleconsultStatus, journeyId: string | null = 'j1') =>
    Array.from({ length: n }, () => ({ status, journeyId }));

  it('first two consultations on a journey are free', async () => {
    const none = await build([]).quota('u1', 'j1');
    expect(none).toMatchObject({ used: 0, remaining: 2, requiresPayment: false });

    const one = await build(on(1, TeleconsultStatus.SCHEDULED)).quota('u1', 'j1');
    expect(one).toMatchObject({ used: 1, remaining: 1, requiresPayment: false });
  });

  it('charges for the third consultation onwards', async () => {
    const two = await build(on(2, TeleconsultStatus.COMPLETED)).quota('u1', 'j1');
    expect(two).toMatchObject({ used: 2, remaining: 0, requiresPayment: true, fee: 49 });

    // Never goes negative, and stays paid well past the limit.
    const five = await build(on(5, TeleconsultStatus.COMPLETED)).quota('u1', 'j1');
    expect(five).toMatchObject({ remaining: 0, requiresPayment: true });
  });

  it('cancelling hands the free consultation back', async () => {
    const q = await build([
      ...on(1, TeleconsultStatus.COMPLETED),
      ...on(3, TeleconsultStatus.CANCELLED),
    ]).quota('u1', 'j1');
    expect(q).toMatchObject({ used: 1, remaining: 1, requiresPayment: false });
  });

  it('a doctor-side cancellation costs the patient nothing', async () => {
    // The patient must never pay for a call the hospital called off: a consult
    // cancelled by the DOCTOR is CANCELLED like any other, so it stays outside the
    // allowance and the next booking is still free.
    const q = await build([
      ...on(1, TeleconsultStatus.COMPLETED),
      ...on(1, TeleconsultStatus.CANCELLED), // doctor pulled out of this one
    ]).quota('u1', 'j1');
    expect(q).toMatchObject({ used: 1, remaining: 1, requiresPayment: false });
  });

  it('a slot held mid-checkout does not burn a free consultation', async () => {
    // PENDING_PAYMENT is a PAID consult being paid for — if an abandoned one
    // counted, the patient would silently lose a free call.
    const q = await build([
      ...on(1, TeleconsultStatus.SCHEDULED),
      ...on(2, TeleconsultStatus.PENDING_PAYMENT),
    ]).quota('u1', 'j1');
    expect(q).toMatchObject({ used: 1, remaining: 1, requiresPayment: false });
  });

  it('the allowance is per journey, not shared across journeys', async () => {
    const rows = [...on(2, TeleconsultStatus.COMPLETED, 'j1'), ...on(2, TeleconsultStatus.COMPLETED, 'j2')];
    expect(await build(rows).quota('u1', 'j1')).toMatchObject({ used: 2, requiresPayment: true });
    // A brand-new journey starts fresh with its own two free consultations.
    expect(await build(rows).quota('u1', 'j3')).toMatchObject({ used: 0, requiresPayment: false });
  });

  it('consults with no journey share one bucket keyed on the patient', async () => {
    const q = await build(on(2, TeleconsultStatus.COMPLETED, null)).quota('u1', undefined);
    expect(q).toMatchObject({ used: 2, requiresPayment: true });
  });

  it('a zero fee keeps every consultation free (admin kill-switch)', async () => {
    // Guards against charging $0: with the fee off we must not send the patient
    // into a checkout for nothing.
    const q = await build(on(9, TeleconsultStatus.COMPLETED), 0).quota('u1', 'j1');
    expect(q).toMatchObject({ remaining: 0, requiresPayment: false });
  });
});
