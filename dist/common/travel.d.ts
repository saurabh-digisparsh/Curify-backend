export declare const MIN_LEAD_DAYS = 7;
export declare const MAX_LEAD_DAYS = 365;
export declare const URGENT_DAYS = 30;
export declare function daysUntil(date: Date, now?: Date): number;
export declare function deriveUrgent(date: Date, now?: Date): boolean;
export declare function clampTravelDate(date: Date, now?: Date): Date;
