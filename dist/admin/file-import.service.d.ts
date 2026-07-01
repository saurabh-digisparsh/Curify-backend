import { PrismaService } from '../prisma/prisma.service';
import { EnrichmentService } from './enrichment.service';
export declare const TEMPLATE_FIELDS: readonly ["name", "city", "country", "address", "website", "phone", "specialty"];
interface RawRow {
    [k: string]: any;
}
export interface PreviewRow {
    name: string;
    city: string;
    country?: string;
    address?: string;
    website?: string;
    phone?: string;
    specialty?: string;
    valid: boolean;
    reason: string;
}
export declare class FileImportService {
    private prisma;
    private enrichment;
    constructor(prisma: PrismaService, enrichment: EnrichmentService);
    parse(file: Express.Multer.File): RawRow[];
    validate(rows: RawRow[]): {
        rows: PreviewRow[];
        valid: number;
        invalid: number;
    };
    commit(rows: PreviewRow[]): Promise<{
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
}
export {};
