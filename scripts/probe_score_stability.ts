/**
 * Verification for RCA_Analysis_Inconsistent_Scores.md: run the REAL analysis path
 * on the same document N times and report whether the score is now stable.
 *
 * Before the fix this document reached the model as 4 page markers and scored
 * 91 / 0 / 51 on successive runs.
 *
 *   npx ts-node scripts/probe_score_stability.ts [runs] [pdf]
 */
import * as fs from 'fs';
import * as path from 'path';

for (const line of fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

import { AiService } from '../src/ai/ai.service';
import { UploadService } from '../src/upload/upload.service';

async function main() {
  const runs = Number(process.argv[2] ?? 3);
  const rel = process.argv[3] ?? '../../docs/patientreport/Sandeep Bora Angio Report.pdf';
  const file = path.resolve(__dirname, rel);

  const upload = new UploadService({} as any, {} as any);
  const t0 = Date.now();
  const reportText: string | undefined = await (upload as any).extractPdfText({
    buffer: fs.readFileSync(file), mimetype: 'application/pdf', originalname: path.basename(file),
  });
  console.log(`\nextraction: ${reportText ? `${reportText.length} chars` : 'NO TEXT'} in ${Date.now() - t0} ms`);
  if (!reportText) {
    console.log('Document is unreadable — the pipeline would (correctly) refuse it. Nothing to score.');
    return;
  }

  const ai = new AiService();
  const rows: any[] = [];
  for (let i = 1; i <= runs; i++) {
    const t = Date.now();
    try {
      const r: any = await ai.analyzeReport({ reportText, treatment: 'cardiology' });
      rows.push({
        run: i,
        ms: Date.now() - t,
        condition: (r.diagnosis?.condition || '').slice(0, 46),
        severity: r.diagnosis?.severity,
        score: r.report?.compositeScore,
        band: r.report?.compositeSeverity,
        confidence: r.confidence,
      });
    } catch (e: any) {
      rows.push({ run: i, ms: Date.now() - t, condition: `FAILED: ${e.message}`.slice(0, 46) });
    }
    console.log(`  run ${i}/${runs} done`);
  }

  console.table(rows);
  const scores = rows.map((r) => r.score).filter((s) => typeof s === 'number');
  if (scores.length > 1) {
    const spread = Math.max(...scores) - Math.min(...scores);
    console.log(`composite scores: [${scores.join(', ')}]  spread: ${spread}`);
    console.log(spread === 0 ? '✅ STABLE — identical across runs' : `⚠️  still varying by ${spread} points`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
