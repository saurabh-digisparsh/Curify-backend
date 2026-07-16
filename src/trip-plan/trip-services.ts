/**
 * Trip service orchestration — the "Generate My Trip" checklist.
 *
 * Each external step (visa / flight / hotel / cab) is a *booking intent* we hand
 * off to a vendor via a prefilled deep-link, then confirm back into the journey.
 * None of these vendors expose a bookable API without a signed partnership
 * (verified: MakeMyTrip = no public API, Booking.com Demand API = approval-gated,
 * Uber = deep-links are the *recommended* path, Indian e-Visa gov = no API at all).
 *
 * So the seam below targets a real API but ships a `redirect` implementation now.
 * When a partnership lands, swap ONE builder's `integration` to 'api' and return a
 * booked reference instead of a link — the flow, statuses and UI stay unchanged.
 *
 * ponytail: plain link-builder functions in a map, not a factory/interface — the
 * only real variability is the URL per vendor, and the swap-to-API need is stated,
 * not speculative.
 */

export type ServiceType = 'quotation' | 'visa' | 'flight' | 'hotel' | 'cab';
export type ServiceStatus = 'not_started' | 'pending' | 'confirmed' | 'skipped';

export interface TripServiceStep {
  type: ServiceType;
  title: string;
  provider: string;
  /** 'internal' = we own it; 'redirect' = interim deep-link; becomes 'api' post-partnership. */
  integration: 'internal' | 'redirect';
  required: boolean;
  status: ServiceStatus;
  /** null for internal steps (quotation). */
  deepLinkUrl: string | null;
  note: string;
  /** USD contribution to the trip total, when known. */
  estimate?: number;
}

// ── City → airport lookup (Indian hospital destinations) ──────────────────────
// Used for flight deep-links and Uber airport pickup. Small and explicit; extend
// as new hospital cities onboard.
const AIRPORTS: Record<string, { iata: string; address: string }> = {
  delhi: { iata: 'DEL', address: 'Indira Gandhi International Airport (DEL), New Delhi' },
  gurgaon: { iata: 'DEL', address: 'Indira Gandhi International Airport (DEL), New Delhi' },
  gurugram: { iata: 'DEL', address: 'Indira Gandhi International Airport (DEL), New Delhi' },
  noida: { iata: 'DEL', address: 'Indira Gandhi International Airport (DEL), New Delhi' },
  chennai: { iata: 'MAA', address: 'Chennai International Airport (MAA)' },
  mumbai: { iata: 'BOM', address: 'Chhatrapati Shivaji Maharaj International Airport (BOM), Mumbai' },
  bengaluru: { iata: 'BLR', address: 'Kempegowda International Airport (BLR), Bengaluru' },
  bangalore: { iata: 'BLR', address: 'Kempegowda International Airport (BLR), Bengaluru' },
  hyderabad: { iata: 'HYD', address: 'Rajiv Gandhi International Airport (HYD), Hyderabad' },
  kolkata: { iata: 'CCU', address: 'Netaji Subhas Chandra Bose International Airport (CCU), Kolkata' },
  ahmedabad: { iata: 'AMD', address: 'Sardar Vallabhbhai Patel International Airport (AMD), Ahmedabad' },
  kochi: { iata: 'COK', address: 'Cochin International Airport (COK), Kochi' },
  pune: { iata: 'PNQ', address: 'Pune International Airport (PNQ)' },
  jaipur: { iata: 'JAI', address: 'Jaipur International Airport (JAI)' },
};

/** Normalize "Gurgaon (Delhi NCR)" → "gurgaon" and look up the airport. */
export function airportFor(city: string) {
  const key = city.split('(')[0].trim().toLowerCase();
  return AIRPORTS[key] ?? null;
}

// ── Date helpers (backend runtime — Date is fine here) ────────────────────────
function parseDate(iso?: string): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}
function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}
const ymd = (d: Date) => d.toISOString().slice(0, 10); // YYYY-MM-DD
const dmy = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; // DD/MM/YYYY (MakeMyTrip)

