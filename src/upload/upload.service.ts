import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
// pdf-parse v2 is class-based: new PDFParse({ data }).getText()
import { PDFParse } from 'pdf-parse';
import { join, extname } from 'path';
import { mkdirSync } from 'fs';
import { readFile, writeFile, stat } from 'fs/promises';
import { randomBytes } from 'crypto';

// A PROCESSING report older than this had its job killed mid-run (deploy/crash) —
// nothing will ever finish it. Generous: analyses are serialised, so a queued job
// can legitimately wait behind several others before it even starts.
const STALE_JOB_MS = 10 * 60_000;

// How many times one report's analysis may be re-run. The source documents don't
// change between runs, so extra runs mostly burn GPU time for near-identical output.
export const MAX_REANALYSIS = 2;

// Total documents one analysis may cover — the FIRST upload plus everything added
// later via "upload another report", not 8 per request. Each document is OCR'd and
// its text joined into a single prompt, so the ceiling is real work, not a UI whim.
export const MAX_DOCUMENTS = 8;

// Source documents live on local disk, mirroring hospital-partner/docs.storage.ts:
// the dir is gitignored and nothing is served statically — reads go through the
// ownership-checked routes only.
// ponytail: local disk, like the hospital docs. Move both to encrypted object
//   storage together when that migration happens — don't invent a second scheme here.
const REPORT_DOCS_DIR = join(process.cwd(), 'uploads', 'reports');
mkdirSync(REPORT_DOCS_DIR, { recursive: true });

// A scanned PDF still yields text from pdf-parse — just not *report* text. A pure
// 4-page scan comes back as "-- 1 of 4 --\n-- 2 of 4 --\n…", which is non-empty and
// therefore passed the old `!reportText` check, leaving the model to invent a full
// scored analysis from the treatment hint alone (different answer every run).
// Strip the page separators, then require enough real letters to be a report.
const PAGE_MARKER_RE = /--\s*\d+\s*of\s*\d+\s*--/gi;
// Any genuine report (even a terse one-line impression + header) clears this easily;
// a scan's leftover furniture does not.
const MIN_PDF_TEXT_LETTERS = 200;

// OCR settings for scanned PDFs. Measured on "Sandeep Bora Angio Report.pdf"
// (4-page scan, no text layer) — see docs/RCA_Analysis_Inconsistent_Scores.md:
//   scale 0.75 → 1378x2118 px, ~5 s/page, every clinical value read correctly
//   (cross-validated against the qwen2.5vl vision model: 7/7 numbers identical).
// Higher scales cost time without improving the read.
const OCR_SCALE = 0.75;
// Bounds the worst case: a 40-page scan would otherwise hold the job for minutes.
const OCR_MAX_PAGES = 8;
// Language data is downloaded once (~5 MB) and cached here rather than in the CWD.
const OCR_CACHE_DIR = join(process.cwd(), 'uploads', '.tesseract');

/** The minimum a document needs to be analysed — satisfied by Express.Multer.File
 *  and by anything we read back off disk. */
type Doc = { buffer: Buffer; mimetype: string; originalname?: string };
/** What we persist per document so a later run can rebuild the Doc. `text` caches
 *  the extracted/OCR'd content — re-OCR'ing a scan on every follow-up upload would
 *  add ~18 s per document and can push a combined run past the client's poll timeout. */
type StoredDoc = { path: string; name?: string; mime: string; text?: string };
/** A document paired with the record that persists it, so extracted text can be
 *  cached onto the record as we go. */
