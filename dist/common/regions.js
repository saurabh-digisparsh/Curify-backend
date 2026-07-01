"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COUNTRY_REGION = void 0;
exports.isRealCountry = isRealCountry;
exports.natRegion = natRegion;
exports.COUNTRY_REGION = {
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
function isRealCountry(nat) {
    return !!nat && nat.toLowerCase() in exports.COUNTRY_REGION;
}
function natRegion(nat) {
    return exports.COUNTRY_REGION[(nat || '').toLowerCase()] ?? 'Other Regions';
}
//# sourceMappingURL=regions.js.map