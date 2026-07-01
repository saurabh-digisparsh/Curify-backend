export declare const SCRAPE_TARGETS: readonly ["full", "jci", "reviews", "foreign-pipeline", "surgeons", "surgeon-reviews", "prices"];
export type ScrapeTarget = (typeof SCRAPE_TARGETS)[number];
export declare class TriggerScrapeDto {
    target: ScrapeTarget;
    location?: string;
    hospitalName?: string;
    region?: string;
    minReviews?: number;
}
