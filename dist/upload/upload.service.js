"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var UploadService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadService = exports.MAX_DOCUMENTS = exports.MAX_REANALYSIS = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const ai_service_1 = require("../ai/ai.service");
const pdf_parse_1 = require("pdf-parse");
const path_1 = require("path");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const crypto_1 = require("crypto");
const STALE_JOB_MS = 10 * 60_000;
exports.MAX_REANALYSIS = 2;
exports.MAX_DOCUMENTS = 8;
const REPORT_DOCS_DIR = (0, path_1.join)(process.cwd(), 'uploads', 'reports');
(0, fs_1.mkdirSync)(REPORT_DOCS_DIR, { recursive: true });
const PAGE_MARKER_RE = /--\s*\d+\s*of\s*\d+\s*--/gi;
const MIN_PDF_TEXT_LETTERS = 200;
const OCR_SCALE = 0.75;
const OCR_MAX_PAGES = 8;
const OCR_CACHE_DIR = (0, path_1.join)(process.cwd(), 'uploads', '.tesseract');
let UploadService = UploadService_1 = class UploadService {
    constructor(prisma, ai) {
        this.prisma = prisma;
        this.ai = ai;
        this.logger = new common_1.Logger(UploadService_1.name);
        this.aiGate = Promise.resolve();
    }
    gated(fn) {
        const next = this.aiGate.then(fn, fn);
        this.aiGate = next.catch(() => undefined);
        return next;
    }
    async persistDocs(docs) {
        const out = [];
        for (const d of docs) {
            try {
                const path = (0, path_1.join)(REPORT_DOCS_DIR, `${Date.now()}-${(0, crypto_1.randomBytes)(6).toString('hex')}${(0, path_1.extname)(d.originalname || '') || ''}`);
                await (0, promises_1.writeFile)(path, d.buffer);
                out.push({ doc: d, rec: { path, name: d.originalname, mime: d.mimetype } });
            }
            catch (err) {
                this.logger.warn(`Could not persist ${d.originalname || 'document'}: ${err.message}`);
                out.push({ doc: d, rec: { path: '', name: d.originalname, mime: d.mimetype } });
            }
        }
        return out;
    }
    async loadDocs(stored) {
        const list = Array.isArray(stored) ? stored : [];
        const pairs = [];
        for (const s of list) {
            if (!s?.path)
                continue;
            try {
                pairs.push({ doc: { buffer: await (0, promises_1.readFile)(s.path), mimetype: s.mime, originalname: s.name }, rec: s });
            }
            catch {
                this.logger.warn(`Stored document missing, skipping: ${s.path}`);
            }
        }
        return { docs: pairs.map((p) => p.doc), records: pairs.map((p) => p.rec), pairs };
    }
    async ocrPdf(file) {
        let worker;
        try {
            const parser = new pdf_parse_1.PDFParse({ data: file.buffer });
            const shot = await parser.getScreenshot({ scale: OCR_SCALE });
            await parser.destroy?.();
            const pages = (shot?.pages || []).slice(0, OCR_MAX_PAGES);
            if (!pages.length)
                return undefined;
            if ((shot?.pages || []).length > OCR_MAX_PAGES) {
                this.logger.warn(`OCR: ${file.originalname} has ${shot.pages.length} pages — reading the first ${OCR_MAX_PAGES}`);
            }
            const { createWorker } = await Promise.resolve().then(() => require('tesseract.js'));
            worker = await createWorker('eng', 1, { cachePath: OCR_CACHE_DIR });
            const out = [];
            for (const pg of pages) {
                const { data } = await worker.recognize(Buffer.from(pg.data));
                if (data?.text?.trim())
                    out.push(data.text.trim());
            }
            const text = out.join('\n\n').trim();
            this.logger.log(`OCR: read ${pages.length} page(s) of ${file.originalname || 'document'} → ${text.length} chars`);
            return text || undefined;
        }
        catch (err) {
            this.logger.warn(`OCR failed for ${file.originalname || 'document'}: ${err.message}`);
            return undefined;
        }
        finally {
            await worker?.terminate().catch(() => undefined);
        }
    }
    async extractPdfText(file) {
        if (!file || file.mimetype !== 'application/pdf')
            return undefined;
        try {
            const parser = new pdf_parse_1.PDFParse({ data: file.buffer });
            const { text } = await parser.getText();
            await parser.destroy?.();
            const clean = (text || '').replace(/\s+\n/g, '\n').trim();
            const letters = clean.replace(PAGE_MARKER_RE, '').match(/\p{L}/gu)?.length ?? 0;
            if (letters < MIN_PDF_TEXT_LETTERS) {
                this.logger.log(`PDF has no text layer (${letters} letters) — running OCR: ${file.originalname || 'document'}`);
                const ocr = await this.ocrPdf(file);
                const ocrLetters = ocr?.match(/\p{L}/gu)?.length ?? 0;
                if (ocrLetters < MIN_PDF_TEXT_LETTERS) {
                    this.logger.warn(`OCR produced too little text (${ocrLetters} letters): ${file.originalname || 'document'}`);
                    return undefined;
                }
                return ocr.slice(0, 12000);
            }
            return clean.slice(0, 12000);
        }
        catch (err) {
            this.logger.warn(`PDF text extraction failed: ${err.message}`);
            return undefined;
        }
    }
    async analyzeAndStore(params) {
        const fresh = params.files?.length ? params.files : params.file ? [params.file] : [];
        let carried = [];
        if (params.previousReportId) {
            const prev = await this.prisma.report.findUnique({ where: { id: params.previousReportId } });
            if (!prev || (params.userId && prev.userId !== params.userId))
                throw new common_1.NotFoundException('Report not found');
            carried = Array.isArray(prev.docPaths) ? prev.docPaths : [];
        }
        if (carried.length + fresh.length > exports.MAX_DOCUMENTS) {
            const room = Math.max(0, exports.MAX_DOCUMENTS - carried.length);
            throw new common_1.BadRequestException(room === 0
                ? `This analysis already covers the maximum of ${exports.MAX_DOCUMENTS} documents. Start a new analysis to add more.`
                : `This analysis already covers ${carried.length} document(s) — you can add ${room} more (${exports.MAX_DOCUMENTS} total).`);
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
        this.runAnalysisJob(report.id, fresh, carried, params).catch((err) => this.logger.error(`Analysis job ${report.id} crashed: ${err?.message}`));
        return { success: true, reportId: report.id, reportRef: report.reportRef, status: 'PROCESSING' };
    }
    async reanalyze(reportId, userId, isAdmin = false) {
        const prev = await this.prisma.report.findUnique({ where: { id: reportId } });
        if (!prev || (!isAdmin && prev.userId !== userId))
            throw new common_1.NotFoundException('Report not found');
        if (prev.reanalysisCount >= exports.MAX_REANALYSIS) {
            throw new common_1.BadRequestException(`This report has already been re-analysed ${exports.MAX_REANALYSIS} times. Upload the report again for a fresh analysis.`);
        }
        const { records } = await this.loadDocs(prev.docPaths);
        if (!records.length) {
            throw new common_1.BadRequestException('The original documents are no longer available — please upload the report again.');
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
    async runAnalysisJob(reportId, fresh, carried, params) {
        const startedAt = Date.now();
        const setPhase = (phase) => this.prisma.report.update({ where: { id: reportId }, data: { rawAnalysis: { status: 'PROCESSING', phase, startedAt } } });
        try {
            const { pairs: carriedPairs } = await this.loadDocs(carried);
            const pairs = [...carriedPairs, ...(await this.persistDocs(fresh))];
            const docs = pairs.map((p) => p.doc);
            const images = docs
                .filter((f) => f.mimetype?.startsWith('image/'))
                .map((f) => ({ base64: f.buffer.toString('base64'), type: f.mimetype }));
            const pdfTexts = [];
            for (const p of pairs) {
                const txt = p.rec.text ?? (await this.extractPdfText(p.doc));
                if (txt) {
                    p.rec.text = txt;
                    pdfTexts.push(`--- ${p.doc.originalname || 'document'} ---\n${txt}`);
                }
            }
            const docPaths = pairs.map((p) => p.rec);
            const reportText = pdfTexts.length ? pdfTexts.join('\n\n').slice(0, 16000) : undefined;
            if (docs.length && !images.length && !reportText) {
                this.logger.warn(`Analysis job ${reportId}: ${docs.length} document(s) yielded no readable content`);
                await this.prisma.report.update({
                    where: { id: reportId },
                    data: {
                        rawAnalysis: {
                            status: 'ERROR',
                            error: "We couldn't read any text in that document — it looks like a scan or photo saved as a PDF. " +
                                'Please upload the original PDF (one where you can select the text), or upload clear photos/screenshots of the report pages as JPG or PNG instead.',
                        },
                    },
                });
                return;
            }
            await setPhase('analyzing');
            const analysis = await this.gated(() => this.ai.analyzeReport({
                files: images, reportText,
                description: params.description, treatment: params.treatment, country: params.country, urgency: params.urgency,
            }));
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
                    docPaths: docPaths,
                },
            });
        }
        catch (err) {
            this.logger.error(`Analysis job ${reportId} failed: ${err?.message}`);
            await this.prisma.report
                .update({ where: { id: reportId }, data: { rawAnalysis: { status: 'ERROR', error: 'Analysis failed — please try again.' } } })
                .catch(() => undefined);
        }
    }
    async getReport(id, requesterId, isAdmin = false) {
        const report = await this.prisma.report.findUnique({ where: { id } });
        if (!report)
            throw new common_1.NotFoundException('Report not found');
        if (!isAdmin && report.userId !== requesterId) {
            throw new common_1.NotFoundException('Report not found');
        }
        const raw = report.rawAnalysis ?? null;
        if (raw && raw.status === 'PROCESSING') {
            if (Date.now() - (raw.startedAt || 0) > STALE_JOB_MS) {
                return { status: 'ERROR', error: 'Analysis was interrupted — please try again.', reportId: report.id };
            }
            return { status: 'PROCESSING', phase: raw.phase || 'analyzing', reportId: report.id };
        }
        if (raw && raw.status === 'ERROR') {
            return { status: 'ERROR', error: raw.error || 'Analysis failed.', reportId: report.id };
        }
        if (raw && raw.diagnosis) {
            const docCount = Array.isArray(report.docPaths) ? report.docPaths.length : 0;
            return {
                ...raw,
                status: 'DONE',
                reportRef: report.reportRef,
                reportId: report.id,
                reanalysesLeft: docCount ? Math.max(0, exports.MAX_REANALYSIS - report.reanalysisCount) : 0,
                documentCount: docCount,
                documentsLeft: Math.max(0, exports.MAX_DOCUMENTS - docCount),
            };
        }
        return report;
    }
    async fileSize(path) {
        if (!path)
            return null;
        try {
            return (await (0, promises_1.stat)(path)).size;
        }
        catch {
            return null;
        }
    }
    async listMyDocuments(userId) {
        const [reports, journeys] = await Promise.all([
            this.prisma.report.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                select: { id: true, reportRef: true, createdAt: true, conditionName: true, treatment: true, docPaths: true },
            }),
            this.prisma.journey.findMany({
                where: { userId },
                orderBy: { updatedAt: 'desc' },
                select: { id: true, title: true, treatment: true, status: true, reportId: true },
            }),
        ]);
        const journeyByReport = new Map(journeys.filter((j) => j.reportId).map((j) => [j.reportId, j]));
        const ordered = [
            ...reports.filter((r) => journeyByReport.has(r.id)),
            ...reports.filter((r) => !journeyByReport.has(r.id)),
        ];
        const groups = new Map();
        const seenPaths = new Set();
        for (const r of ordered) {
            const stored = Array.isArray(r.docPaths) ? r.docPaths : [];
            if (!stored.length)
                continue;
            const fresh = stored
                .map((s, index) => ({ s, index }))
                .filter(({ s }) => s.path && !seenPaths.has(s.path));
            if (!fresh.length)
                continue;
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
            const docs = await Promise.all(fresh.map(async ({ s, index }) => ({
                reportId: r.id,
                index,
                name: s.name || `Document ${index + 1}`,
                mime: s.mime,
                size: await this.fileSize(s.path),
                uploadedAt: r.createdAt,
                reportRef: r.reportRef,
                condition: r.conditionName,
            })));
            groups.get(key).documents.push(...docs);
        }
        return [...groups.values()].sort((a, b) => (a.journeyId ? 0 : 1) - (b.journeyId ? 0 : 1));
    }
    async documentFile(reportId, index, userId, isAdmin = false) {
        const report = await this.prisma.report.findUnique({ where: { id: reportId } });
        if (!report || (!isAdmin && report.userId !== userId))
            throw new common_1.NotFoundException('Document not found');
        const stored = Array.isArray(report.docPaths) ? report.docPaths : [];
        const doc = Number.isInteger(index) && index >= 0 ? stored[index] : undefined;
        if (!doc?.path)
            throw new common_1.NotFoundException('Document not found');
        if ((await this.fileSize(doc.path)) === null)
            throw new common_1.NotFoundException('Document not found');
        return { path: doc.path, name: doc.name || `document-${index + 1}`, mime: doc.mime };
    }
};
exports.UploadService = UploadService;
exports.UploadService = UploadService = UploadService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, ai_service_1.AiService])
], UploadService);
//# sourceMappingURL=upload.service.js.map