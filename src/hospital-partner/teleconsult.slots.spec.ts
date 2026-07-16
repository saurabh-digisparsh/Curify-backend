import { zonedWallToUtc, slotStarts } from './teleconsult.service';

// The slot engine turns "HH:mm on weekday N in the doctor's tz" into UTC instants;
// getting the timezone/DST conversion wrong would book patients at the wrong hour.
describe('teleconsult slot math', () => {
  it('converts a wall-clock time in an IANA tz to the right UTC instant', () => {
    // Asia/Kolkata is a fixed +05:30 (no DST).
    expect(zonedWallToUtc(2026, 6, 20, 9, 0, 'Asia/Kolkata').toISOString()).toBe('2026-07-20T03:30:00.000Z');
    // New York honours DST: January is EST (−5), July is EDT (−4).
    expect(zonedWallToUtc(2026, 0, 15, 14, 30, 'America/New_York').toISOString()).toBe('2026-01-15T19:30:00.000Z');
    expect(zonedWallToUtc(2026, 6, 15, 14, 30, 'America/New_York').toISOString()).toBe('2026-07-15T18:30:00.000Z');
  });

  it('chunks a window into 30-min starts, dropping a partial tail', () => {
    expect([...slotStarts('09:00', '10:00')]).toEqual([[9, 0], [9, 30]]);
    expect([...slotStarts('09:00', '09:20')]).toEqual([]);
  });
});
