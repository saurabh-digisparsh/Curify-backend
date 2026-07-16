import { Injectable } from '@nestjs/common';
import { AccreditationBody } from '@prisma/client';
import { ACCREDITATION_MIRROR } from './accreditation.mirror';

/**
 * Accreditation verification (FR-9/10, BRD Appendix A). Neither NABH nor JCI
 * exposes a real-time API, so the production pattern is a **cached mirror** of the
 * public registries (portal.nabh.co / JCI "Find Accredited Organizations"),
 * refreshed on a schedule by a scraper (scripts/scrapers/scrape_accreditation.ts),
 * and validated instantly against the local copy.
 *
 * The onboarding flow searches this mirror by the hospital's general info
 * (name + city): a match auto-verifies the accreditation as an ID card; no match
 * routes the hospital to the document-check flow.
 */
export interface AccreditationHit { body: AccreditationBody; identifier: string; validUntil: Date | null; matchedName: string }

const STOP = new Set(['the', 'hospital', 'hospitals', 'clinic', 'centre', 'center', 'medical', 'research', 'institute', 'multispeciality', 'multi', 'speciality', 'specialty', 'super', 'and', '&', 'of', 'healthcare', 'health', 'care', 'ltd', 'pvt', 'limited', 'memorial', 'medicity']);
const tokens = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w && !STOP.has(w));

@Injectable()
export class AccreditationService {
  /**
   * Look the hospital up in the registry mirror by name + city. Returns every
   * matching accreditation (a hospital can hold both NABH and JCI). Empty = not
   * found → the applicant goes through the document-check flow.
   */
  lookup(name: string, city?: string): AccreditationHit[] {
    const nameTok = new Set(tokens(name));
    const cityL = (city || '').trim().toLowerCase();
    if (nameTok.size === 0) return [];
    return ACCREDITATION_MIRROR.filter((m) => {
      const mTok = tokens(m.name);
      // Share a distinctive brand token (e.g. "apollo", "fortis") …
      const nameMatch = mTok.some((t) => nameTok.has(t));
      // … and the same city (when both are known) to avoid false matches.
      const cityMatch = !cityL || !m.city || m.city.toLowerCase() === cityL || cityL.includes(m.city.toLowerCase()) || m.city.toLowerCase().includes(cityL);
      return nameMatch && cityMatch;
    }).map((m) => ({ body: m.body as AccreditationBody, identifier: m.identifier, validUntil: m.validUntil ? new Date(m.validUntil) : null, matchedName: m.name }));
  }

  /** Manual identifier check (fallback path). Registry hit → fast-track; else null. */
  verify(body: AccreditationBody, identifier?: string): { validUntil: Date } | null {
    const id = (identifier || '').trim().toUpperCase();
    if (!id) return null;
    const known = ACCREDITATION_MIRROR.some((m) => m.body === body && m.identifier.toUpperCase() === id);
    const wellFormed = /^[A-Z0-9-]{4,}$/.test(id);
    const devLenient = process.env.NODE_ENV !== 'production' || process.env.ACCREDITATION_AUTOVERIFY === '1';
    if (known || (wellFormed && devLenient)) {
      const validUntil = new Date();
      validUntil.setFullYear(validUntil.getFullYear() + 3);
      return { validUntil };
    }
    return null;
  }
}
