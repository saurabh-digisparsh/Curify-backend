/**
 * Every analyzeReport call fails over to OpenAI with GGML_ASSERT, yet hand-built
 * calls of the same shape succeed. Isolate it INSIDE the real code path by removing
 * the fallback (so the primary's error surfaces) and varying only the report length.
 *
 *   npx ts-node scripts/probe_ollama_analyze.ts
 */
import * as fs from 'fs';
import * as path from 'path';

for (const line of fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
// No fallback → analyzeReport throws the gateway's real error instead of hiding it.
delete process.env.OPENAI_API_KEY;

import { AiService } from '../src/ai/ai.service';

const CLINICAL =
  'Coronary angiography via right radial approach. Left Main: Normal. ' +
  'LAD: Type III vessel, mild calcification, proximal LAD 95% stenosis, mid LAD 95% stenosis, distal LAD focal 50%. ' +
  'LCx: non-dominant, major OM 50% stenosis proximal, small branch of OM 100% occlusion. ' +
  'RCA: dominant, 30% stenosis proximal, PDA and PLV free of disease. LVEF = 0.60. ';

async function main() {
  const ai = new AiService();
  for (const chars of [200, 800, 2000, 3500, 5000, 5756]) {
    const reportText = CLINICAL.repeat(Math.ceil(chars / CLINICAL.length)).slice(0, chars);
    const t = Date.now();
    try {
      const r: any = await ai.analyzeReport({ reportText, treatment: 'cardiology' });
      console.log(`✅ reportText ${String(chars).padStart(5)} chars  ${String(Date.now() - t).padStart(6)} ms → score ${r.report?.compositeScore} (${r.report?.compositeSeverity})`);
    } catch (e: any) {
      console.log(`❌ reportText ${String(chars).padStart(5)} chars  ${String(Date.now() - t).padStart(6)} ms → ${e.message.replace(/\s+/g, ' ').slice(0, 85)}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