// ── Vendor deep-link builders (interim redirect implementations) ──────────────
// pending partnership → real API. Affiliate/API params are appended here later.
const links = {
  /** Official Indian e-Visa portal — the ONLY sanctioned path (no API exists). */
  visa: () => 'https://indianvisaonline.gov.in/evisa/tvoa.html',

  /** Atlys — assisted-visa partner already referenced in the app. */
  atlys: () => 'https://www.atlys.com/en/country/india',

  /** MakeMyTrip flight search. Full deep-link only when both airports resolve to
   *  IATA; otherwise the flights landing page. ponytail: precise multi-leg / pax
   *  prefill and price pull-back need the real API — this just seeds the search. */
  flight: (fromCity: string, toCity: string, when: Date | null, pax: number) => {
    const from = airportFor(fromCity);
    const to = airportFor(toCity);
    if (from && to && when) {
      const itinerary = `${from.iata}-${to.iata}-${dmy(when)}`;
      return `https://www.makemytrip.com/flight/search?itinerary=${itinerary}&tripType=O&paxType=A-${pax}_C-0_I-0&intl=true&cabinClass=E`;
    }
    return 'https://www.makemytrip.com/flights/';
  },

  /** Booking.com search — works without affiliate; add `aid` when approved. */
  hotel: (city: string, checkin: Date | null, checkout: Date | null, adults: number) => {
    const p = new URLSearchParams({ ss: `${city}, India`, group_adults: String(adults || 1) });
    if (checkin) p.set('checkin', ymd(checkin));
    if (checkout) p.set('checkout', ymd(checkout));
    return `https://www.booking.com/searchresults.html?${p.toString()}`;
  },

  /** Uber universal link (the officially recommended integration). Drops the
   *  rider at the hospital using its stored coordinates; pickup = arrival airport. */
  cab: (pickupAddress: string, hospital: { name: string; latitude?: number | null; longitude?: number | null; address?: string | null }) => {
    const p = new URLSearchParams({ action: 'setPickup' });
    p.set('pickup[formatted_address]', pickupAddress);
    if (hospital.latitude != null && hospital.longitude != null) {
      p.set('dropoff[latitude]', String(hospital.latitude));
      p.set('dropoff[longitude]', String(hospital.longitude));
    }
    p.set('dropoff[formatted_address]', hospital.address || `${hospital.name}`);
    p.set('dropoff[nickname]', hospital.name);
    return `https://m.uber.com/ul/?${p.toString()}`;
  },
};

/**
 * Assemble the ordered service checklist for a trip. Steps are ordered by
 * real-world dependency: quotation anchors cost/date → visa gates travel →
 * flight → optional hotel/cab. Costs are estimates (redirect model can't read
 * back a real fare until the vendor API is wired).
 */
export function buildServiceSteps(input: {
  hospital: { name: string; city: string; latitude?: number | null; longitude?: number | null; address?: string | null };
  departureCity: string;
  travelDate?: string;
  travelers?: number;
  stayNights?: number;
  flightEstimate?: number;
  hotelEstimate?: number;
}): TripServiceStep[] {
  const pax = input.travelers && input.travelers > 0 ? input.travelers : 1;
  const nights = input.stayNights && input.stayNights > 0 ? input.stayNights : 0;
  const arrival = parseDate(input.travelDate);
  const departure = arrival && nights ? addDays(arrival, nights) : null;
  const airport = airportFor(input.hospital.city);

  return [
    {
      type: 'quotation',
      title: 'Hospital quotation',
      provider: input.hospital.name,
      integration: 'internal',
      required: true,
      status: 'not_started',
      deepLinkUrl: null,
      note: 'Confirm the doctor-quoted treatment cost — this anchors your trip budget and dates.',
    },
    {
      type: 'visa',
      title: 'India e-Visa',
      provider: 'Indian e-Visa (official)',
      integration: 'redirect',
      required: true,
      status: 'not_started',
      deepLinkUrl: links.visa(),
      note: 'Apply on the official portal, then upload your granted e-Visa here so we can validate it. Prefer assistance? Atlys can handle it.',
      estimate: 25,
    },
    {
      type: 'flight',
      title: 'Flights',
      provider: 'MakeMyTrip',
      integration: 'redirect',
      required: true,
      status: 'not_started',
      deepLinkUrl: links.flight(input.departureCity, input.hospital.city, arrival, pax),
      note: 'Search is prefilled for your route and travel date. Book, then mark confirmed / upload your ticket.',
      estimate: input.flightEstimate,
    },
    {
      type: 'hotel',
      title: 'Accommodation',
      provider: 'Booking.com',
      integration: 'redirect',
      required: false,
      status: 'not_started',
      deepLinkUrl: links.hotel(input.hospital.city, arrival, departure, pax),
      note: 'Optional — many patients stay in hospital-partnered recovery housing. Prefilled for your stay dates.',
      estimate: input.hotelEstimate,
    },
    {
      type: 'cab',
      title: 'Airport transfer',
      provider: 'Uber',
      integration: 'redirect',
      required: false,
      status: 'not_started',
      deepLinkUrl: links.cab(airport?.address || `${input.hospital.city} Airport`, input.hospital),
      note: 'Optional — one-tap ride from the airport to the hospital on arrival.',
    },
  ];
}

