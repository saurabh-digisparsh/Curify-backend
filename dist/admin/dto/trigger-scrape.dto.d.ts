export declare const SCRAPE_TARGETS: readonly ["full", "jci", "reviews", "foreign-pipeline", "surgeons", "surgeon-reviews", "prices"];
export type ScrapeTarget = (typeof SCRAPE_TARGETS)[number];
export declare class TriggerScrapeDto {
    target: ScrapeTarget;
    location?: string;
    hospitalName?: string;
    region?: string;
    minReviews?: number;
}
declare const ScrapeAllDto_base: import("@nestjs/common").Type<Partial<TriggerScrapeDto>>;
export declare class ScrapeAllDto extends ScrapeAllDto_base {
}
export {};
