// Single source of truth: map a review's stored nationality (a country name) to a
// display region label. Used by hospitals.service (dispatch/comparison breakdowns),
// the scrape import (persists Review.region), and the region backfill script.
export const COUNTRY_REGION: Record<string, string> = {
  nigeria: 'Africa', kenya: 'Africa', ghana: 'Africa', tanzania: 'Africa', uganda: 'Africa',
  somalia: 'Africa', ethiopia: 'Africa', mauritius: 'Africa', rwanda: 'Africa', zambia: 'Africa',
  'south africa': 'Africa', sudan: 'Africa', congo: 'Africa', djibouti: 'Africa',
  mozambique: 'Africa', malawi: 'Africa', liberia: 'Africa', zimbabwe: 'Africa', seychelles: 'Africa',
  'sierra leone': 'Africa', 'south sudan': 'Africa', cameroon: 'Africa', "ivory coast": 'Africa',
  egypt: 'Middle East', uae: 'Middle East', bahrain: 'Middle East', oman: 'Middle East', qatar: 'Middle East',
  'saudi arabia': 'Middle East', kuwait: 'Middle East', iraq: 'Middle East', yemen: 'Middle East',
  iran: 'Middle East', turkey: 'Middle East', syria: 'Middle East',
  uk: 'Europe', 'united kingdom': 'Europe', germany: 'Europe', italy: 'Europe', france: 'Europe',
  ireland: 'Europe', netherlands: 'Europe', spain: 'Europe', russia: 'Europe', portugal: 'Europe',
  denmark: 'Europe', switzerland: 'Europe', sweden: 'Europe', ukraine: 'Europe',
  maldives: 'South Asia', bangladesh: 'South Asia', 'sri lanka': 'South Asia', nepal: 'South Asia',
  pakistan: 'South Asia', afghanistan: 'South Asia', india: 'South Asia', bhutan: 'South Asia',
  indonesia: 'SE Asia', singapore: 'SE Asia', myanmar: 'SE Asia', 'myanmar (burma)': 'SE Asia',
  malaysia: 'SE Asia', thailand: 'SE Asia', philippines: 'SE Asia', vietnam: 'SE Asia',
  china: 'East Asia', japan: 'East Asia', 'south korea': 'East Asia', 'hong kong': 'East Asia',
  australia: 'Oceania', 'new zealand': 'Oceania', fiji: 'Oceania',
  usa: 'N. America', 'united states': 'N. America', canada: 'N. America',
};

export function isRealCountry(nat?: string | null): boolean {
  return !!nat && nat.toLowerCase() in COUNTRY_REGION;
}

export function natRegion(nat?: string | null): string {
  return COUNTRY_REGION[(nat || '').toLowerCase()] ?? 'Other Regions';
}
