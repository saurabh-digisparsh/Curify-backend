// Shared travel-date rules for the intake chat's "expected date of travel" step.
// Single source of truth so the AI parse endpoint and the journey save agree.

export const MIN_LEAD_DAYS = 7; // earliest bookable date: today + 7
export const MAX_LEAD_DAYS = 365; // latest: today + 1 year
export const URGENT_DAYS = 30; // travel sooner than this is flagged "urgent"

/** Whole calendar days from `now` until `date` (ceil so "in 12h" counts as 1). */
export function daysUntil(date: Date, now = new Date()): number {
  return Math.ceil((date.getTime() - now.getTime()) / 86_400_000);
}

/** Travel within URGENT_DAYS (and not in the past) → staff-prioritize. */
export function deriveUrgent(date: Date, now = new Date()): boolean {
  const d = daysUntil(date, now);
  return d >= 0 && d < URGENT_DAYS;
}

/** Clamp a date into the bookable window [today+MIN, today+MAX]. */
export function clampTravelDate(date: Date, now = new Date()): Date {
  const min = new Date(now.getTime() + MIN_LEAD_DAYS * 86_400_000);
  const max = new Date(now.getTime() + MAX_LEAD_DAYS * 86_400_000);
  if (date < min) return min;
  if (date > max) return max;
  return date;
}
