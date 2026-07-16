export type ServiceType = 'quotation' | 'visa' | 'flight' | 'hotel' | 'cab';
export type ServiceStatus = 'not_started' | 'pending' | 'confirmed' | 'skipped';
export interface TripServiceStep {
    type: ServiceType;
    title: string;
    provider: string;
    integration: 'internal' | 'redirect';
    required: boolean;
    status: ServiceStatus;
    deepLinkUrl: string | null;
    note: string;
    estimate?: number;
}
export declare function airportFor(city: string): {
    iata: string;
    address: string;
};
export declare function buildServiceSteps(input: {
    hospital: {
        name: string;
        city: string;
        latitude?: number | null;
        longitude?: number | null;
        address?: string | null;
    };
    departureCity: string;
    travelDate?: string;
    travelers?: number;
    stayNights?: number;
    flightEstimate?: number;
    hotelEstimate?: number;
}): TripServiceStep[];
export declare const atlysVisaLink: () => string;
export declare const PROVIDERS: Record<ServiceType, string>;
export declare function isServiceType(t: string): t is ServiceType;
export declare function validateVisa(f: {
    visaNumber?: string;
    visaExpiry?: string;
    travelDate?: string;
}): {
    valid: boolean;
    checkedAt: string;
    note: string;
    reason: string;
} | {
    valid: boolean;
    checkedAt: string;
    note: string;
    reason?: undefined;
};
export interface TimelineEvent {
    day: number;
    phase: string;
    title: string;
    description: string;
    icon: string;
    status: 'upcoming';
}
export declare function buildTimeline(params: {
    treatment: string;
    stayNights?: number;
}): TimelineEvent[];
