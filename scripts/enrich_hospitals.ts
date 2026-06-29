/**
 * Trigger the hospital AI-enrichment batch.
 *
 * The enrichment LOGIC lives in the backend (EnrichmentService + AiService) and is the
 * single source of truth — it also runs automatically for newly-scraped hospitals.
 * This script just calls the admin endpoint POST /api/admin/scrape/enrich so it can be
 * run from the CLI/cron without the admin UI.
 *
 * Usage:
 *   npx ts-node scripts/enrich_hospitals.ts            # fill only un-enriched hospitals
 *   npx ts-node scripts/enrich_hospitals.ts --force    # re-enrich everything
 *   npx ts-node scripts/enrich_hospitals.ts --limit=5  # cap how many to process
 *
 * Env: CURIFY_API (default http://localhost:4000/api), SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD.
 */
const API =
  process.env.CURIFY_API || "https://0d2b-122-179-90-204.ngrok-free.app/api";
const EMAIL = process.env.SEED_ADMIN_EMAIL || "rubenlazarus19@gmail.com";
const PW = process.env.SEED_ADMIN_PASSWORD || "Ruben@123";

const FORCE = process.argv.includes("--force");
const LIMIT = (() => {
  const a = process.argv.find((x) => x.startsWith("--limit="));
  return a ? parseInt(a.split("=")[1], 10) : undefined;
})();

async function main() {
  const login = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PW }),
  }).then((r) => r.json());
  if (!login.token) throw new Error("admin login failed");

  const res = await fetch(`${API}/admin/scrape/enrich`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${login.token}`,
    },
    body: JSON.stringify({ force: FORCE, limit: LIMIT }),
  }).then((r) => r.json());

  console.log("Enrichment started:", res);
  console.log(
    "Progress is logged by the backend (EnrichmentService). Re-run with --force to redo all.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
