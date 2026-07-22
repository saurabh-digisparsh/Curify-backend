import { ScrapeService } from './scrape.service';
import { EnrichmentService } from './enrichment.service';
import { ReviewLangService } from './review-lang.service';
import { FileImportService } from './file-import.service';
import { TriggerScrapeDto, ScrapeAllDto } from './dto/trigger-scrape.dto';
export declare class AdminScrapeController {
    private readonly scrape;
    private readonly enrichment;
    private readonly reviewLang;
    private readonly fileImport;
    constructor(scrape: ScrapeService, enrichment: EnrichmentService, reviewLang: ReviewLangService, fileImport: FileImportService);
    importPreview(file: Express.Multer.File): {
        rows: import("./file-import.service").PreviewRow[];
        valid: number;
        invalid: number;
    };
    importCommit(body: {
        rows: any[];
    }): Promise<{
        created: number;
        updated: number;
        skipped: number;
        dropped: {
            name: string;
            city: string;
            reason: string;
        }[];
        enrichStarted: boolean;
    }>;
    trigger(dto: TriggerScrapeDto, req: any): Promise<{
        error: string | null;
        params: import("@prisma/client/runtime/library").JsonValue | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        summary: import("@prisma/client/runtime/library").JsonValue | null;
        created: number;
        status: import(".prisma/client").$Enums.ScrapeStatus;
        startedAt: Date | null;
        target: string;
        updated: number;
        skipped: number;
        stages: import("@prisma/client/runtime/library").JsonValue | null;
        logPath: string | null;
        output: string | null;
        triggeredBy: string | null;
        finishedAt: Date | null;
    }>;
    scrapeAll(dto: ScrapeAllDto, req: any): Promise<{
        error: string | null;
        params: import("@prisma/client/runtime/library").JsonValue | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        summary: import("@prisma/client/runtime/library").JsonValue | null;
        created: number;
        status: import(".prisma/client").$Enums.ScrapeStatus;
        startedAt: Date | null;
        target: string;
        updated: number;
        skipped: number;
        stages: import("@prisma/client/runtime/library").JsonValue | null;
        logPath: string | null;
        output: string | null;
        triggeredBy: string | null;
        finishedAt: Date | null;
    }>;
    scrapeNext(req: any): Promise<{
        error: string | null;
        params: import("@prisma/client/runtime/library").JsonValue | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        summary: import("@prisma/client/runtime/library").JsonValue | null;
        created: number;
        status: import(".prisma/client").$Enums.ScrapeStatus;
        startedAt: Date | null;
        target: string;
        updated: number;
        skipped: number;
        stages: import("@prisma/client/runtime/library").JsonValue | null;
        logPath: string | null;
        output: string | null;
        triggeredBy: string | null;
        finishedAt: Date | null;
    }>;
    enrich(body: {
        force?: boolean;
        limit?: number;
    }): {
        started: boolean;
        force: boolean;
        limit: number;
    };
    localizeReviews(body: {
        limit?: number;
    }): {
        started: boolean;
        limit: number;
    };
    findAll(): import(".prisma/client").Prisma.PrismaPromise<{
        error: string | null;
        params: import("@prisma/client/runtime/library").JsonValue | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        summary: import("@prisma/client/runtime/library").JsonValue | null;
        created: number;
        status: import(".prisma/client").$Enums.ScrapeStatus;
        startedAt: Date | null;
        target: string;
        updated: number;
        skipped: number;
        stages: import("@prisma/client/runtime/library").JsonValue | null;
        logPath: string | null;
        output: string | null;
        triggeredBy: string | null;
        finishedAt: Date | null;
    }[]>;
    findOne(id: string): Promise<{
        error: string | null;
        params: import("@prisma/client/runtime/library").JsonValue | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        summary: import("@prisma/client/runtime/library").JsonValue | null;
        created: number;
        status: import(".prisma/client").$Enums.ScrapeStatus;
        startedAt: Date | null;
        target: string;
        updated: number;
        skipped: number;
        stages: import("@prisma/client/runtime/library").JsonValue | null;
        logPath: string | null;
        output: string | null;
        triggeredBy: string | null;
        finishedAt: Date | null;
    }>;
}
