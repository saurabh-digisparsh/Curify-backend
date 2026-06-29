/**
 * Backfill Review.region from nationality using the canonical region map
 * (src/common/regions.ts — the single source of truth). Run once after adding the
 * region column; new scraped reviews get region set automatically at import time.
 */
import { PrismaClient } from '@prisma/client';
import { natRegion } from '../src/common/regions';

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.review.findMany({ select: { id: true, nationality: true, region: true } });
  console.log(`Backfilling region for ${rows.length} reviews...`);
  let updated = 0;
  const dist: Record<string, number> = {};
  for (const r of rows) {
    const region = natRegion(r.nationality);
    dist[region] = (dist[region] || 0) + 1;
    if (r.region !== region) {
      await prisma.review.update({ where: { id: r.id }, data: { region } });
      updated++;
    }
  }
  console.log(`updated=${updated}`);
  console.log('region distribution:', JSON.stringify(Object.fromEntries(Object.entries(dist).sort((a, b) => b[1] - a[1])), null, 1));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
