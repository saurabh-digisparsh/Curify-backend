/**
 * Phase A — deterministic prep for legacy review ingestion.
 * Reads public/data/reviews/*.json, resolves each file to a DB hospital (existing
 * strong match, else marked for creation), normalizes each review into our shape,
 * computes contentHash, and flags duplicates (in-file + already-in-DB).
 * Writes tmp/ingest/<slug>.work.json. NO DB WRITES — read-only + temp files.
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const prisma = new PrismaClient();
const REVIEWS_DIR = 'C:/client/curify/public/data/reviews';
const OUT_DIR = 'C:/client/curify/tmp/ingest';

const hash = (t: string) =>
  crypto.createHash('md5').update((t || '').toLowerCase().replace(/\s+/g, ' ').trim()).digest('hex');

// Explicit file → hospital mapping. `match` = case-insensitive substring of an existing
// DB hospital name (confident same hospital); `create` = no good match, make a new record.
const MAP: Record<string, { match?: string; matchCity?: string; create?: { name: string; city: string } }> = {
  apollo_chennai:   { match: 'Apollo Hospital Greams Lane', matchCity: 'Chennai' },
  apollo_hyderabad: { match: 'Apollo Hospitals | Best Hospital in Jubilee', matchCity: 'Hyderabad' },
  blk_max_delhi:    { match: 'BLK-Max Super Speciality Hospital Delhi' },
  fortis_gurgaon:   { match: 'Fortis Hospital Gurgaon' },
  max_patparganj:   { match: 'Max Super Speciality Hospital, Patparganj' },
  max_saket:        { match: 'Max Super Speciality Hospital, Saket' },
  apollo_bangalore: { create: { name: 'Apollo Hospitals, Bangalore', city: 'Bengaluru' } },
  apollo_delhi:     { create: { name: 'Indraprastha Apollo Hospital, Delhi', city: 'New Delhi' } },
  artemis_gurgaon:  { create: { name: 'Artemis Hospitals, Gurgaon', city: 'Gurugram' } },
  cmc_vellore:      { create: { name: 'Christian Medical College, Vellore', city: 'Vellore' } },
  narayana_bommasandra: { create: { name: 'Narayana Institute of Cardiac Sciences, Bangalore', city: 'Bengaluru' } },
};

async function main() {
  const dbHospitals = await prisma.hospital.findMany({ select: { id: true, name: true, city: true } });
  const files = fs.readdirSync(REVIEWS_DIR).filter((f) => f.endsWith('.json'));
  const report: any[] = [];

  for (const file of files) {
    const slug = file.replace('.json', '');
    const j = JSON.parse(fs.readFileSync(path.join(REVIEWS_DIR, file), 'utf8'));
    const arr: any[] = j.reviews || [];
    const m = MAP[slug];
    if (!m) { console.log(`!! no mapping for ${slug}`); continue; }

    // Resolve hospital.
    let hospital: any;
    if (m.match) {
      const found = dbHospitals.find(
        (h) => h.name.toLowerCase().includes(m.match!.toLowerCase()) &&
               (!m.matchCity || h.city.toLowerCase().includes(m.matchCity.toLowerCase())),
      );
      if (!found) { console.log(`!! match FAILED for ${slug} ("${m.match}")`); continue; }
      hospital = { mode: 'existing', id: found.id, name: found.name, city: found.city };
    } else {
      hospital = { mode: 'create', id: `legacy-${slug}`, name: m.create!.name, city: m.create!.city };
    }

    // Existing DB review hashes for this hospital (for dedup).
    const existingHashes = new Set<string>();
    if (hospital.mode === 'existing') {
      const rows = await prisma.review.findMany({ where: { hospitalId: hospital.id }, select: { contentHash: true, text: true } });
      rows.forEach((r) => existingHashes.add(r.contentHash || hash(r.text)));
    }

    // Normalize + dedup-flag.
    const seen = new Set<string>();
    let dbDupes = 0, inFileDupes = 0;
    const reviews = arr.map((r) => {
      const text = (r.text || '').trim();
      const ch = hash(text);
      let dupOf: string | null = null;
      if (seen.has(ch)) { dupOf = 'in-file'; inFileDupes++; }
      else if (existingHashes.has(ch)) { dupOf = 'db'; dbDupes++; }
      seen.add(ch);
      const ratingNum = parseInt(String(r.rating ?? ''), 10);
      return {
        contentHash: ch,
        duplicate: dupOf, // null | 'in-file' | 'db'
        reviewerName: (r.name || 'Anonymous').slice(0, 120),
        nationality: r.country || null,
        region: r.region || null,
        rating: isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5 ? null : ratingNum,
        reviewDate: r.date || null,
        text,
        lang: r.lang || null,
        totalReviews: typeof r.total_reviews === 'number' ? r.total_reviews : null,
        link: (r.link || '').startsWith('http') ? r.link : null,
        tokens: Array.isArray(r.tokens) ? r.tokens : [],
        flags: Array.isArray(r.flags) ? r.flags : [],
      };
    });

    fs.writeFileSync(
      path.join(OUT_DIR, `${slug}.work.json`),
      JSON.stringify({ slug, title: j.title || slug, hospital, reviews }, null, 2),
    );
    report.push({ slug, hospital: `${hospital.mode}:${hospital.name} (${hospital.city})`, reviews: reviews.length, dbDupes, inFileDupes });
  }

  console.log('\n=== MAPPING + DEDUP REPORT ===');
  report.forEach((r) => console.log(
    `${r.slug.padEnd(22)} -> ${r.hospital.padEnd(60)} reviews=${r.reviews} dbDup=${r.dbDupes} inFileDup=${r.inFileDupes}`,
  ));
  console.log(`\nTotal reviews: ${report.reduce((s, r) => s + r.reviews, 0)}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
