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
exports.UploadService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const ai_service_1 = require("../ai/ai.service");
const pdf_parse_1 = require("pdf-parse");
let UploadService = UploadService_1 = class UploadService {
    constructor(prisma, ai) {
        this.prisma = prisma;
        this.ai = ai;
        this.logger = new common_1.Logger(UploadService_1.name);
    }
    async extractPdfText(file) {
        if (!file || file.mimetype !== 'application/pdf')
            return undefined;
        try {
            const parser = new pdf_parse_1.PDFParse({ data: file.buffer });
            const { text } = await parser.getText();
            await parser.destroy?.();
            const clean = (text || '').replace(/\s+\n/g, '\n').trim();
            return clean ? clean.slice(0, 12000) : undefined;
        }
        catch (err) {
            this.logger.warn(`PDF text extraction failed: ${err.message}`);
            return undefined;
        }
    }
    async analyzeAndStore(params) {
        let fileBase64;
        let fileType;
        if (params.file) {
            fileBase64 = params.file.buffer.toString('base64');
            fileType = params.file.mimetype;
        }
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
    async getReport(id, requesterId, isAdmin = false) {
        const report = await this.prisma.report.findUnique({ where: { id } });
        if (!report)
            throw new common_1.NotFoundException('Report not found');
        if (!isAdmin && report.userId !== requesterId) {
            throw new common_1.NotFoundException('Report not found');
        }
        const raw = report.rawAnalysis ?? null;
        if (raw && raw.diagnosis) {
            return { ...raw, reportRef: report.reportRef, reportId: report.id };
        }
        return report;
    }
};
exports.UploadService = UploadService;
exports.UploadService = UploadService = UploadService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, ai_service_1.AiService])
], UploadService);
//# sourceMappingURL=upload.service.js.map