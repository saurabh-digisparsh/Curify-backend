/**
 * Trigger review localization (detect language → English translation + native script).
 *
 * The LOGIC lives in the backend (ReviewLangService + AiService) and is the single source
 * of truth — it also runs automatically for reviews imported by the scrape pipeline. This
 * script just calls POST /api/admin/scrape/localize-reviews so it can be run from the CLI/cron.
 *
 * Usage:
 *   npx ts-node scripts/localize_reviews.ts            # localize all not-yet-processed reviews
 *   npx ts-node scripts/localize_reviews.ts --limit=50 # cap how many to process
 *
 * Env: CURIFY_API (default http://localhost:4000/api), SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD.
 */
const API = process.env.CURIFY_API || 'http://localhost:4000/api';
const EMAIL = process.env.SEED_ADMIN_EMAIL || 'rubenlazarus19@gmail.com';
const PW = process.env.SEED_ADMIN_PASSWORD || 'Ruben@123';
const LIMIT = (() => {
  const a = process.argv.find((x) => x.startsWith('--limit='));
  return a ? parseInt(a.split('=')[1], 10) : undefined;
})();

async function main() {
  const login = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PW }),
  }).then((r) => r.json());
  if (!login.token) throw new Error('admin login failed');

  const res = await fetch(`${API}/admin/scrape/localize-reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${login.token}` },
    body: JSON.stringify({ limit: LIMIT }),
  }).then((r) => r.json());

  console.log('Review localization started:', res);
  console.log('Progress is logged by the backend (ReviewLangService).');
}

main().catch((e) => { console.error(e); process.exit(1); });
