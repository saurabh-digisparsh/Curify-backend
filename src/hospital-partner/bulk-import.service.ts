import { BadRequestException, Injectable } from '@nestjs/common';
import { parse } from 'csv-parse/sync';

/**
 * Bulk import for the hospital panel — doctors and treatment packages from a CSV
 * the hospital fills in (Excel's "Save As → CSV" produces exactly this).
 *
 * The column spec below is the SINGLE source of truth: it drives the downloadable
 * template, the header validation and the row parser, so a template can never
 * drift from what the parser accepts.
 *
 * Import is all-or-nothing per file: a file with any bad row is rejected with a
 * per-row error list and NOTHING is written. Partial writes on a spreadsheet the
 * hospital will just re-upload leave duplicates behind, and half-imported doctors
 * are worse than none.
 */

export type ImportKind = 'doctors' | 'packages';

// A hospital's doctor roster or price list is a small file; anything larger is a
// mistake or an attempt to tie up the parser. Held in memory only — these are
// parsed and dropped, never stored, so no disk path and no PHI at rest.
export const CSV_MAX_BYTES = 2 * 1024 * 1024;

// Excel/Windows label CSVs inconsistently (text/csv, application/vnd.ms-excel,
// or octet-stream), so the extension is the reliable check. Content is validated
// by the parser regardless — this filter only keeps obvious non-CSVs out.
export const csvFileFilter = (_req: any, file: Express.Multer.File, cb: (e: Error | null, ok: boolean) => void) => {
  if (/\.csv$/i.test(file.originalname)) cb(null, true);
  else cb(new BadRequestException('Upload a .csv file. In Excel: File → Save As → CSV.'), false);
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
const BOM = '﻿';
const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const csvRow = (cells: string[]) => cells.map(csvCell).join(',');

export interface ImportError { row: number; message: string }
export interface ImportPreview<T> { rows: T[]; errors: ImportError[] }

@Injectable()
export class BulkImportService {
  /** The downloadable template: header + two filled example rows to copy. */
  template(kind: ImportKind): string {
    const spec = this.spec(kind);
    const header = spec.cols.map((c) => (c.required ? `${c.label}*` : c.label));
    return BOM + [csvRow(header), ...spec.sample.map(csvRow)].join('\r\n') + '\r\n';
  }

  private spec(kind: ImportKind) {
    const spec = SPECS[kind];
    if (!spec) throw new BadRequestException(`Unknown import type "${kind}".`);
    return spec;
  }

  /**
   * Parse + validate an uploaded CSV. Returns the clean rows and a per-row error
   * list; callers must not write anything when `errors` is non-empty.
   */
  parse<T = any>(kind: ImportKind, file?: Express.Multer.File): ImportPreview<T> {
    const spec = this.spec(kind);
    if (!file?.buffer?.length) throw new BadRequestException('Attach a CSV file.');

    let records: Record<string, string>[];
    try {
      records = parse(file.buffer.toString('utf8'), {
        columns: (header: string[]) => header.map((h) => (h || '').replace(/^﻿/, '').replace(/\*$/, '').trim()),
        skip_empty_lines: true, trim: true, bom: true, relax_column_count: true,
      });
    } catch (e: any) {
      throw new BadRequestException(`Could not read that CSV: ${e.message}`);
    }
    if (!records.length) throw new BadRequestException('That file has no rows.');

    // A wrong template is worth catching up front — otherwise every row fails
    // with a confusing "name is required" and the hospital can't tell why.
    const headers = Object.keys(records[0]);
    const known = spec.cols.map((c) => c.label);
    if (!known.some((k) => headers.includes(k))) {
      throw new BadRequestException(`This doesn't look like the ${kind} template. Expected columns: ${known.join(', ')}.`);
    }

    const rows: T[] = [];
    const errors: ImportError[] = [];
    records.forEach((rec, i) => {
      const line = i + 2; // +1 header, +1 to 1-index — matches the row number in Excel
      const out: any = {};
      const rowErrors: string[] = [];
      for (const col of spec.cols) {
        const raw = (rec[col.label] ?? '').trim();
        if (!raw) {
          if (col.required) rowErrors.push(`"${col.label}" is required`);
          continue;
        }
        if (col.kind === 'int') {
          const n = Number(raw);
          if (!Number.isInteger(n) || n < 0) { rowErrors.push(`"${col.label}" must be a whole number 0 or more (got "${raw}")`); continue; }
          out[col.key] = n;
        } else if (col.kind === 'list') {
          out[col.key] = raw.split(LIST_SEP).map((x) => x.trim()).filter(Boolean);
        } else if (col.kind === 'bool') {
          out[col.key] = /^(y|yes|true|1)$/i.test(raw);
        } else {
          out[col.key] = raw;
        }
      }
      // Reuse the same email shape the DTO enforces, so a CSV can't smuggle in
      // what the form would have rejected.
      if (out.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email)) rowErrors.push(`"${out.email}" is not a valid email`);
      if (rowErrors.length) errors.push({ row: line, message: rowErrors.join('; ') });
      else rows.push(out as T);
    });

    if (!rows.length && !errors.length) throw new BadRequestException('That file has no rows.');
    return { rows, errors };
  }
}
