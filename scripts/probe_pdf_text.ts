/**
 * Diagnostic: does a PDF carry a usable text layer, per the REAL UploadService rule?
 * Calls the service's own extractPdfText so this can't drift from production.
 *
 *   npx ts-node scripts/probe_pdf_text.ts "../../docs/patientreport/<file>.pdf"
 */
import * as fs from 'fs';
import * as path from 'path';
import { UploadService } from '../src/upload/upload.service';

async function main() {
  const rel = process.argv[2];
  if (!rel) throw new Error('usage: probe_pdf_text.ts <pdf path>');
  const file = path.resolve(__dirname, rel);
  const buffer = fs.readFileSync(file);

  const svc = new UploadService({} as any, {} as any);
  const text: string | undefined = await (svc as any).extractPdfText({
    buffer, mimetype: 'application/pdf', originalname: path.basename(file),
  });

  console.log(`file    : ${path.basename(file)}`);
  console.log(`size    : ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
  console.log(`verdict : ${text ? 'HAS TEXT LAYER — will be analysed' : 'NO TEXT LAYER — rejected as a scan'}`);
  console.log(`chars   : ${text?.length ?? 0}`);
  if (text) console.log(`\n--- what the model receives (first 600 chars) ---\n${text.slice(0, 600)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
