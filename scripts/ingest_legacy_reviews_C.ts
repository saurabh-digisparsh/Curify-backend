/**
 * Phase C — apply verdicts: save KEPT reviews to the DB, write all DROPPED objects to
 * a new JSON file. Creates the 5 missing hospitals. Idempotent on reviews (upsert by
 * hospitalId+contentHash). Run after Phase A + the Claude verdict subagents.
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const DIR = 'C:/client/curify/tmp/ingest';
const DROPPED_OUT = 'C:/client/curify/dropped_reviews.json';

async function main() {
  const workFiles = fs.readdirSync(DIR).filter((f) => f.endsWith('.work.json'));
  const dropped: any[] = [];
  let saved = 0, dupSkipped = 0, droppedByRule = 0, missingVerdict = 0;
  const perHospital: Record<string, number> = {};

  for (const wf of workFiles) {
    const slug = wf.replace('.work.json', '');
    const work = JSON.parse(fs.readFileSync(path.join(DIR, wf), 'utf8'));
    const verdictsPath = path.join(DIR, `${slug}.verdicts.json`);
    if (!fs.existsSync(verdictsPath)) { console.log(`!! missing verdicts for ${slug}`); continue; }
    const verdicts: { contentHash: string; keep: boolean; reason: string }[] = JSON.parse(fs.readFileSync(verdictsPath, 'utf8'));
    const verdictMap = new Map(verdicts.map((v) => [v.contentHash, v]));

    // Resolve / create the hospital.
    const h = work.hospital;
    if (h.mode === 'create') {
      const avg = (() => {
        const kept = work.reviews.filter((r: any) => !r.duplicate && verdictMap.get(r.contentHash)?.keep && r.rating);
        return kept.length ? +(kept.reduce((s: number, r: any) => s + r.rating, 0) / kept.length).toFixed(1) : null;
      })();
      await prisma.hospital.upsert({
        where: { id: h.id },
        update: {},
        create: { id: h.id, name: h.name, city: h.city, country: 'India', overallRating: avg },
      });
    }

    for (const r of work.reviews) {
      const baseDrop = { slug, hospital: h.name, review: r };
      // 1) duplicates (flagged in Phase A) → dropped
      if (r.duplicate) { dropped.push({ ...baseDrop, dropReason: `duplicate (${r.duplicate})` }); dupSkipped++; continue; }
      // 2) verdict lookup
      const v = verdictMap.get(r.contentHash);
      if (!v) { dropped.push({ ...baseDrop, dropReason: 'no verdict (unjudged)' }); missingVerdict++; continue; }
      // 3) Claude dropped (domestic / invalid)
      if (!v.keep) { dropped.push({ ...baseDrop, dropReason: v.reason || 'dropped by review' }); droppedByRule++; continue; }
      // 4) KEEP → insert (guard against an existing row by hospitalId+contentHash)
      const exists = await prisma.review.findFirst({ where: { hospitalId: h.id, contentHash: r.contentHash }, select: { id: true } });
      if (exists) { dropped.push({ ...baseDrop, dropReason: 'duplicate (db at insert)' }); dupSkipped++; continue; }
      await prisma.review.create({
        data: {
          hospitalId: h.id,
          reviewerName: r.reviewerName,
          nationality: r.nationality,
          rating: r.rating ?? 5,
          reviewDate: r.reviewDate,
          text: r.text.slice(0, 5000),
          lang: r.lang,
          totalReviews: r.totalReviews,
          link: r.link,
          tokens: r.tokens,
          flags: r.flags,
          contentHash: r.contentHash,
          verified: false,
        },
      });
      saved++;
      perHospital[h.name] = (perHospital[h.name] || 0) + 1;
    }
  }

  fs.writeFileSync(DROPPED_OUT, JSON.stringify({ generated: 'phase-C', totalDropped: dropped.length, dropped }, null, 2));

  console.log('=== PHASE C RESULT ===');
  console.log('saved (kept foreign reviews):', saved);
  console.log('dropped — by review rule    :', droppedByRule);
  console.log('dropped — duplicates        :', dupSkipped);
  console.log('dropped — missing verdict   :', missingVerdict);
  console.log('total dropped written       :', dropped.length, '->', DROPPED_OUT);
  console.log('\nsaved per hospital:');
  Object.entries(perHospital).sort((a, b) => b[1] - a[1]).forEach(([n, c]) => console.log(`  ${c}\t${n.slice(0, 50)}`));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
