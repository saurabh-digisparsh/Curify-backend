"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BulkImportService = exports.csvFileFilter = exports.CSV_MAX_BYTES = void 0;
const common_1 = require("@nestjs/common");
const sync_1 = require("csv-parse/sync");
exports.CSV_MAX_BYTES = 2 * 1024 * 1024;
const csvFileFilter = (_req, file, cb) => {
    if (/\.csv$/i.test(file.originalname))
        cb(null, true);
    else
        cb(new common_1.BadRequestException('Upload a .csv file. In Excel: File → Save As → CSV.'), false);
};
exports.csvFileFilter = csvFileFilter;
const LIST_SEP = ';';
const SPECS = {
    doctors: {
        cols: [
            { key: 'name', label: 'name', required: true, hint: 'Dr. Anita Rao' },
            { key: 'specialty', label: 'specialty', hint: 'Orthopedics' },
            { key: 'subspecialty', label: 'subspecialty', hint: 'Knee & hip replacement' },
            { key: 'qualifications', label: 'qualifications', hint: 'MBBS, MS (Ortho)' },
            { key: 'yearsExperience', label: 'yearsExperience', kind: 'int', hint: '18' },
            { key: 'registrationNo', label: 'registrationNo', hint: 'DMC-12345' },
            { key: 'email', label: 'email', hint: 'anita.rao@hospital.com' },
            { key: 'languages', label: 'languages', kind: 'list', hint: 'English;Hindi;Arabic' },
            { key: 'proceduresPerformed', label: 'proceduresPerformed', kind: 'int', hint: '1200' },
            { key: 'bio', label: 'bio', hint: 'Senior consultant, 18 years in joint replacement.' },
            { key: 'teleconsultEnabled', label: 'teleconsultEnabled', kind: 'bool', hint: 'yes' },
        ],
        sample: [
            ['Dr. Anita Rao', 'Orthopedics', 'Knee & hip replacement', 'MBBS, MS (Ortho)', '18', 'DMC-12345', 'anita.rao@hospital.com', 'English;Hindi', '1200', 'Senior consultant in joint replacement.', 'yes'],
            ['Dr. Vikram Shah', 'Cardiac', 'Bypass surgery', 'MBBS, MCh', '22', 'DMC-67890', 'vikram.shah@hospital.com', 'English;Gujarati', '2500', '', 'no'],
        ],
    },
    packages: {
        cols: [
            { key: 'name', label: 'package', required: true, hint: 'Knee Replacement' },
            { key: 'priceUsd', label: 'priceUsd', required: true, kind: 'int', hint: '7500' },
            { key: 'included', label: 'included', kind: 'list', hint: 'Surgery;Anesthesia;5-night stay' },
            { key: 'notes', label: 'notes', hint: 'Single knee, includes physiotherapy' },
        ],
        sample: [
            ['Knee Replacement', '7500', 'Surgery;Anesthesia;5-night stay;Airport transfer', 'Single knee, includes 3 physio sessions'],
            ['Cardiac Bypass', '9200', 'Surgery;ICU 2 nights;Pre-op tests', ''],
        ],
    },
};
const BOM = '﻿';
const csvCell = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const csvRow = (cells) => cells.map(csvCell).join(',');
let BulkImportService = class BulkImportService {
    template(kind) {
        const spec = this.spec(kind);
        const header = spec.cols.map((c) => (c.required ? `${c.label}*` : c.label));
        return BOM + [csvRow(header), ...spec.sample.map(csvRow)].join('\r\n') + '\r\n';
    }
    spec(kind) {
        const spec = SPECS[kind];
        if (!spec)
            throw new common_1.BadRequestException(`Unknown import type "${kind}".`);
        return spec;
    }
    parse(kind, file) {
        const spec = this.spec(kind);
        if (!file?.buffer?.length)
            throw new common_1.BadRequestException('Attach a CSV file.');
        let records;
        try {
            records = (0, sync_1.parse)(file.buffer.toString('utf8'), {
                columns: (header) => header.map((h) => (h || '').replace(/^﻿/, '').replace(/\*$/, '').trim()),
                skip_empty_lines: true, trim: true, bom: true, relax_column_count: true,
            });
        }
        catch (e) {
            throw new common_1.BadRequestException(`Could not read that CSV: ${e.message}`);
        }
        if (!records.length)
            throw new common_1.BadRequestException('That file has no rows.');
        const headers = Object.keys(records[0]);
        const known = spec.cols.map((c) => c.label);
        if (!known.some((k) => headers.includes(k))) {
            throw new common_1.BadRequestException(`This doesn't look like the ${kind} template. Expected columns: ${known.join(', ')}.`);
        }
        const rows = [];
        const errors = [];
        records.forEach((rec, i) => {
            const line = i + 2;
            const out = {};
            const rowErrors = [];
            for (const col of spec.cols) {
                const raw = (rec[col.label] ?? '').trim();
                if (!raw) {
                    if (col.required)
                        rowErrors.push(`"${col.label}" is required`);
                    continue;
                }
                if (col.kind === 'int') {
                    const n = Number(raw);
                    if (!Number.isInteger(n) || n < 0) {
                        rowErrors.push(`"${col.label}" must be a whole number 0 or more (got "${raw}")`);
                        continue;
                    }
                    out[col.key] = n;
                }
                else if (col.kind === 'list') {
                    out[col.key] = raw.split(LIST_SEP).map((x) => x.trim()).filter(Boolean);
                }
                else if (col.kind === 'bool') {
                    out[col.key] = /^(y|yes|true|1)$/i.test(raw);
                }
                else {
                    out[col.key] = raw;
                }
            }
            if (out.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email))
                rowErrors.push(`"${out.email}" is not a valid email`);
            if (rowErrors.length)
                errors.push({ row: line, message: rowErrors.join('; ') });
            else
                rows.push(out);
        });
        if (!rows.length && !errors.length)
            throw new common_1.BadRequestException('That file has no rows.');
        return { rows, errors };
    }
};
exports.BulkImportService = BulkImportService;
exports.BulkImportService = BulkImportService = __decorate([
    (0, common_1.Injectable)()
], BulkImportService);
//# sourceMappingURL=bulk-import.service.js.map