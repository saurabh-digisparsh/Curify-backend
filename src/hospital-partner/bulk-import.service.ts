import { BadRequestException, Injectable } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import * as ExcelJS from 'exceljs';

/**
 * Bulk import for the hospital panel. A hospital can upload EITHER one table at a
 * time (its own record, its doctor roster, its price list) or the whole listing in
 * a single file — and in either Excel (.xlsx) or CSV, whichever their system exports.
 *
 * Both formats are read into the same array-of-rows shape (`sheets()`), so every
 * column spec, validation rule and error message below is shared: there is exactly
 * one parser, not one per format.
 *
 * The combined file carries three tables with different columns, so they are kept
 * apart as SECTIONS: in Excel, one worksheet per table (Profile / Doctors /
 * Packages); in CSV — which has no sheets — a `#PROFILE` / `#DOCTORS` / `#PACKAGES`
 * marker row introduces each block. The downloaded template is a real workbook, so
 * a hospital normally never has to think about markers.
 *
 * The column spec below is the SINGLE source of truth: it drives the downloadable
 * template, the header validation and the row parser, so a template can never
 * drift from what the parser accepts.
 *
 * Import is all-or-nothing per file: any bad row is reported with its spreadsheet
 * row number and NOTHING is written. Partial writes on a sheet the hospital will
 * just re-upload leave duplicates behind.
 */

export type ImportKind = 'profile' | 'doctors' | 'packages';
/** The combined file carries all three tables at once. */
export type ImportTarget = ImportKind | 'all';
export const IMPORT_KINDS: ImportKind[] = ['profile', 'doctors', 'packages'];

/** Section marker opening each table when the combined file is a flat CSV. */
const MARK = (kind: ImportKind) => `#${kind.toUpperCase()}`;
/** Worksheet name carrying each table in the combined workbook. */
const SHEET_NAME: Record<ImportKind, string> = { profile: 'Profile', doctors: 'Doctors', packages: 'Packages' };

// A hospital's roster or price list is a small file; anything larger is a mistake
// or an attempt to tie up the parser. Held in memory only — parsed and dropped,
// never stored, so no disk path and no PHI at rest.
export const CSV_MAX_BYTES = 5 * 1024 * 1024;

// Excel/Windows label spreadsheets inconsistently (text/csv, application/vnd.ms-excel,
// octet-stream…), so the extension is the reliable check. Content is validated by
// the parser regardless — this filter only keeps obvious non-spreadsheets out.
export const csvFileFilter = (_req: any, file: Express.Multer.File, cb: (e: Error | null, ok: boolean) => void) => {
  if (/\.(csv|xlsx)$/i.test(file.originalname)) cb(null, true);
  else cb(new BadRequestException('Upload an Excel (.xlsx) or CSV (.csv) file.'), false);
};

interface Col {
  key: string;
  label: string;          // CSV header
  required?: boolean;
  kind?: 'int' | 'list' | 'bool';
  hint: string;           // sample value in the template
}

// Semicolons separate list items — commas would collide with CSV quoting and are
// the single most common way a hospital's file breaks.
const LIST_SEP = ';';

