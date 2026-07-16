import { buildServiceSteps, buildTimeline, airportFor } from './trip-services';

// ponytail: one runnable check for the money/link logic — fails loudly if the
// step ordering, deep-link prefill, or airport lookup regress.
describe('trip-services', () => {
  const hospital = { name: 'Apollo', city: 'Chennai', latitude: 13.0, longitude: 80.2, address: '21 Greams Rd' };

  it('orders steps quotation → visa → flight → hotel → cab', () => {
    const steps = buildServiceSteps({ hospital, departureCity: 'Lagos', travelDate: '2026-09-01', travelers: 2, stayNights: 10 });
    expect(steps.map(s => s.type)).toEqual(['quotation', 'visa', 'flight', 'hotel', 'cab']);
    expect(steps[0].integration).toBe('internal');
    expect(steps.find(s => s.type === 'visa')!.required).toBe(true);
    expect(steps.find(s => s.type === 'hotel')!.required).toBe(false);
  });

  it('prefills MakeMyTrip with resolved airports + date, Booking with stay dates', () => {
    const steps = buildServiceSteps({ hospital, departureCity: 'Delhi', travelDate: '2026-09-01', travelers: 1, stayNights: 5 });
    const flight = steps.find(s => s.type === 'flight')!.deepLinkUrl!;
    expect(flight).toContain('DEL-MAA-01/09/2026'); // Delhi → Chennai on the travel date
    const hotel = steps.find(s => s.type === 'hotel')!.deepLinkUrl!;
    expect(hotel).toContain('checkin=2026-09-01');
    expect(hotel).toContain('checkout=2026-09-06'); // +5 nights
    const cab = steps.find(s => s.type === 'cab')!.deepLinkUrl!;
    expect(cab).toContain('dropoff%5Blatitude%5D=13'); // hospital coords drive the Uber dropoff
  });

  it('falls back to the MMT landing page when an airport is unknown', () => {
    const steps = buildServiceSteps({ hospital, departureCity: 'Nowhereville', travelDate: '2026-09-01' });
    expect(steps.find(s => s.type === 'flight')!.deepLinkUrl).toBe('https://www.makemytrip.com/flights/');
  });

  it('builds a chronologically ordered timeline ending in follow-up', () => {
    const t = buildTimeline({ treatment: 'ACL Repair', stayNights: 14 });
    const days = t.map(e => e.day);
    expect(days).toEqual([...days].sort((a, b) => a - b)); // sorted ascending
    expect(t[t.length - 1].phase).toBe('follow-up');
  });

  it('resolves NCR variants to DEL', () => {
    expect(airportFor('Gurgaon (Delhi NCR)')!.iata).toBe('DEL');
    expect(airportFor('Atlantis')).toBeNull();
  });
});
