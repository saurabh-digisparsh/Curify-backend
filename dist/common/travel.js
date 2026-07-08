"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.URGENT_DAYS = exports.MAX_LEAD_DAYS = exports.MIN_LEAD_DAYS = void 0;
exports.daysUntil = daysUntil;
exports.deriveUrgent = deriveUrgent;
exports.clampTravelDate = clampTravelDate;
exports.MIN_LEAD_DAYS = 7;
exports.MAX_LEAD_DAYS = 365;
exports.URGENT_DAYS = 30;
function daysUntil(date, now = new Date()) {
    return Math.ceil((date.getTime() - now.getTime()) / 86_400_000);
}
function deriveUrgent(date, now = new Date()) {
    const d = daysUntil(date, now);
    return d >= 0 && d < exports.URGENT_DAYS;
}
function clampTravelDate(date, now = new Date()) {
    const min = new Date(now.getTime() + exports.MIN_LEAD_DAYS * 86_400_000);
    const max = new Date(now.getTime() + exports.MAX_LEAD_DAYS * 86_400_000);
    if (date < min)
        return min;
    if (date > max)
        return max;
    return date;
}
//# sourceMappingURL=travel.js.map