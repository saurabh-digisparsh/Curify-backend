import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import { randomBytes } from 'crypto';

// Onboarding verification documents are stored on local disk (gitignored) and
// streamed via an auth-guarded route — never served statically. ponytail: local
// disk now; production should move these to encrypted object storage.
export const HOSPITAL_DOCS_DIR = join(process.cwd(), 'uploads', 'hospital-docs');
mkdirSync(HOSPITAL_DOCS_DIR, { recursive: true });

export const ALLOWED_DOC_MIMES = [
  'application/pdf', 'image/jpeg', 'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export const hospitalDocStorage = diskStorage({
  destination: HOSPITAL_DOCS_DIR,
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${randomBytes(6).toString('hex')}${extname(file.originalname) || ''}`),
});

export const docFileFilter = (_req: any, file: Express.Multer.File, cb: (e: Error | null, ok: boolean) => void) => {
  if (ALLOWED_DOC_MIMES.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Unsupported format. Use PDF, JPEG, PNG, or DOCX.'), false);
};
