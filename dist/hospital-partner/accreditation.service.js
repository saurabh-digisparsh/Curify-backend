"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccreditationService = void 0;
const common_1 = require("@nestjs/common");
const accreditation_mirror_1 = require("./accreditation.mirror");
const STOP = new Set(['the', 'hospital', 'hospitals', 'clinic', 'centre', 'center', 'medical', 'research', 'institute', 'multispeciality', 'multi', 'speciality', 'specialty', 'super', 'and', '&', 'of', 'healthcare', 'health', 'care', 'ltd', 'pvt', 'limited', 'memorial', 'medicity']);
const tokens = (s) => (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w && !STOP.has(w));
let AccreditationService = class AccreditationService {
    lookup(name, city) {
        const nameTok = new Set(tokens(name));
        const cityL = (city || '').trim().toLowerCase();
        if (nameTok.size === 0)
            return [];
        return accreditation_mirror_1.ACCREDITATION_MIRROR.filter((m) => {
            const mTok = tokens(m.name);
            const nameMatch = mTok.some((t) => nameTok.has(t));
            const cityMatch = !cityL || !m.city || m.city.toLowerCase() === cityL || cityL.includes(m.city.toLowerCase()) || m.city.toLowerCase().includes(cityL);
            return nameMatch && cityMatch;
        }).map((m) => ({ body: m.body, identifier: m.identifier, validUntil: m.validUntil ? new Date(m.validUntil) : null, matchedName: m.name }));
    }
    verify(body, identifier) {
        const id = (identifier || '').trim().toUpperCase();
        if (!id)
            return null;
        const known = accreditation_mirror_1.ACCREDITATION_MIRROR.some((m) => m.body === body && m.identifier.toUpperCase() === id);
        const wellFormed = /^[A-Z0-9-]{4,}$/.test(id);
        const devLenient = process.env.NODE_ENV !== 'production' || process.env.ACCREDITATION_AUTOVERIFY === '1';
        if (known || (wellFormed && devLenient)) {
            const validUntil = new Date();
            validUntil.setFullYear(validUntil.getFullYear() + 3);
            return { validUntil };
        }
        return null;
    }
};
exports.AccreditationService = AccreditationService;
exports.AccreditationService = AccreditationService = __decorate([
    (0, common_1.Injectable)()
], AccreditationService);
//# sourceMappingURL=accreditation.service.js.map