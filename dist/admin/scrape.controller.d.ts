import { ScrapeService } from './scrape.service';
import { EnrichmentService } from './enrichment.service';
import { ReviewLangService } from './review-lang.service';
import { FileImportService } from './file-import.service';
import { TriggerScrapeDto } from './dto/trigger-scrape.dto';
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
        id: string;
        error: string | null;
        createdAt: Date;
        status: import(".prisma/client").$Enums.ScrapeStatus;
        updatedAt: Date;
        startedAt: Date | null;
        finishedAt: Date | null;
        params: import("@prisma/client/runtime/library").JsonValue | null;
        created: number;
        updated: number;
        skipped: number;
        target: string;
        stages: import("@prisma/client/runtime/library").JsonValue | null;
        summary: import("@prisma/client/runtime/library").JsonValue | null;
        logPath: string | null;
        output: string | null;
        triggeredBy: string | null;
    }>;
    scrapeAll(req: any): Promise<{
        id: string;
        error: string | null;
        createdAt: Date;
        status: import(".prisma/client").$Enums.ScrapeStatus;
        updatedAt: Date;
        startedAt: Date | null;
        finishedAt: Date | null;
        params: import("@prisma/client/runtime/library").JsonValue | null;
        created: number;
        updated: number;
        skipped: number;
        target: string;
        stages: import("@prisma/client/runtime/library").JsonValue | null;
        summary: import("@prisma/client/runtime/library").JsonValue | null;
        logPath: string | null;
        output: string | null;
        triggeredBy: string | null;
    }>;
    scrapeNext(req: any): Promise<{
        id: string;
        error: string | null;
        createdAt: Date;
        status: import(".prisma/client").$Enums.ScrapeStatus;
        updatedAt: Date;
        startedAt: Date | null;
        finishedAt: Date | null;
        params: import("@prisma/client/runtime/library").JsonValue | null;
        created: number;
        updated: number;
        skipped: number;
        target: string;
        stages: import("@prisma/client/runtime/library").JsonValue | null;
        summary: import("@prisma/client/runtime/library").JsonValue | null;
        logPath: string | null;
        output: string | null;
        triggeredBy: string | null;
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
        id: string;
        error: string | null;
        createdAt: Date;
        status: import(".prisma/client").$Enums.ScrapeStatus;
        updatedAt: Date;
        startedAt: Date | null;
        finishedAt: Date | null;
        params: import("@prisma/client/runtime/library").JsonValue | null;
        created: number;
        updated: number;
        skipped: number;
        target: string;
        stages: import("@prisma/client/runtime/library").JsonValue | null;
        summary: import("@prisma/client/runtime/library").JsonValue | null;
        logPath: string | null;
        output: string | null;
        triggeredBy: string | null;
    }[]>;
    findOne(id: string): Promise<{
        id: string;
        error: string | null;
        createdAt: Date;
        status: import(".prisma/client").$Enums.ScrapeStatus;
        updatedAt: Date;
        startedAt: Date | null;
        finishedAt: Date | null;
        params: import("@prisma/client/runtime/library").JsonValue | null;
        created: number;
        updated: number;
        skipped: number;
        target: string;
        stages: import("@prisma/client/runtime/library").JsonValue | null;
        summary: import("@prisma/client/runtime/library").JsonValue | null;
        logPath: string | null;
        output: string | null;
        triggeredBy: string | null;
    }>;
}