const SPECS: Record<ImportKind, { cols: Col[]; sample: string[][] }> = {
  // The hospital's own record — every field the panel's Profile, Pricing, Treatments
  // and Services screens write, in one row, so a hospital can complete its whole
  // listing from a spreadsheet instead of four forms. Blank cells are LEFT ALONE
  // (the parser omits empty values), so this doubles as a partial-update file.
  // legalName and registrationNo are deliberately absent: they're bound to the
  // verified application and accreditation documents, so they change through review,
  // not a CSV upload.
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

// Excel is the tool hospitals actually use, and it mangles a bare UTF-8 CSV's
// accented names unless the file starts with a BOM.
const BOM = '\uFEFF'; // escaped: a literal BOM is an invisible character no reviewer can see
const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const csvRow = (cells: string[]) => cells.map(csvCell).join(',');

export interface ImportError { row: number; message: string }
export interface ImportPreview<T> { rows: T[]; errors: ImportError[] }
/** The combined file's three tables, parsed together. */
export interface ImportAll {
  profile: Record<string, any> | null;
  doctors: Record<string, any>[];
  packages: Record<string, any>[];
  errors: ImportError[];
}

/**
 * One row of trimmed cell text, tagged with the line number the hospital sees in
 * Excel. Carried through parsing so an error in the third block of a combined file
 * still points at the row they can actually go and fix — blank spacer lines
 * included in the count.
 */
interface Row { line: number; cells: string[] }
/** A worksheet reduced to those rows, with its own name. */
interface Sheet { name: string; rows: Row[] }

@Injectable()
export class BulkImportService {
  // ── Templates ──────────────────────────────────────────────────────────────
  /** One table's template, as CSV (header + filled example rows to copy). */
  template(kind: ImportKind): string {
    const spec = this.spec(kind);
    return BOM + [csvRow(this.header(kind)), ...spec.sample.map(csvRow)].join('\r\n') + '\r\n';
  }

  /**
   * The whole listing in one workbook — one worksheet per table, each with its own
   * header and example rows. Excel is what hospitals actually fill in, so the
   * combined template ships as a real .xlsx rather than a marker-separated CSV
   * (which the parser still accepts, for systems that can only export CSV).
   */
  async templateAllXlsx(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Curify';
    for (const kind of IMPORT_KINDS) {
      const ws = wb.addWorksheet(SHEET_NAME[kind]);
      ws.addRow(this.header(kind)).font = { bold: true };
      for (const row of SPECS[kind].sample) ws.addRow(row);
      ws.views = [{ state: 'frozen', ySplit: 1 }]; // header stays put while filling
      // Roomy but bounded — long list cells stay readable without a 200-char column.
      ws.columns.forEach((c, i) => { c.width = Math.min(38, Math.max(14, this.header(kind)[i].length + 6)); });
    }
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  /** The same combined file as flat CSV, for hospitals whose system exports CSV only. */
  templateAllCsv(): string {
    const blocks = IMPORT_KINDS.map((kind) =>
      [csvRow([MARK(kind)]), csvRow(this.header(kind)), ...SPECS[kind].sample.map(csvRow)].join('\r\n'),
    );
    return BOM + blocks.join('\r\n\r\n') + '\r\n';
  }

  private header(kind: ImportKind) {
    return SPECS[kind].cols.map((c) => (c.required ? `${c.label}*` : c.label));
  }

  private spec(kind: ImportKind) {
    const spec = SPECS[kind];
    if (!spec) throw new BadRequestException(`Unknown import type "${kind}".`);
    return spec;
  }

  // ── Reading (one path for .xlsx and .csv) ──────────────────────────────────
  /**
   * Read an upload into worksheets of plain rows. An .xlsx keeps its sheets; a CSV
   * is a single unnamed sheet. Everything downstream works on this shape, so no
   * validation rule has to know which format the hospital used.
   */
  private async sheets(file?: Express.Multer.File): Promise<Sheet[]> {
    if (!file?.buffer?.length) throw new BadRequestException('Attach an Excel (.xlsx) or CSV file.');
    const cell = (v: any): string => {
      if (v == null) return '';
      if (v instanceof Date) return v.toISOString().slice(0, 10);
      // ExcelJS returns objects for formulas, hyperlinks and rich text.
      if (typeof v === 'object') return String(v.result ?? v.text ?? v.hyperlink ?? '').trim();
      return String(v).trim();
    };

    if (/\.xlsx$/i.test(file.originalname)) {
      const wb = new ExcelJS.Workbook();
      try {
        await wb.xlsx.load(file.buffer as any);
      } catch (e: any) {
        throw new BadRequestException(`Could not read that Excel file: ${e.message}`);
      }
      return wb.worksheets.map((ws) => {
        const rows: Row[] = [];
        ws.eachRow({ includeEmpty: false }, (row) => {
          const values = Array.isArray(row.values) ? row.values.slice(1) : []; // ExcelJS pads index 0
          const cells = values.map(cell);
          if (cells.some((c) => c !== '')) rows.push({ line: row.number, cells }); // ExcelJS row numbers ARE the Excel ones
        });
        return { name: ws.name || '', rows };
      });
    }

    let parsed: string[][];
    try {
      // Blank lines are KEPT while parsing so line numbers match the real file
      // (a combined CSV separates its blocks with them), then dropped here.
      parsed = parse(file.buffer.toString('utf8'), { skip_empty_lines: false, trim: true, bom: true, relax_column_count: true });
    } catch (e: any) {
      throw new BadRequestException(`Could not read that CSV: ${e.message}`);
    }
    const rows = parsed
      .map((cells, i) => ({ line: i + 1, cells: cells.map(cell) }))
      .filter((r) => r.cells.some((c) => c !== ''));
    return [{ name: '', rows }];
  }

  // ── Validation (shared by every entry point) ───────────────────────────────
  /**
   * Validate one table against its spec: first row is the header, the rest are
   * data. Each row reports its own file line, so an error in the third block of a
   * combined file still points at the row the hospital can go and fix.
   */
  private validate<T>(kind: ImportKind, rows: Row[]): ImportPreview<T> {
    const spec = this.spec(kind);
    const [headerRow, ...dataRows] = rows;
    const headers = (headerRow?.cells || []).map((h) => (h || '').replace(/^\uFEFF/, '').replace(/\*$/, '').trim());

    // A wrong template is worth catching up front — otherwise every row fails with
    // a confusing "name is required" and the hospital can't tell why.
    const known = spec.cols.map((c) => c.label);
    if (!known.some((k) => headers.includes(k))) {
      throw new BadRequestException(`This doesn't look like the ${kind} template. Expected columns: ${known.join(', ')}.`);
    }

    const out: T[] = [];
    const errors: ImportError[] = [];
    dataRows.forEach(({ line, cells }) => {
      const rec: any = {};
      const rowErrors: string[] = [];
      for (const col of spec.cols) {
        const at = headers.indexOf(col.label);
        const raw = (at >= 0 ? cells[at] ?? '' : '').trim();
        if (!raw) {
          if (col.required) rowErrors.push(`"${col.label}" is required`);
          continue;
        }
        if (col.kind === 'int') {
          const n = Number(raw);
          if (!Number.isInteger(n) || n < 0) { rowErrors.push(`"${col.label}" must be a whole number 0 or more (got "${raw}")`); continue; }
          rec[col.key] = n;
        } else if (col.kind === 'list') {
          rec[col.key] = raw.split(LIST_SEP).map((x) => x.trim()).filter(Boolean);
        } else if (col.kind === 'bool') {
          rec[col.key] = /^(y|yes|true|1)$/i.test(raw);
        } else {
          rec[col.key] = raw;
        }
      }
      // Reuse the same email shape the DTO enforces, so a spreadsheet can't smuggle
      // in what the form would have rejected.
      if (rec.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rec.email)) rowErrors.push(`"${rec.email}" is not a valid email`);
      if (rowErrors.length) errors.push({ row: line, message: rowErrors.join('; ') });
      else if (Object.keys(rec).length) out.push(rec as T); // an all-blank row is padding, not data
    });
    return { rows: out, errors };
  }

  // ── Entry points ───────────────────────────────────────────────────────────
  /**
   * Parse + validate a single-table upload (.xlsx or .csv). Returns clean rows and
   * a per-row error list; callers must not write anything when `errors` is non-empty.
   */
  async parse<T = any>(kind: ImportKind, file?: Express.Multer.File): Promise<ImportPreview<T>> {
    const sheets = await this.sheets(file);
    // A single-table upload may still be the combined workbook — take the matching
    // sheet when there is one, so uploading the big file here does the right thing.
    const sheet = sheets.find((s) => s.name.toLowerCase() === SHEET_NAME[kind].toLowerCase()) ?? sheets[0];
    const rows = this.stripMarkers(sheet?.rows ?? []);
    if (rows.length < 2) throw new BadRequestException('That file has no rows.');
    const res = this.validate<T>(kind, rows);
    if (!res.rows.length && !res.errors.length) throw new BadRequestException('That file has no rows.');
    return res;
  }

  /**
   * Parse + validate the COMBINED file — all three tables at once, from either a
   * workbook (one sheet per table) or a flat CSV (`#PROFILE` / `#DOCTORS` /
   * `#PACKAGES` marker rows). A table the hospital left empty comes back empty and
   * the caller leaves that part of the listing untouched.
   */
  async parseAll(file?: Express.Multer.File): Promise<ImportAll> {
    const sheets = await this.sheets(file);
    const out: ImportAll = { profile: null, doctors: [], packages: [], errors: [] };
    let matched = 0;

    for (const kind of IMPORT_KINDS) {
      // Prefer a worksheet named for the table; fall back to a marked block.
      const named = sheets.find((s) => s.name.toLowerCase() === SHEET_NAME[kind].toLowerCase());
      const block = named ? this.stripMarkers(named.rows) : this.markedBlock(sheets[0], kind);
      if (block.length < 2) continue;
      matched++;
      const { rows, errors } = this.validate<Record<string, any>>(kind, block);
      out.errors.push(...errors);
      if (kind === 'profile') out.profile = rows[0] ?? null;
      else out[kind] = rows;
      // One hospital, one profile row — extra rows are a pasted roster by mistake.
      if (kind === 'profile' && rows.length > 1) {
        out.errors.push({ row: block[2].line, message: `The Profile table holds ONE row — your hospital. Found ${rows.length}.` });
      }
    }

    if (!matched) {
      throw new BadRequestException(
        `This doesn't look like the combined template. Expected worksheets named ${IMPORT_KINDS.map((k) => SHEET_NAME[k]).join(', ')} — or ${IMPORT_KINDS.map(MARK).join(' / ')} marker rows in a CSV.`,
      );
    }
    return out;
  }

  /** Rows of one `#MARKER` block within a flat sheet, with its real row numbers. */
  private markedBlock(sheet: Sheet | undefined, kind: ImportKind): Row[] {
    if (!sheet) return [];
    const isMarker = (r: Row) => /^#/.test((r.cells[0] || '').trim());
    const start = sheet.rows.findIndex((r) => (r.cells[0] || '').trim().toUpperCase() === MARK(kind));
    if (start < 0) return [];
    const rest = sheet.rows.slice(start + 1); // the marker itself is not part of the table
    const end = rest.findIndex(isMarker);     // block runs until the next marker
    return end < 0 ? rest : rest.slice(0, end);
  }

  /** Drop any stray marker rows so a marked block still parses as a plain table. */
  private stripMarkers(rows: Row[]) {
    return rows.filter((r) => !/^#/.test((r.cells[0] || '').trim()));
  }
}
