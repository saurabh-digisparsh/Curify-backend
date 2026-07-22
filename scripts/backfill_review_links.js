/**
 * Backfill Review.link (the "View on Google Maps" deep-link) for reviews stored
 * before the scraper captured it.
 *
 * Source is the Places API, which returns each review's own `googleMapsUri` — the
 * canonical permalink, no URL guessing. Reviews are matched to stored rows on a
 * normalised text prefix, the same signal the importer dedups on.
 *
 * LIMIT: the API exposes only ~5 reviews per place, so this cannot cover every row.
 * Full coverage needs a re-scrape (the foreign pipeline now records the permalink
 * and backfills it onto existing rows).
 *
 * Usage:  node --env-file=.env scripts/backfill_review_links.js [--apply]
 */
const { PrismaClient } = require('@prisma/client');

const KEY = process.env.GOOGLE_PLACES_API_KEY;
const APPLY = process.argv.includes('--apply');
const prisma = new PrismaClient();

const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 120);

async function places(url, fieldMask, body) {
  const res = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: {
      'X-Goog-Api-Key': KEY,
      'X-Goog-FieldMask': fieldMask,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 160)}`);
  return res.json();
}

(async () => {
  if (!KEY) { console.error('GOOGLE_PLACES_API_KEY missing — run with --env-file=.env'); process.exit(1); }

  // Only hospitals that actually have linkless reviews are worth an API call.
  const gaps = await prisma.review.groupBy({
    by: ['hospitalId'], where: { link: null }, _count: { _all: true },
  });
  const hospitals = await prisma.hospital.findMany({
    where: { id: { in: gaps.map((g) => g.hospitalId) } },
    select: { id: true, name: true, city: true },
  });
  const missingBy = new Map(gaps.map((g) => [g.hospitalId, g._count._all]));

  let matched = 0, applied = 0, noPlace = 0;
  for (const h of hospitals) {
    let reviews = [];
    try {
      const found = await places(
        'https://places.googleapis.com/v1/places:searchText',
        'places.id,places.displayName',
        { textQuery: `${h.name} ${h.city || ''}`.trim() },
      );
      const placeId = found.places?.[0]?.id;
      if (!placeId) { noPlace++; console.log(`  ?  ${h.name} — no place match`); continue; }
      const details = await places(
        `https://places.googleapis.com/v1/places/${placeId}`, 'reviews',
      );
      reviews = details.reviews || [];
    } catch (e) {
      console.log(`  !  ${h.name} — ${e.message}`);
      continue;
    }

    const byText = new Map();
    for (const rv of reviews) {
      const txt = rv.text?.text || rv.originalText?.text || '';
      if (rv.googleMapsUri && txt) byText.set(norm(txt), rv.googleMapsUri);
    }
    if (!byText.size) continue;

    const rows = await prisma.review.findMany({
      where: { hospitalId: h.id, link: null }, select: { id: true, text: true },
    });
    for (const row of rows) {
      const uri = byText.get(norm(row.text));
      if (!uri) continue;
      matched++;
      if (APPLY) {
        await prisma.review.update({ where: { id: row.id }, data: { link: uri } });
        applied++;
      }
    }
    console.log(`  ✓  ${h.name} — ${byText.size} API reviews, ${missingBy.get(h.id)} rows missing links`);
  }

  console.log(`\n${hospitals.length} hospitals scanned, ${noPlace} unmatched places`);
  console.log(APPLY ? `applied ${applied} links` : `${matched} links would be set (dry run — pass --apply to write)`);
  await prisma.$disconnect();
})();
