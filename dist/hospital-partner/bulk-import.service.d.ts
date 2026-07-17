export type ImportKind = 'doctors' | 'packages';
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
export declare class BulkImportService {
    template(kind: ImportKind): string;
    private spec;
    parse<T = any>(kind: ImportKind, file?: Express.Multer.File): ImportPreview<T>;
}
