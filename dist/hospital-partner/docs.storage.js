"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.docFileFilter = exports.hospitalDocStorage = exports.ALLOWED_DOC_MIMES = exports.HOSPITAL_DOCS_DIR = void 0;
const multer_1 = require("multer");
const path_1 = require("path");
const fs_1 = require("fs");
const crypto_1 = require("crypto");
exports.HOSPITAL_DOCS_DIR = (0, path_1.join)(process.cwd(), 'uploads', 'hospital-docs');
(0, fs_1.mkdirSync)(exports.HOSPITAL_DOCS_DIR, { recursive: true });
exports.ALLOWED_DOC_MIMES = [
    'application/pdf', 'image/jpeg', 'image/png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
exports.hospitalDocStorage = (0, multer_1.diskStorage)({
    destination: exports.HOSPITAL_DOCS_DIR,
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${(0, crypto_1.randomBytes)(6).toString('hex')}${(0, path_1.extname)(file.originalname) || ''}`),
});
const docFileFilter = (_req, file, cb) => {
    if (exports.ALLOWED_DOC_MIMES.includes(file.mimetype))
        cb(null, true);
    else
        cb(new Error('Unsupported format. Use PDF, JPEG, PNG, or DOCX.'), false);
};
exports.docFileFilter = docFileFilter;
//# sourceMappingURL=docs.storage.js.map