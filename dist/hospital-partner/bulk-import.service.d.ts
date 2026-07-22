export type ImportKind = 'profile' | 'doctors' | 'packages';
export type ImportTarget = ImportKind | 'all';
export declare const IMPORT_KINDS: ImportKind[];
export declare const CSV_MAX_BYTES: number;
export declare const csvFileFilter: (_req: any, file: Express.Multer.File, cb: (e: Error | null, ok: boolean) => void) => void;
export interface ImportError {
    row: number;
    message: string;
}
export interface ImportPreview<T> {
    rows: T[];
    errors: ImportError[];
}
export interface ImportAll {
    profile: Record<string, any> | null;
    doctors: Record<string, any>[];
    packages: Record<string, any>[];
    errors: ImportError[];
}
export declare class BulkImportService {
    template(kind: ImportKind): string;
    templateAllXlsx(): Promise<Buffer>;
    templateAllCsv(): string;
    private header;
    private spec;
    private sheets;
    private validate;
    parse<T = any>(kind: ImportKind, file?: Express.Multer.File): Promise<ImportPreview<T>>;
    parseAll(file?: Express.Multer.File): Promise<ImportAll>;
    private markedBlock;
    private stripMarkers;
}
