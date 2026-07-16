"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROVIDERS = exports.atlysVisaLink = void 0;
exports.airportFor = airportFor;
exports.buildServiceSteps = buildServiceSteps;
exports.isServiceType = isServiceType;
exports.validateVisa = validateVisa;
exports.buildTimeline = buildTimeline;
const AIRPORTS = {
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
function airportFor(city) {
    const key = city.split('(')[0].trim().toLowerCase();
    return AIRPORTS[key] ?? null;
}
function parseDate(iso) {
    if (!iso)
        return null;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
}
function addDays(d, n) {
    const c = new Date(d);
    c.setDate(c.getDate() + n);
    return c;
}
const ymd = (d) => d.toISOString().slice(0, 10);
const dmy = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
const links = {
    visa: () => 'https://indianvisaonline.gov.in/evisa/tvoa.html',
    atlys: () => 'https://www.atlys.com/en/country/india',
    flight: (fromCity, toCity, when, pax) => {
        const from = airportFor(fromCity);
        const to = airportFor(toCity);
        if (from && to && when) {
            const itinerary = `${from.iata}-${to.iata}-${dmy(when)}`;
            return `https://www.makemytrip.com/flight/search?itinerary=${itinerary}&tripType=O&paxType=A-${pax}_C-0_I-0&intl=true&cabinClass=E`;
        }
        return 'https://www.makemytrip.com/flights/';
    },
    hotel: (city, checkin, checkout, adults) => {
        const p = new URLSearchParams({ ss: `${city}, India`, group_adults: String(adults || 1) });
        if (checkin)
            p.set('checkin', ymd(checkin));
        if (checkout)
            p.set('checkout', ymd(checkout));
        return `https://www.booking.com/searchresults.html?${p.toString()}`;
    },
    cab: (pickupAddress, hospital) => {
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
function buildServiceSteps(input) {
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
exports.atlysVisaLink = links.atlys;
exports.PROVIDERS = {
    quotation: 'Hospital',
    visa: 'Indian e-Visa (official)',
    flight: 'MakeMyTrip',
    hotel: 'Booking.com',
    cab: 'Uber',
};
function isServiceType(t) {
    return t in exports.PROVIDERS;
}
function validateVisa(f) {
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
function buildTimeline(params) {
    const stay = params.stayNights && params.stayNights > 0 ? params.stayNights : 14;
    const returnDay = stay;
    const events = [
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
//# sourceMappingURL=trip-services.js.map