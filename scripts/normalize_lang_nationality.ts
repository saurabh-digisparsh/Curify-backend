/**
 * Normalize "international" reviews whose nationality is a language code (e.g. "lang_sv").
 * Maps the language → a representative source country (region derived downstream via
 * COUNTRY_REGION). Best-guess for multi-country languages — see notes in the report.
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// language code → representative country (chosen for India medical-tourism source likelihood)
const LANG_COUNTRY: Record<string, string> = {
  ar: 'Iraq',        // Arabic — Middle East (representative; Gulf/Iraq/Yemen common)
  ru: 'Russia',      // Russian — Europe
  fr: 'France',      // French — Europe
  pt: 'Portugal',    // Portuguese — Europe
  ja: 'Japan',       // Japanese — East Asia
  fa: 'Iran',        // Persian — Middle East
  tr: 'Turkey',      // Turkish — Middle East
  nl: 'Netherlands', // Dutch — Europe
  es: 'Spain',       // Spanish — Europe
  am: 'Ethiopia',    // Amharic — Africa
  ko: 'South Korea', // Korean — East Asia
  zh: 'China',       // Chinese — East Asia
  de: 'Germany',     // German — Europe
  om: 'Ethiopia',    // Oromo — Africa
  sw: 'Kenya',       // Swahili — Africa
};

async function main() {
  const rows = await prisma.review.findMany({
    where: { nationality: { startsWith: 'lang_' } },
    select: { id: true, nationality: true, tokens: true },
  });
  console.log(`Found ${rows.length} lang_* reviews.`);

  const report: Record<string, { country: string; n: number }> = {};
  let updated = 0, unmapped = 0;

  for (const r of rows) {
    const code = (r.nationality || '').replace(/^lang_/, '').toLowerCase();
    const country = LANG_COUNTRY[code];
    if (!country) { unmapped++; console.log(`  ?? unmapped lang code: ${r.nationality}`); continue; }
    // also swap the lang code out of tokens for the country (chip display / highlighting)
    const tokens = Array.isArray(r.tokens) ? (r.tokens as string[]).filter((t) => t.toLowerCase() !== code) : [];
    if (!tokens.includes(country)) tokens.push(country);
    await prisma.review.update({ where: { id: r.id }, data: { nationality: country, tokens } });
    updated++;
    report[code] = report[code] || { country, n: 0 };
    report[code].n++;
  }

  console.log('\n=== NORMALIZATION REPORT (lang -> country) ===');
  Object.entries(report).sort((a, b) => b[1].n - a[1].n).forEach(([code, { country, n }]) =>
    console.log(`  lang_${code.padEnd(3)} -> ${country.padEnd(14)} (${n})`));
  console.log(`\nupdated=${updated} unmapped=${unmapped}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
