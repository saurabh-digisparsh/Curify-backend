export declare const HOSPITAL_DOCS_DIR: string;
export declare const ALLOWED_DOC_MIMES: string[];
export declare const hospitalDocStorage: import("multer").StorageEngine;
export declare const docFileFilter: (_req: any, file: Express.Multer.File, cb: (e: Error | null, ok: boolean) => void) => void;
