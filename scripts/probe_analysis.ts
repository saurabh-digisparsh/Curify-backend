/**
 * Latency probe for the Medical Analysis flow (RCA evidence collector).
 * Runs the REAL AiService.analyzeReport() path with a sample HRCT report,
 * times cold + warm runs, detects which provider answered, and does one raw
 * Ollama call to measure tokens/sec. Read-only; persists nothing.
 *
 *   npx ts-node -r tsconfig-paths/register scripts/probe_analysis.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';

// Minimal .env loader (dotenv isn't a dependency here).
for (const line of fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

import { AiService } from '../src/ai/ai.service';

// Text as pdf-parse would extract it from "Pranali HRCT Chest report.pdf".
const REPORT_TEXT = `HRCT CHEST — MAGNUM C.T. SCAN CENTRE, Mumbai
Patient: MRS PRANALI KADAM   Age/Gender: 46 Years / Female
Ref Doctor: Dr. PRALHAD P PRABHUDESAI, Lilavati Hospital   Date: 26/06/2026   UID: 20704-001
Protocol: HRCT Chest on 128-slice MDCT scanner.
Observation:
- Reticulation / septal thickness (interlobular/intralobular): + Septal thickening in bilateral lungs, florid in bilateral lower lobes, peribronchovascular distribution and few peripheral in bilateral upper lobes. Areas of subpleural sparing in bilateral lower lobes.
- Subpleural cysts: + few in bilateral upper lobes.
- Honeycombing: -
- Traction bronchiolectasis: + seen.
- Apicobasal gradient: +
- Ground glass opacities / mosaic pattern: areas of GGO in bilateral lower lobes, right middle lobe and inferior lingular segment.
- Nodules: -
- Lymph nodes: few subcentimetric to centimetric nodes in pre-paratracheal, precarinal, prevascular regions; largest 1.0 x 0.9 cm precarinal.
- Pleural effusion: -   Pulmonary arteries: normal caliber.
- Additional: 8 x 8 mm tracheal diverticulum right postero-lateral at D1-D2; dilated air-filled oesophagus; mild diffuse osteopenia with few anterior osteophytes.
Impression: Known case of connective tissue disorder with interstitial lung disease. Findings consistent with fibrosing ILD related to CTD (fibrotic NSIP pattern). Compared to prior CT 27/11/2025, more or less the same.
Dr. A R Joshi (MD, DMRE), Consultant Radiologist.`;

const withGuard = <T>(p: Promise<T>, ms: number, label: string): Promise<T> =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${label}: guard timeout after ${ms}ms`)), ms))]);

async function main() {
  console.log('════════ Medical Analysis latency probe ════════');
  console.log(`endpoint : ${process.env.AI_BASE_URL || '(OpenAI direct)'}`);
  console.log(`model    : ${process.env.AI_MODEL || '(default)'}   fallback: ${process.env.AI_FALLBACK_MODEL || 'gpt-4.1-mini (default)'}`);

  // Detect which provider answered by intercepting the fallback warning.
  let fellBack = false;
  const origWarn = console.warn;
  console.warn = (...a: any[]) => { if (String(a[0]).includes('falling back') || String(a[0]).includes('failed')) fellBack = true; origWarn(...a); };

  const ai = new AiService();
  const params = { reportText: REPORT_TEXT, treatment: 'Pulmonology / ILD', country: 'India', urgency: 'exploring' };

  const runs: { label: string; ms: number; provider: string; ok: boolean; condition?: string; sev?: string; cats?: number; chars?: number }[] = [];
  for (const label of ['COLD run', 'WARM run']) {
    fellBack = false;
    const t0 = Date.now();
    try {
      const res: any = await withGuard(ai.analyzeReport(params), 300_000, label);
      const ms = Date.now() - t0;
      runs.push({ label, ms, provider: fellBack ? 'OpenAI fallback (gpt-4.1-mini)' : `Ollama primary (${process.env.AI_MODEL})`, ok: true,
        condition: res?.diagnosis?.condition, sev: res?.report?.compositeSeverity || res?.diagnosis?.severity,
        cats: (res?.report?.categories || []).length, chars: JSON.stringify(res).length });
    } catch (e: any) {
      runs.push({ label, ms: Date.now() - t0, provider: 'FAILED', ok: false });
      console.error(`   ${label} error: ${e.message}`);
    }
  }
  console.warn = origWarn;

  // Raw Ollama call → tokens/sec (usage is returned by the OpenAI-compatible API).
  let raw = '';
  if (process.env.AI_BASE_URL) {
    try {
      const client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY || 'ollama', baseURL: process.env.AI_BASE_URL,
        ...(process.env.AI_BASIC_AUTH ? { defaultHeaders: { Authorization: `Basic ${process.env.AI_BASIC_AUTH}` } } : {}),
        timeout: 300_000, maxRetries: 0,
      });
      const t0 = Date.now();
      const r: any = await withGuard(client.chat.completions.create({
        model: process.env.AI_MODEL!, temperature: 0.3, max_tokens: 3500,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: 'Return a JSON object summarising this radiology report with keys condition, severity, findings[] (be thorough).' }, { role: 'user', content: REPORT_TEXT }],
      } as any), 300_000, 'raw');
      const ms = Date.now() - t0;
      const ct = r?.usage?.completion_tokens, pt = r?.usage?.prompt_tokens;
      raw = `raw Ollama: ${ms} ms · prompt_tok=${pt ?? '?'} completion_tok=${ct ?? '?'}` + (ct ? ` · ${(ct / (ms / 1000)).toFixed(1)} tok/s` : '');
    } catch (e: any) { raw = `raw Ollama call FAILED: ${e.message}`; }
  }

  console.log('\n──────── RESULTS ────────');
  for (const r of runs) console.log(`${r.label.padEnd(9)} : ${(r.ms + ' ms').padEnd(10)} via ${r.provider}${r.ok ? `  → "${r.condition}" (${r.sev}, ${r.cats} categories, ${r.chars} chars JSON)` : ''}`);
  if (raw) console.log(raw);
  console.log('═════════════════════════');
  process.exit(0);
}
main();
