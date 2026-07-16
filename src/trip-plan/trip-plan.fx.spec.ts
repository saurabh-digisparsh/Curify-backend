import { quoteToUsd } from './trip-plan.service';

// The doctor may quote in EUR/GBP/INR/AED/NGN; the trip plan is USD, so a wrong
// conversion would put a wildly-off treatment cost in front of the patient.
describe('quoteToUsd', () => {
  it('passes USD through and converts other currencies', () => {
    expect(quoteToUsd(5000, 'USD')).toBe(5000);
    expect(quoteToUsd(5000, 'EUR')).toBe(5400);    // 5000 * 1.08
    expect(quoteToUsd(100000, 'INR')).toBe(1200);  // 100000 * 0.012
    expect(quoteToUsd(1000, 'aed')).toBe(272);     // case-insensitive: 1000 * 0.2723 → 272
  });

  it('treats unknown or blank currency as USD (rate 1)', () => {
    expect(quoteToUsd(1000)).toBe(1000);
    expect(quoteToUsd(1000, 'ZZZ')).toBe(1000);
  });
});