export const atlysVisaLink = links.atlys;

/** Canonical provider label per step type — used when persisting a step the
 *  patient acted on (quotation is overridden with the hospital name upstream). */
export const PROVIDERS: Record<ServiceType, string> = {
  quotation: 'Hospital',
  visa: 'Indian e-Visa (official)',
  flight: 'MakeMyTrip',
  hotel: 'Booking.com',
  cab: 'Uber',
};

export function isServiceType(t: string): t is ServiceType {
  return t in PROVIDERS;
}

/**
 * Validate an uploaded India e-Visa. HONEST SCOPE: the government exposes no
 * verification API, so this is a *consistency* check on the patient-supplied
 * fields (number present, expiry readable and after travel), never a claim that
 * the visa is genuine. The `note` says so and is surfaced to the patient.
 */
export function validateVisa(f: { visaNumber?: string; visaExpiry?: string; travelDate?: string }) {
  const checkedAt = new Date().toISOString();
  const note = 'Consistency check only — not a government verification.';
  if (!f.visaNumber || f.visaNumber.trim().length < 6) {
    return { valid: false, checkedAt, note, reason: 'Visa / application number looks incomplete.' };
  }
  const expiry = f.visaExpiry ? new Date(f.visaExpiry) : null;
  if (!expiry || isNaN(expiry.getTime())) {
    return { valid: false, checkedAt, note, reason: 'Could not read the visa expiry date.' };
  }
  const mustCover = f.travelDate ? new Date(f.travelDate) : new Date();
  if (expiry <= mustCover) {
    return { valid: false, checkedAt, note, reason: 'Visa expires on or before your travel date.' };
  }
  return { valid: true, checkedAt, note };
}

// ── Deterministic itinerary (replaces the static template) ────────────────────
// Built from real inputs — travel date, stay length, standard lead times — so it
// is instant and always consistent. AI is used only to enrich descriptions/tips
// (best-effort, off the critical path). ponytail: recovery-day count is a simple
// stay-based split; a per-procedure protocol table can refine it later.
export interface TimelineEvent {
  day: number;
  phase: string;
  title: string;
  description: string;
  icon: string;
  status: 'upcoming';
}

export function buildTimeline(params: { treatment: string; stayNights?: number }): TimelineEvent[] {
  const stay = params.stayNights && params.stayNights > 0 ? params.stayNights : 14;
  const returnDay = stay; // arrival = day 0
  const events: TimelineEvent[] = [
    { day: -14, phase: 'preparation', title: 'Confirm visa & flights', description: 'Apply for your India e-Visa and book flights. Upload documents so your coordinator can verify them.', icon: '🛂', status: 'upcoming' },
    { day: -3, phase: 'preparation', title: 'Pre-travel teleconsult', description: 'Video call with your pre-op coordinator to review fitness-to-fly and final instructions.', icon: '💬', status: 'upcoming' },
    { day: 0, phase: 'arrival', title: 'Arrival & transfer', description: 'Land in India and take your airport transfer to the hospital or recovery housing.', icon: '✈️', status: 'upcoming' },
    { day: 1, phase: 'pre-surgery', title: 'Consultation & pre-op checks', description: 'In-person consult, diagnostics and anaesthesia clearance.', icon: '🩺', status: 'upcoming' },
    { day: 2, phase: 'surgery', title: `${params.treatment || 'Procedure'}`, description: 'Your surgery day. Family updates are sent from theatre to recovery.', icon: '🏥', status: 'upcoming' },
    { day: Math.max(3, Math.floor(returnDay / 2)), phase: 'recovery', title: 'Recovery & physiotherapy', description: 'Monitored recovery, wound care and guided rehabilitation.', icon: '🌡️', status: 'upcoming' },
    { day: returnDay - 1, phase: 'return', title: 'Fitness-to-fly review', description: 'Final review and clearance to travel home.', icon: '📋', status: 'upcoming' },
    { day: returnDay, phase: 'return', title: 'Return home', description: 'Depart India with your medical summary and medication.', icon: '🏡', status: 'upcoming' },
    { day: returnDay + 30, phase: 'follow-up', title: 'Follow-up teleconsult', description: 'Remote check-in with your surgeon to confirm healing is on track.', icon: '📞', status: 'upcoming' },
  ];
  return events;
}
