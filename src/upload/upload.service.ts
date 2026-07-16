import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
// pdf-parse v2 is class-based: new PDFParse({ data }).getText()
import { PDFParse } from 'pdf-parse';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  constructor(private prisma: PrismaService, private ai: AiService) {}

  /** Extract plain text from an uploaded PDF so the AI can read the actual report. */
  private async extractPdfText(file?: Express.Multer.File): Promise<string | undefined> {
    if (!file || file.mimetype !== 'application/pdf') return undefined;
    try {
      const parser = new PDFParse({ data: file.buffer });
      const { text } = await parser.getText();
      await parser.destroy?.();
      const clean = (text || '').replace(/\s+\n/g, '\n').trim();
      // Cap to keep the prompt bounded.
      return clean ? clean.slice(0, 12000) : undefined;
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
  }) {
    const docs = params.files?.length ? params.files : params.file ? [params.file] : [];
    const hasPdf = docs.some((f) => f.mimetype === 'application/pdf');

    const report = await this.prisma.report.create({
      data: {
        userId: params.userId || null,
        reportRef: `RPT-${Date.now()}`,
        filename: docs.map((f) => f.originalname).filter(Boolean).join(', ') || undefined,
        fileType: docs[0]?.mimetype,
        treatment: params.treatment,
        country: params.country,
        urgency: params.urgency,
        rawAnalysis: { status: 'PROCESSING', phase: hasPdf ? 'reading' : 'analyzing', startedAt: Date.now() },
      },
    });

    // Fire-and-forget: PrismaService is app-scoped, and the in-memory Multer
    // buffers stay referenced by this closure until the job finishes.
    this.runAnalysisJob(report.id, docs, params).catch((err) =>
      this.logger.error(`Analysis job ${report.id} crashed: ${err?.message}`),
    );

    return { success: true, reportId: report.id, reportRef: report.reportRef, status: 'PROCESSING' };
  }

  /** The actual analysis work, run outside the request lifecycle. Updates the
   *  report row's `phase` as it progresses, then writes the final analysis. */
  private async runAnalysisJob(
    reportId: string,
    docs: Express.Multer.File[],
    params: { description?: string; treatment?: string; country?: string; urgency?: string },
  ) {
    const setPhase = (phase: string) =>
      this.prisma.report.update({ where: { id: reportId }, data: { rawAnalysis: { status: 'PROCESSING', phase } } });
    try {
      // Phase 1 — read the documents (extract PDF text, collect images for vision).
      const images = docs
        .filter((f) => f.mimetype?.startsWith('image/'))
        .map((f) => ({ base64: f.buffer.toString('base64'), type: f.mimetype }));
      const pdfTexts: string[] = [];
      for (const f of docs) {
        const txt = await this.extractPdfText(f);
        if (txt) pdfTexts.push(`--- ${f.originalname || 'document'} ---\n${txt}`);
      }
      const reportText = pdfTexts.length ? pdfTexts.join('\n\n').slice(0, 16000) : undefined;

      // Phase 2 — AI analysis (the slow part).
      await setPhase('analyzing');
      const analysis = await this.ai.analyzeReport({
        files: images, reportText,
        description: params.description, treatment: params.treatment, country: params.country, urgency: params.urgency,
      });

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
      return { status: 'PROCESSING', phase: raw.phase || 'analyzing', reportId: report.id };
    }
    if (raw && raw.status === 'ERROR') {
      return { status: 'ERROR', error: raw.error || 'Analysis failed.', reportId: report.id };
    }
    if (raw && raw.diagnosis) {
      return { ...raw, status: 'DONE', reportRef: report.reportRef, reportId: report.id };
    }
    return report;
  }
}
