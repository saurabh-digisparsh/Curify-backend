// Cached mirror of the public NABH (portal.nabh.co / data.gov.in) and JCI
// ("Find Accredited Organizations") directories. Refreshed on a schedule by
// scripts/scrapers/scrape_accreditation.ts — validated locally so onboarding is
// resilient to registry outages (BRD Appendix A). Representative dataset.

export interface MirrorEntry {
  body: 'NABH' | 'JCI';
  name: string;
  city: string;
  identifier: string;
  validUntil: string | null; // ISO date
}

export const ACCREDITATION_MIRROR: MirrorEntry[] = [
  // ── Apollo ──
  { body: 'NABH', name: 'Apollo Hospitals', city: 'Chennai', identifier: 'NABH-H-2011-0473', validUntil: '2027-06-30' },
  { body: 'JCI', name: 'Apollo Hospitals', city: 'Chennai', identifier: 'JCI-APOLLO-CHN-2015', validUntil: '2026-11-30' },
  { body: 'NABH', name: 'Indraprastha Apollo Hospitals', city: 'New Delhi', identifier: 'NABH-H-2010-0221', validUntil: '2027-03-31' },
  { body: 'JCI', name: 'Indraprastha Apollo Hospitals', city: 'New Delhi', identifier: 'JCI-APOLLO-DEL', validUntil: '2026-09-30' },
  // ── Fortis ──
  { body: 'NABH', name: 'Fortis Memorial Research Institute', city: 'Gurugram', identifier: 'NABH-H-2013-0912', validUntil: '2027-08-31' },
  { body: 'JCI', name: 'Fortis Memorial Research Institute', city: 'Gurugram', identifier: 'JCI-FMRI-2014', validUntil: '2026-12-31' },
  { body: 'NABH', name: 'Fortis Hospital', city: 'Mumbai', identifier: 'NABH-H-2012-0640', validUntil: '2027-05-31' },
  // ── Medanta ──
  { body: 'NABH', name: 'Medanta The Medicity', city: 'Gurugram', identifier: 'NABH-H-2011-0388', validUntil: '2027-02-28' },
  { body: 'JCI', name: 'Medanta The Medicity', city: 'Gurugram', identifier: 'JCI-MEDANTA-2013', validUntil: '2026-10-31' },
  // ── Max ──
  { body: 'NABH', name: 'Max Super Speciality Hospital', city: 'New Delhi', identifier: 'NABH-H-2012-0501', validUntil: '2027-07-31' },
  { body: 'JCI', name: 'Max Super Speciality Hospital', city: 'New Delhi', identifier: 'JCI-MAX-SAKET', validUntil: '2026-08-31' },
  // ── Manipal ──
  { body: 'NABH', name: 'Manipal Hospital', city: 'Bangalore', identifier: 'NABH-H-2010-0177', validUntil: '2027-04-30' },
  // ── Kokilaben ──
  { body: 'NABH', name: 'Kokilaben Dhirubhai Ambani Hospital', city: 'Mumbai', identifier: 'NABH-H-2011-0455', validUntil: '2027-01-31' },
  { body: 'JCI', name: 'Kokilaben Dhirubhai Ambani Hospital', city: 'Mumbai', identifier: 'JCI-KDAH-2016', validUntil: '2026-12-31' },
  // ── Narayana ──
  { body: 'NABH', name: 'Narayana Health', city: 'Bangalore', identifier: 'NABH-H-2009-0098', validUntil: '2027-06-30' },
  { body: 'JCI', name: 'Narayana Institute of Cardiac Sciences', city: 'Bangalore', identifier: 'JCI-NARAYANA', validUntil: '2026-07-31' },
  // ── Artemis ──
  { body: 'NABH', name: 'Artemis Hospital', city: 'Gurugram', identifier: 'NABH-H-2012-0577', validUntil: '2027-09-30' },
  { body: 'JCI', name: 'Artemis Hospital', city: 'Gurugram', identifier: 'JCI-ARTEMIS-2013', validUntil: '2026-06-30' },
  // ── Aster ──
  { body: 'NABH', name: 'Aster Medcity', city: 'Kochi', identifier: 'NABH-H-2014-0810', validUntil: '2027-10-31' },
  { body: 'JCI', name: 'Aster Medcity', city: 'Kochi', identifier: 'JCI-ASTER-KOCHI', validUntil: '2026-11-30' },
  // ── BLK-Max ──
  { body: 'NABH', name: 'BLK-Max Super Speciality Hospital', city: 'New Delhi', identifier: 'NABH-H-2011-0342', validUntil: '2027-03-31' },
];