type DocPair = { doc: Doc; rec: StoredDoc };

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  constructor(private prisma: PrismaService, private ai: AiService) {}

  /**
   * One-at-a-time gate for report analyses. The AI gateway is a single 7B model on
   * one GPU: measured, 3 concurrent reports finish in the same wall time as 3 run
   * back-to-back (~40s) but each patient's own wait blows out from ~13s to ~42s.
   * Serialising costs no throughput and keeps every patient's wait predictable.
   * ponytail: a promise chain, not a queue library — raise to N slots only if the
   *   gateway ever gets more GPUs.
   */
  private aiGate: Promise<unknown> = Promise.resolve();
  private gated<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.aiGate.then(fn, fn); // run next regardless of the previous outcome
    this.aiGate = next.catch(() => undefined); // a failure must not poison the chain
    return next;
  }

  /** Write the uploaded buffers to disk so this report can be re-analysed later,
   *  and so a follow-up upload can be analysed alongside them. Best-effort: a
   *  storage failure must not fail the analysis the patient is waiting on. */
  private async persistDocs(docs: Doc[]): Promise<DocPair[]> {
    const out: DocPair[] = [];
    for (const d of docs) {
      try {
        const path = join(REPORT_DOCS_DIR, `${Date.now()}-${randomBytes(6).toString('hex')}${extname(d.originalname || '') || ''}`);
        await writeFile(path, d.buffer);
        out.push({ doc: d, rec: { path, name: d.originalname, mime: d.mimetype } });
      } catch (err: any) {
        // Analysis still runs on the in-memory buffer; only re-use later is lost.
        this.logger.warn(`Could not persist ${d.originalname || 'document'}: ${err.message}`);
        out.push({ doc: d, rec: { path: '', name: d.originalname, mime: d.mimetype } });
      }
    }
    return out;
  }

  /** Read persisted documents back. Files can vanish (manual cleanup, ephemeral
   *  disk on redeploy) — skip those rather than failing the whole run. */
  private async loadDocs(stored: unknown): Promise<{ docs: Doc[]; records: StoredDoc[]; pairs: DocPair[] }> {
    const list = Array.isArray(stored) ? (stored as StoredDoc[]) : [];
    const pairs: DocPair[] = [];
    for (const s of list) {
      if (!s?.path) continue;
      try {
        pairs.push({ doc: { buffer: await readFile(s.path), mimetype: s.mime, originalname: s.name }, rec: s });
      } catch {
        this.logger.warn(`Stored document missing, skipping: ${s.path}`);
      }
    }
    return { docs: pairs.map((p) => p.doc), records: pairs.map((p) => p.rec), pairs };
  }

  /**
   * OCR a scanned PDF: rasterise each page and read it with Tesseract.
   *
   * Deliberately NOT the vision model, even though the gateway runs one and it
   * transcribed this document well. Tesseract is a deterministic OCR engine — it
   * cannot invent a value that isn't on the page, whereas an LLM asked to
   * "transcribe" can quietly paraphrase a stenosis percentage. It also runs on CPU,
   * so it doesn't consume the single GPU that analyses are already queued behind.
   * ponytail: not serialised through aiGate — this is CPU work and doesn't contend
   *   with the GPU. Add a limit only if concurrent OCR actually starves the box.
   */
  private async ocrPdf(file: Doc): Promise<string | undefined> {
    let worker: any;
    try {
      const parser = new PDFParse({ data: file.buffer });
      const shot = await parser.getScreenshot({ scale: OCR_SCALE });
      await parser.destroy?.();

      const pages = (shot?.pages || []).slice(0, OCR_MAX_PAGES);
      if (!pages.length) return undefined;
      if ((shot?.pages || []).length > OCR_MAX_PAGES) {
        this.logger.warn(`OCR: ${file.originalname} has ${shot.pages.length} pages — reading the first ${OCR_MAX_PAGES}`);
      }

      // One worker for the whole document; spinning one up per page dominates the cost.
      const { createWorker } = await import('tesseract.js');
      worker = await createWorker('eng', 1, { cachePath: OCR_CACHE_DIR });

      const out: string[] = [];
      for (const pg of pages) {
        const { data } = await worker.recognize(Buffer.from(pg.data));
        if (data?.text?.trim()) out.push(data.text.trim());
      }
      const text = out.join('\n\n').trim();
      this.logger.log(`OCR: read ${pages.length} page(s) of ${file.originalname || 'document'} → ${text.length} chars`);
      return text || undefined;
    } catch (err: any) {
      this.logger.warn(`OCR failed for ${file.originalname || 'document'}: ${err.message}`);
      return undefined;
    } finally {
      await worker?.terminate().catch(() => undefined);
    }
  }

  /** Extract plain text from an uploaded PDF so the AI can read the actual report. */
  private async extractPdfText(file?: Doc): Promise<string | undefined> {
    if (!file || file.mimetype !== 'application/pdf') return undefined;
    try {
      const parser = new PDFParse({ data: file.buffer });
      const { text } = await parser.getText();
      await parser.destroy?.();
      const clean = (text || '').replace(/\s+\n/g, '\n').trim();

      // Unicode-aware letter count (patients upload Arabic/Devanagari reports too,
      // so an A-Z count would wrongly reject them as scans).
      const letters = clean.replace(PAGE_MARKER_RE, '').match(/\p{L}/gu)?.length ?? 0;
      if (letters < MIN_PDF_TEXT_LETTERS) {
        // A scan. Read the pages with OCR rather than refusing — patients routinely
        // get their reports as scanned PDFs, and the alternative is asking them to
        // re-photograph a document they already have.
        this.logger.log(`PDF has no text layer (${letters} letters) — running OCR: ${file.originalname || 'document'}`);
        const ocr = await this.ocrPdf(file);
        // Hold OCR output to the same bar as a native text layer: a blank or
        // near-blank read must fail loudly, not become a groundless "analysis".
        const ocrLetters = ocr?.match(/\p{L}/gu)?.length ?? 0;
        if (ocrLetters < MIN_PDF_TEXT_LETTERS) {
          this.logger.warn(`OCR produced too little text (${ocrLetters} letters): ${file.originalname || 'document'}`);
          return undefined;
        }
        return ocr!.slice(0, 12000);
      }

      // Cap to keep the prompt bounded.
      return clean.slice(0, 12000);
    } catch (err) {
      this.logger.warn(`PDF text extraction failed: ${err.message}`);
      return undefined;
    }
  }

  /**
   * Kick off an analysis as a BACKGROUND job (RCA fix #6): create a PROCESSING
   * report row, return its id immediately so the browser request isn't held open
   * for the full generation, and run the AI work asynchronously. The frontend
   * polls `getReport` and reads `rawAnalysis.phase` to show live progress (#3).
   * Job state lives in `rawAnalysis` (`{ status, phase }`) — no schema change.
   */
  async analyzeAndStore(params: {
    userId?: string;
    file?: Express.Multer.File;
    files?: Express.Multer.File[]; // multi-document upload
    description?: string;
    treatment?: string;
    country?: string;
    urgency?: string;
    previousReportId?: string; // analyse the new file(s) TOGETHER with this report's documents
    reanalysisCount?: number;
  }) {
    const fresh: Doc[] = params.files?.length ? params.files : params.file ? [params.file] : [];

    // Carry the earlier report's documents forward so the model sees the whole
    // picture, not just the newest page. Ownership-checked: previousReportId comes
    // from the client, and an unchecked id would pull another patient's PHI into
    // this analysis. Same 404-for-both rule as getReport (no id enumeration).
    let carried: StoredDoc[] = [];
    if (params.previousReportId) {
      const prev = await this.prisma.report.findUnique({ where: { id: params.previousReportId } });
      if (!prev || (params.userId && prev.userId !== params.userId)) throw new NotFoundException('Report not found');
      carried = Array.isArray(prev.docPaths) ? (prev.docPaths as unknown as StoredDoc[]) : [];
    }

    // The cap spans carried + new, not per request — otherwise "upload another
    // report" could add 8 more each time and grow the prompt without limit.
    // Enforced here because the client's own count is only a convenience.
    if (carried.length + fresh.length > MAX_DOCUMENTS) {
      const room = Math.max(0, MAX_DOCUMENTS - carried.length);
      throw new BadRequestException(
        room === 0
          ? `This analysis already covers the maximum of ${MAX_DOCUMENTS} documents. Start a new analysis to add more.`
          : `This analysis already covers ${carried.length} document(s) — you can add ${room} more (${MAX_DOCUMENTS} total).`,
      );
    }

    const hasPdf = [...carried.map((c) => ({ mimetype: c.mime })), ...fresh].some((f) => f.mimetype === 'application/pdf');
    const names = [...carried.map((c) => c.name), ...fresh.map((f) => f.originalname)].filter(Boolean);

    const report = await this.prisma.report.create({
      data: {
        userId: params.userId || null,
        reportRef: `RPT-${Date.now()}`,
        filename: names.join(', ') || undefined,
        fileType: fresh[0]?.mimetype || carried[0]?.mime,
        treatment: params.treatment,
        country: params.country,
        urgency: params.urgency,
        reanalysisCount: params.reanalysisCount ?? 0,
        rawAnalysis: { status: 'PROCESSING', phase: hasPdf ? 'reading' : 'analyzing', startedAt: Date.now() },
      },
    });

    // Fire-and-forget: PrismaService is app-scoped, and the in-memory Multer
    // buffers stay referenced by this closure until the job finishes.
    this.runAnalysisJob(report.id, fresh, carried, params).catch((err) =>
      this.logger.error(`Analysis job ${report.id} crashed: ${err?.message}`),
    );

    return { success: true, reportId: report.id, reportRef: report.reportRef, status: 'PROCESSING' };
  }

  /**
   * Re-run an existing report's analysis on its stored documents. Produces a NEW
   * report row rather than overwriting: if the re-run fails, the patient still has
   * their original analysis to fall back on. Capped at MAX_REANALYSIS.
   */
  async reanalyze(reportId: string, userId: string, isAdmin = false) {
    const prev = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!prev || (!isAdmin && prev.userId !== userId)) throw new NotFoundException('Report not found');

    if (prev.reanalysisCount >= MAX_REANALYSIS) {
      throw new BadRequestException(`This report has already been re-analysed ${MAX_REANALYSIS} times. Upload the report again for a fresh analysis.`);
    }
    // The documents are the whole input — without them a "re-analysis" would fall
    // back to the journey description and quietly produce a weaker, N/A-filled report.
    const { records } = await this.loadDocs(prev.docPaths);
    if (!records.length) {
      throw new BadRequestException('The original documents are no longer available — please upload the report again.');
    }

    return this.analyzeAndStore({
      userId,
      previousReportId: reportId,
      treatment: prev.treatment ?? undefined,
      country: prev.country ?? undefined,
      urgency: prev.urgency ?? undefined,
      reanalysisCount: prev.reanalysisCount + 1,
    });
  }

  /** The actual analysis work, run outside the request lifecycle. Updates the
   *  report row's `phase` as it progresses, then writes the final analysis. */
  private async runAnalysisJob(
    reportId: string,
    fresh: Doc[],
    carried: StoredDoc[],
    params: { description?: string; treatment?: string; country?: string; urgency?: string },
  ) {
    // `startedAt` must survive every phase write — getReport uses it to tell a
    // live job from one whose process died mid-run (see STALE_JOB_MS).
    const startedAt = Date.now();
    const setPhase = (phase: string) =>
      this.prisma.report.update({ where: { id: reportId }, data: { rawAnalysis: { status: 'PROCESSING', phase, startedAt } } });
    try {
      // Phase 1 — read the documents (extract PDF text, collect images for vision).
      // Earlier reports first, newest last: the model reads them in order, so the
      // most recent findings land closest to the question.
      const { pairs: carriedPairs } = await this.loadDocs(carried);
      // Keep the new files for future re-runs / follow-up uploads. Carried ones are
      // already on disk — reference them again rather than writing a second copy.
      const pairs = [...carriedPairs, ...(await this.persistDocs(fresh))];
      const docs = pairs.map((p) => p.doc);

      const images = docs
        .filter((f) => f.mimetype?.startsWith('image/'))
        .map((f) => ({ base64: f.buffer.toString('base64'), type: f.mimetype }));

      const pdfTexts: string[] = [];
      for (const p of pairs) {
        // Reuse text extracted on a previous run. Without this, every follow-up
        // upload re-OCRs all the earlier scans (~18 s each) and a full 8-document
        // analysis would run for minutes and risk the client's poll timing out.
        const txt = p.rec.text ?? (await this.extractPdfText(p.doc));
        if (txt) {
          p.rec.text = txt;
          pdfTexts.push(`--- ${p.doc.originalname || 'document'} ---\n${txt}`);
        }
      }
      const docPaths = pairs.map((p) => p.rec);
      const reportText = pdfTexts.length ? pdfTexts.join('\n\n').slice(0, 16000) : undefined;

      // Documents were submitted but NOTHING readable came out of them — a scanned
      // PDF with no text layer, or a DOCX (accepted by the upload filter, never
      // parsed). Analysing anyway would hand the model only the journey's treatment
      // hint, and it answers with a confident, entirely invented diagnosis. Fail
      // loudly instead: a fabricated medical report is far worse than no report.
      if (docs.length && !images.length && !reportText) {
        this.logger.warn(`Analysis job ${reportId}: ${docs.length} document(s) yielded no readable content`);
        await this.prisma.report.update({
          where: { id: reportId },
          data: {
            rawAnalysis: {
              status: 'ERROR',
              error:
                "We couldn't read any text in that document — it looks like a scan or photo saved as a PDF. " +
                'Please upload the original PDF (one where you can select the text), or upload clear photos/screenshots of the report pages as JPG or PNG instead.',
            },
          },
        });
        return;
      }

      // Phase 2 — AI analysis (the slow part), serialised across patients.
      await setPhase('analyzing');
      const analysis = await this.gated(() =>
        this.ai.analyzeReport({
          files: images, reportText,
          description: params.description, treatment: params.treatment, country: params.country, urgency: params.urgency,
        }),
      );

      // Phase 3 — persist the finished report.
      await this.prisma.report.update({
        where: { id: reportId },
        data: {
          reportRef: analysis.reportId ? `${analysis.reportId}-${reportId.slice(-6)}` : undefined,
          language: analysis.language,
          confidence: analysis.confidence,
          conditionName: analysis.diagnosis?.condition,
          conditionMedical: analysis.diagnosis?.medical,
          conditionPlain: analysis.diagnosis?.plain,
          severity: analysis.diagnosis?.severity,
          patientAge: analysis.extractedData?.patientAge,
          patientName: analysis.extractedData?.patientName,
          scanType: analysis.extractedData?.scanType,
          scanDate: analysis.extractedData?.scanDate,
          referringDoctor: analysis.extractedData?.referringDoctor,
          flags: analysis.flags,
          rawAnalysis: analysis,
          docPaths: docPaths as any,
        },
      });
    } catch (err: any) {
      this.logger.error(`Analysis job ${reportId} failed: ${err?.message}`);
      await this.prisma.report
        .update({ where: { id: reportId }, data: { rawAnalysis: { status: 'ERROR', error: 'Analysis failed — please try again.' } } })
        .catch(() => undefined);
    }
  }

  /**
   * Fetch a stored analysis. PHI — the caller must own the report (or be an
   * admin). A missing report and an unauthorized one both surface as 404 so we
   * don't leak which report ids exist (prevents enumeration).
   */
  async getReport(id: string, requesterId: string, isAdmin = false) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');
    if (!isAdmin && report.userId !== requesterId) {
      throw new NotFoundException('Report not found');
    }
    // The frontend expects the nested analysis shape (diagnosis/extractedData/flags),
    // which is stored in rawAnalysis. While a background job runs, it holds
    // `{ status, phase }` instead — surface that so the client can poll (#6).
    const raw = (report.rawAnalysis as any) ?? null;
    if (raw && raw.status === 'PROCESSING') {
      // Jobs are fire-and-forget, so a deploy/restart/crash kills any in-flight run
      // and leaves its row PROCESSING forever — the patient polls, gives up, and the
      // report is permanently stuck with no way back. Anything older than the longest
      // plausible run (queue wait included) is dead: report it as a retryable error.
      if (Date.now() - (raw.startedAt || 0) > STALE_JOB_MS) {
        return { status: 'ERROR', error: 'Analysis was interrupted — please try again.', reportId: report.id };
      }
      return { status: 'PROCESSING', phase: raw.phase || 'analyzing', reportId: report.id };
    }
    if (raw && raw.status === 'ERROR') {
      return { status: 'ERROR', error: raw.error || 'Analysis failed.', reportId: report.id };
    }
    if (raw && raw.diagnosis) {
      // `reanalysesLeft` drives the re-analyse button — the UI shouldn't have to
      // know the cap, and can't offer a re-run once the source docs are gone.
      const docCount = Array.isArray(report.docPaths) ? report.docPaths.length : 0;
      return {
        ...raw,
        status: 'DONE',
        reportRef: report.reportRef,
        reportId: report.id,
        reanalysesLeft: docCount ? Math.max(0, MAX_REANALYSIS - report.reanalysisCount) : 0,
        // Drives "you can add N more" — the cap counts documents already covered by
        // this analysis, so the UI must not assume a fresh 8.
        documentCount: docCount,
        documentsLeft: Math.max(0, MAX_DOCUMENTS - docCount),
      };
    }
    return report;
  }

  /** Size of a stored document, or null if the file is no longer on disk (manual
   *  cleanup, ephemeral disk on redeploy). Null is what marks a row unavailable. */
  private async fileSize(path?: string): Promise<number | null> {
    if (!path) return null;
    try {
      return (await stat(path)).size;
    } catch {
      return null;
    }
  }

  /**
   * Every document this patient has uploaded, grouped by the journey it belongs to.
   *
   * A journey points at its report (Journey.reportId), so the grouping is that link
   * inverted. Reports with no journey pointing at them — a direct upload from the
   * Analyse page, or an older report superseded when a re-analysis produced a new
   * row — still belong to the patient and would otherwise be invisible, so they land
   * in a trailing "Not linked to a journey" group rather than being dropped.
   *
   * PHI: scoped to `userId` by the query itself; there is no id parameter to abuse.
   */
  async listMyDocuments(userId: string) {
    const [reports, journeys] = await Promise.all([
      this.prisma.report.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        // Deliberately NOT the whole row: rawAnalysis carries the full diagnosis and
        // docPaths[].text the extracted report text — neither belongs in a file list.
        select: { id: true, reportRef: true, createdAt: true, conditionName: true, treatment: true, docPaths: true },
      }),
      this.prisma.journey.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, title: true, treatment: true, status: true, reportId: true },
      }),
    ]);

    const journeyByReport = new Map(journeys.filter((j) => j.reportId).map((j) => [j.reportId as string, j]));

    // Re-analysing, or adding a page to an existing analysis, creates a NEW report
    // row that REFERENCES the same files on disk rather than copying them (see
    // runAnalysisJob: carried docs are reused). One real upload therefore appears in
    // several reports — measured on live data: 9 document references, 3 actual files.
    // Listing them raw would show the patient the same PDF six times, so a file is
    // emitted once, under the first report that claims it.
    //
    // Journey-linked reports are processed first so a shared file is filed under the
    // journey it belongs to, never stranded in the trailing "unlinked" group.
    const ordered = [
      ...reports.filter((r) => journeyByReport.has(r.id)),
      ...reports.filter((r) => !journeyByReport.has(r.id)),
    ];

    // Keyed by journey id so a journey whose documents span several reports (the
    // original plus a re-analysis) shows them together under one heading.
    const groups = new Map<string, { journeyId: string | null; title: string; treatment: string | null; status: string | null; documents: any[] }>();
    const seenPaths = new Set<string>();

    for (const r of ordered) {
      const stored = Array.isArray(r.docPaths) ? (r.docPaths as unknown as StoredDoc[]) : [];
      if (!stored.length) continue; // a report whose upload never persisted has nothing to manage

      // Keep the original index: it is the document's address in the file route,
      // and filtering first would renumber it and stream the wrong document.
      const fresh = stored
        .map((s, index) => ({ s, index }))
        // A blank path is a persist failure (see persistDocs) — that file was never
        // written, so it can never be retrieved. A row that can't ever open is noise.
        .filter(({ s }) => s.path && !seenPaths.has(s.path));
      if (!fresh.length) continue;
      fresh.forEach(({ s }) => seenPaths.add(s.path));

      const j = journeyByReport.get(r.id);
      const key = j?.id ?? '__unlinked__';
      if (!groups.has(key)) {
        groups.set(key, {
          journeyId: j?.id ?? null,
          title: j ? j.title || j.treatment || 'Untitled journey' : 'Not linked to a journey',
          treatment: j?.treatment ?? null,
          status: j?.status ?? null,
          documents: [],
        });
      }

      const docs = await Promise.all(
        fresh.map(async ({ s, index }) => ({
          // reportId + index is the document's address — docPaths is a JSON array
          // with no ids of its own, and the index is what the file route resolves.
          reportId: r.id,
          index,
          name: s.name || `Document ${index + 1}`,
          mime: s.mime,
          size: await this.fileSize(s.path),
          uploadedAt: r.createdAt,
          reportRef: r.reportRef,
          condition: r.conditionName,
        })),
      );
      groups.get(key)!.documents.push(...docs);
    }

    // Unlinked last: the patient's own journeys are what they came here to find.
    return [...groups.values()].sort((a, b) => (a.journeyId ? 0 : 1) - (b.journeyId ? 0 : 1));
  }

  /**
   * Resolve one stored document for streaming. PHI — same ownership rule and same
   * uniform 404 as getReport, so a wrong id can't be used to probe what exists.
   */
  async documentFile(reportId: string, index: number, userId: string, isAdmin = false) {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report || (!isAdmin && report.userId !== userId)) throw new NotFoundException('Document not found');

    const stored = Array.isArray(report.docPaths) ? (report.docPaths as unknown as StoredDoc[]) : [];
    // The index is client-supplied: reject anything that isn't a real slot rather
    // than letting `stored[NaN]` fall through as undefined.
    const doc = Number.isInteger(index) && index >= 0 ? stored[index] : undefined;
    if (!doc?.path) throw new NotFoundException('Document not found');

    // The path itself is ours (written by persistDocs), never client input — but the
    // file can be gone, and a missing file must 404 rather than crash the stream.
    if ((await this.fileSize(doc.path)) === null) throw new NotFoundException('Document not found');

    return { path: doc.path, name: doc.name || `document-${index + 1}`, mime: doc.mime };
  }
}
