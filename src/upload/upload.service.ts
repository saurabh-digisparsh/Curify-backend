import { Injectable, Logger } from '@nestjs/common';
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
    description?: string;
    treatment?: string;
    country?: string;
    urgency?: string;
  }) {
    let fileBase64: string | undefined;
    let fileType: string | undefined;

    if (params.file) {
      fileBase64 = params.file.buffer.toString('base64');
      fileType = params.file.mimetype;
    }

    // Pull text out of PDFs so the model analyses the real report content.
    const reportText = await this.extractPdfText(params.file);

    const analysis = await this.ai.analyzeReport({
      fileBase64,
      fileType,
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
        filename: params.file?.originalname,
        fileType: params.file?.mimetype,
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

  async getReport(id: string) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) return null;
    // The frontend expects the nested analysis shape (diagnosis/extractedData/flags),
    // which is stored in rawAnalysis. Fall back to the row for legacy records.
    const raw = (report.rawAnalysis as any) ?? null;
    if (raw && raw.diagnosis) {
      return { ...raw, reportRef: report.reportRef, reportId: report.id };
    }
    return report;
  }
}
