"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BulkImportService = exports.csvFileFilter = exports.CSV_MAX_BYTES = exports.IMPORT_KINDS = void 0;
const common_1 = require("@nestjs/common");
const sync_1 = require("csv-parse/sync");
const ExcelJS = require("exceljs");
exports.IMPORT_KINDS = ['profile', 'doctors', 'packages'];
const MARK = (kind) => `#${kind.toUpperCase()}`;
const SHEET_NAME = { profile: 'Profile', doctors: 'Doctors', packages: 'Packages' };
exports.CSV_MAX_BYTES = 5 * 1024 * 1024;
const csvFileFilter = (_req, file, cb) => {
    if (/\.(csv|xlsx)$/i.test(file.originalname))
        cb(null, true);
    else
        cb(new common_1.BadRequestException('Upload an Excel (.xlsx) or CSV (.csv) file.'), false);
};
exports.csvFileFilter = csvFileFilter;
const LIST_SEP = ';';
const SPECS = {
    profile: {
        cols: [
            { key: 'city', label: 'city', hint: 'New Delhi' },
            { key: 'address', label: 'address', hint: '12 Ring Road, Saket, New Delhi 110017' },
            { key: 'website', label: 'website', hint: 'https://www.apollohospital.com' },
            { key: 'ownership', label: 'ownership', hint: 'Private' },
            { key: 'totalBeds', label: 'totalBeds', kind: 'int', hint: '450' },
            { key: 'icuBeds', label: 'icuBeds', kind: 'int', hint: '60' },
            { key: 'airportDistanceKm', label: 'airportDistanceKm', kind: 'int', hint: '18' },
            { key: 'specialties', label: 'specialties', kind: 'list', hint: 'Orthopedics;Cardiology;Oncology' },
            { key: 'procedures', label: 'procedures', kind: 'list', hint: 'Knee Replacement;Cardiac Bypass' },
            { key: 'languages', label: 'languages', kind: 'list', hint: 'English;Hindi;Arabic;French' },
            { key: 'insurers', label: 'insurers', kind: 'list', hint: 'Self-pay;Cigna Global;Bupa' },
            { key: 'intlFacilities', label: 'intlFacilities', kind: 'list', hint: 'Airport pickup;Visa letter;Interpreter;Halal meals' },
            { key: 'quotedPriceUsd', label: 'quotedPriceUsd', kind: 'int', hint: '7500' },
            { key: 'localBenchmarkUsd', label: 'localBenchmarkUsd', kind: 'int', hint: '32000' },
            { key: 'patientsPerYear', label: 'patientsPerYear', kind: 'int', hint: '1800' },
            { key: 'imageUrl', label: 'imageUrl', hint: 'https://www.apollohospital.com/photo.jpg' },
            { key: 'included', label: 'included', kind: 'list', hint: 'Surgery;Anesthesia;5-night stay;Pre-op tests' },
            { key: 'notIncluded', label: 'notIncluded', kind: 'list', hint: 'International flights;Visa fee' },
            { key: 'pros', label: 'pros', kind: 'list', hint: 'JCI accredited;English-speaking staff' },
            { key: 'cons', label: 'cons', kind: 'list', hint: 'Busy OPD;Long airport transfer in traffic' },
        ],
        sample: [
            [
                'New Delhi', '12 Ring Road, Saket, New Delhi 110017', 'https://www.example-hospital.com', 'Private',
                '450', '60', '18',
                'Orthopedics;Cardiology;Oncology', 'Knee Replacement;Cardiac Bypass;Hip Replacement',
                'English;Hindi;Arabic', 'Self-pay;Cigna Global;Bupa', 'Airport pickup;Visa letter;Interpreter',
                '7500', '32000', '1800', 'https://www.example-hospital.com/building.jpg',
                'Surgery;Anesthesia;5-night stay;Pre-op tests', 'International flights;Visa fee',
                'JCI accredited;English-speaking coordinators', 'Busy OPD on weekdays',
            ],
        ],
    },
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
const BOM = '\uFEFF';
const csvCell = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const csvRow = (cells) => cells.map(csvCell).join(',');
let BulkImportService = class BulkImportService {
    template(kind) {
        const spec = this.spec(kind);
        return BOM + [csvRow(this.header(kind)), ...spec.sample.map(csvRow)].join('\r\n') + '\r\n';
    }
    async templateAllXlsx() {
        const wb = new ExcelJS.Workbook();
        wb.creator = 'Curify';
        for (const kind of exports.IMPORT_KINDS) {
            const ws = wb.addWorksheet(SHEET_NAME[kind]);
            ws.addRow(this.header(kind)).font = { bold: true };
            for (const row of SPECS[kind].sample)
                ws.addRow(row);
            ws.views = [{ state: 'frozen', ySplit: 1 }];
            ws.columns.forEach((c, i) => { c.width = Math.min(38, Math.max(14, this.header(kind)[i].length + 6)); });
        }
        return Buffer.from(await wb.xlsx.writeBuffer());
    }
    templateAllCsv() {
        const blocks = exports.IMPORT_KINDS.map((kind) => [csvRow([MARK(kind)]), csvRow(this.header(kind)), ...SPECS[kind].sample.map(csvRow)].join('\r\n'));
        return BOM + blocks.join('\r\n\r\n') + '\r\n';
    }
    header(kind) {
        return SPECS[kind].cols.map((c) => (c.required ? `${c.label}*` : c.label));
    }
    spec(kind) {
        const spec = SPECS[kind];
        if (!spec)
            throw new common_1.BadRequestException(`Unknown import type "${kind}".`);
        return spec;
    }
    async sheets(file) {
        if (!file?.buffer?.length)
            throw new common_1.BadRequestException('Attach an Excel (.xlsx) or CSV file.');
        const cell = (v) => {
            if (v == null)
                return '';
            if (v instanceof Date)
                return v.toISOString().slice(0, 10);
            if (typeof v === 'object')
                return String(v.result ?? v.text ?? v.hyperlink ?? '').trim();
            return String(v).trim();
        };
        if (/\.xlsx$/i.test(file.originalname)) {
            const wb = new ExcelJS.Workbook();
            try {
                await wb.xlsx.load(file.buffer);
            }
            catch (e) {
                throw new common_1.BadRequestException(`Could not read that Excel file: ${e.message}`);
            }
            return wb.worksheets.map((ws) => {
                const rows = [];
                ws.eachRow({ includeEmpty: false }, (row) => {
                    const values = Array.isArray(row.values) ? row.values.slice(1) : [];
                    const cells = values.map(cell);
                    if (cells.some((c) => c !== ''))
                        rows.push({ line: row.number, cells });
                });
                return { name: ws.name || '', rows };
            });
        }
        let parsed;
        try {
            parsed = (0, sync_1.parse)(file.buffer.toString('utf8'), { skip_empty_lines: false, trim: true, bom: true, relax_column_count: true });
        }
        catch (e) {
            throw new common_1.BadRequestException(`Could not read that CSV: ${e.message}`);
        }
        const rows = parsed
            .map((cells, i) => ({ line: i + 1, cells: cells.map(cell) }))
            .filter((r) => r.cells.some((c) => c !== ''));
        return [{ name: '', rows }];
    }
    validate(kind, rows) {
        const spec = this.spec(kind);
        const [headerRow, ...dataRows] = rows;
        const headers = (headerRow?.cells || []).map((h) => (h || '').replace(/^\uFEFF/, '').replace(/\*$/, '').trim());
        const known = spec.cols.map((c) => c.label);
        if (!known.some((k) => headers.includes(k))) {
            throw new common_1.BadRequestException(`This doesn't look like the ${kind} template. Expected columns: ${known.join(', ')}.`);
        }
        const out = [];
        const errors = [];
        dataRows.forEach(({ line, cells }) => {
            const rec = {};
            const rowErrors = [];
            for (const col of spec.cols) {
                const at = headers.indexOf(col.label);
                const raw = (at >= 0 ? cells[at] ?? '' : '').trim();
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
                    rec[col.key] = n;
                }
                else if (col.kind === 'list') {
                    rec[col.key] = raw.split(LIST_SEP).map((x) => x.trim()).filter(Boolean);
                }
                else if (col.kind === 'bool') {
                    rec[col.key] = /^(y|yes|true|1)$/i.test(raw);
                }
                else {
                    rec[col.key] = raw;
                }
            }
            if (rec.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rec.email))
                rowErrors.push(`"${rec.email}" is not a valid email`);
            if (rowErrors.length)
                errors.push({ row: line, message: rowErrors.join('; ') });
            else if (Object.keys(rec).length)
                out.push(rec);
        });
        return { rows: out, errors };
    }
    async parse(kind, file) {
        const sheets = await this.sheets(file);
        const sheet = sheets.find((s) => s.name.toLowerCase() === SHEET_NAME[kind].toLowerCase()) ?? sheets[0];
        const rows = this.stripMarkers(sheet?.rows ?? []);
        if (rows.length < 2)
            throw new common_1.BadRequestException('That file has no rows.');
        const res = this.validate(kind, rows);
        if (!res.rows.length && !res.errors.length)
            throw new common_1.BadRequestException('That file has no rows.');
        return res;
    }
    async parseAll(file) {
        const sheets = await this.sheets(file);
        const out = { profile: null, doctors: [], packages: [], errors: [] };
        let matched = 0;
        for (const kind of exports.IMPORT_KINDS) {
            const named = sheets.find((s) => s.name.toLowerCase() === SHEET_NAME[kind].toLowerCase());
            const block = named ? this.stripMarkers(named.rows) : this.markedBlock(sheets[0], kind);
            if (block.length < 2)
                continue;
            matched++;
            const { rows, errors } = this.validate(kind, block);
            out.errors.push(...errors);
            if (kind === 'profile')
                out.profile = rows[0] ?? null;
            else
                out[kind] = rows;
            if (kind === 'profile' && rows.length > 1) {
                out.errors.push({ row: block[2].line, message: `The Profile table holds ONE row — your hospital. Found ${rows.length}.` });
            }
        }
        if (!matched) {
            throw new common_1.BadRequestException(`This doesn't look like the combined template. Expected worksheets named ${exports.IMPORT_KINDS.map((k) => SHEET_NAME[k]).join(', ')} — or ${exports.IMPORT_KINDS.map(MARK).join(' / ')} marker rows in a CSV.`);
        }
        return out;
    }
    markedBlock(sheet, kind) {
        if (!sheet)
            return [];
        const isMarker = (r) => /^#/.test((r.cells[0] || '').trim());
        const start = sheet.rows.findIndex((r) => (r.cells[0] || '').trim().toUpperCase() === MARK(kind));
        if (start < 0)
            return [];
        const rest = sheet.rows.slice(start + 1);
        const end = rest.findIndex(isMarker);
        return end < 0 ? rest : rest.slice(0, end);
    }
    stripMarkers(rows) {
        return rows.filter((r) => !/^#/.test((r.cells[0] || '').trim()));
    }
};
exports.BulkImportService = BulkImportService;
exports.BulkImportService = BulkImportService = __decorate([
    (0, common_1.Injectable)()
], BulkImportService);
//# sourceMappingURL=bulk-import.service.js.map