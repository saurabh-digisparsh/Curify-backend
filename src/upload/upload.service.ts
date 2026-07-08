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

  async analyzeAndStore(params: {
    userId?: string;
    file?: Express.Multer.File;
    files?: Express.Multer.File[]; // multi-document upload
    description?: string;
    treatment?: string;
    country?: string;
    urgency?: string;
  }) {
    // Normalise to a list (supports both the single-file and multi-file paths).
    const docs = params.files?.length ? params.files : params.file ? [params.file] : [];

    // Collect image files for the vision model; extract text from every PDF.
    const images = docs
      .filter((f) => f.mimetype?.startsWith('image/'))
      .map((f) => ({ base64: f.buffer.toString('base64'), type: f.mimetype }));
    const pdfTexts: string[] = [];
    for (const f of docs) {
      const txt = await this.extractPdfText(f);
      if (txt) pdfTexts.push(`--- ${f.originalname || 'document'} ---\n${txt}`);
    }
    const reportText = pdfTexts.length ? pdfTexts.join('\n\n').slice(0, 16000) : undefined;

    const analysis = await this.ai.analyzeReport({
      files: images,
      reportText,
      description: params.description,
      treatment: params.treatment,
      country: params.country,
      urgency: params.urgency,
    });

    const report = await this.prisma.report.create({
      data: {
        userId: params.userId || null,
        reportRef: analysis.reportId
          ? `${analysis.reportId}-${Date.now().toString(36).slice(-6)}`
          : `RPT-${Date.now()}`,
        // Store all uploaded filenames (comma-joined) for the record.
        filename: docs.map((f) => f.originalname).filter(Boolean).join(', ') || undefined,
        fileType: docs[0]?.mimetype,
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
        treatment: params.treatment,
        country: params.country,
        urgency: params.urgency,
      },
    });

    return { success: true, reportId: report.id, reportRef: report.reportRef, analysis };
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
    // which is stored in rawAnalysis. Fall back to the row for legacy records.
    const raw = (report.rawAnalysis as any) ?? null;
    if (raw && raw.diagnosis) {
      return { ...raw, reportRef: report.reportRef, reportId: report.id };
    }
    return report;
  }
}
