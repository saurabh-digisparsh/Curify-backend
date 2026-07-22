import { BadRequestException } from '@nestjs/common';
import { BulkImportService, IMPORT_KINDS } from './bulk-import.service';

const file = (csv: string): any => ({ buffer: Buffer.from(csv, 'utf8'), originalname: 'x.csv' });
const xlsx = (buf: Buffer): any => ({ buffer: buf, originalname: 'x.xlsx' });

describe('BulkImportService', () => {
  const svc = new BulkImportService();

  it('round-trips its own template: what we hand out is what we accept', async () => {
    // profile is the hospital's own single row; the others ship two example rows.
    for (const [kind, sampleRows] of [['profile', 1], ['doctors', 2], ['packages', 2]] as const) {
      const { rows, errors } = await svc.parse(kind, file(svc.template(kind)));
      expect(errors).toEqual([]);
      expect(rows.length).toBe(sampleRows);
    }
  });

  it('parses every profile column, so a filled template completes the whole listing', async () => {
    const { rows, errors } = await svc.parse<any>('profile', file(svc.template('profile')));
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({
      city: 'New Delhi',
      totalBeds: 450,
      icuBeds: 60,
      airportDistanceKm: 18,
      specialties: ['Orthopedics', 'Cardiology', 'Oncology'],
      languages: ['English', 'Hindi', 'Arabic'],
      insurers: ['Self-pay', 'Cigna Global', 'Bupa'],
      quotedPriceUsd: 7500,
      localBenchmarkUsd: 32000,
      patientsPerYear: 1800,
    });
  });

  it('omits blank profile cells so a partial file never wipes saved fields', async () => {
    const { rows, errors } = await svc.parse<any>('profile', file('city,totalBeds,languages\nMumbai,,\n'));
    expect(errors).toEqual([]);
    expect(rows[0]).toEqual({ city: 'Mumbai' }); // absent keys → skip-undefined on write
  });

  it('parses doctors, splitting lists on ; and coercing ints/bools', async () => {
    const { rows, errors } = await svc.parse<any>('doctors', file(
      'name,specialty,yearsExperience,languages,teleconsultEnabled\nDr. A,Cardiac,12,English;Arabic,yes\n',
    ));
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ name: 'Dr. A', specialty: 'Cardiac', yearsExperience: 12, languages: ['English', 'Arabic'], teleconsultEnabled: true });
  });

  it('reports the Excel row number for a bad row and keeps good rows out of the write', async () => {
    const { rows, errors } = await svc.parse<any>('packages', file(
      'package,priceUsd\nKnee,7500\n,4000\nHip,abc\n',
    ));
    expect(rows).toHaveLength(1);                       // only "Knee" is clean
    expect(errors.map((e) => e.row)).toEqual([3, 4]);   // header is row 1, as in Excel
    expect(errors[0].message).toMatch(/required/);
    expect(errors[1].message).toMatch(/whole number/);
  });

  it('rejects a negative price rather than storing it', async () => {
    const { errors } = await svc.parse('packages', file('package,priceUsd\nKnee,-500\n'));
    expect(errors).toHaveLength(1);
  });

  it('rejects an email a DTO would have rejected', async () => {
    const { rows, errors } = await svc.parse('doctors', file('name,email\nDr. A,not-an-email\n'));
    expect(rows).toHaveLength(0);
    expect(errors[0].message).toMatch(/not a valid email/);
  });

  it('tolerates a BOM and the required-marker (*) in template headers', async () => {
    const { rows, errors } = await svc.parse<any>('packages', file('﻿package*,priceUsd*\nKnee,7500\n'));
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ name: 'Knee', priceUsd: 7500 });
  });

  it('names the problem when the wrong template is uploaded', async () => {
    await expect(svc.parse('packages', file(svc.template('doctors')))).rejects.toThrow(BadRequestException);
    await expect(svc.parse('packages', file(svc.template('doctors')))).rejects.toThrow(/packages template/);
  });

  it('refuses an empty or missing file', async () => {
    await expect(svc.parse('doctors', file('name,specialty\n'))).rejects.toThrow(/no rows/);
    await expect(svc.parse('doctors', undefined)).rejects.toThrow(/Attach an Excel/);
  });

  // ── The ONE combined file ──────────────────────────────────────────────────
  it('round-trips the combined Excel workbook: profile + doctors + packages in one upload', async () => {
    const all = await svc.parseAll(xlsx(await svc.templateAllXlsx()));
    expect(all.errors).toEqual([]);
    expect(all.profile).toMatchObject({ city: 'New Delhi', quotedPriceUsd: 7500 });
    expect(all.doctors).toHaveLength(2);
    expect(all.packages).toHaveLength(2);
    expect(all.doctors[0]).toMatchObject({ name: 'Dr. Anita Rao', yearsExperience: 18, teleconsultEnabled: true });
    expect(all.packages[0]).toMatchObject({ name: 'Knee Replacement', priceUsd: 7500 });
  });

  it('round-trips the combined CSV, splitting it on the #SECTION markers', async () => {
    const all = await svc.parseAll(file(svc.templateAllCsv()));
    expect(all.errors).toEqual([]);
    expect(all.profile).toMatchObject({ city: 'New Delhi' });
    expect(all.doctors).toHaveLength(2);
    expect(all.packages).toHaveLength(2);
  });

  it('skips a table the hospital left empty instead of wiping it', async () => {
    const all = await svc.parseAll(file('#PACKAGES\npackage,priceUsd\nKnee,7500\n'));
    expect(all.errors).toEqual([]);
    expect(all.profile).toBeNull();
    expect(all.doctors).toEqual([]);
    expect(all.packages).toHaveLength(1);
  });

  it('points a combined-file error at the row the hospital sees, not the block offset', async () => {
    const all = await svc.parseAll(file(
      '#PROFILE\ncity\nMumbai\n\n#PACKAGES\npackage,priceUsd\nKnee,7500\nHip,abc\n',
    ));
    expect(all.errors).toHaveLength(1);
    expect(all.errors[0].row).toBe(8);  // the "Hip,abc" line in the actual file
    expect(all.errors[0].message).toMatch(/whole number/);
  });

  it('rejects more than one profile row — a hospital is one row', async () => {
    const all = await svc.parseAll(file('#PROFILE\ncity\nMumbai\nDelhi\n'));
    expect(all.errors.some((e) => /ONE row/.test(e.message))).toBe(true);
  });

  it('names the problem when the uploaded file is not the combined template', async () => {
    await expect(svc.parseAll(file('foo,bar\n1,2\n'))).rejects.toThrow(/combined template/);
  });

  it('accepts a single-table upload from the combined workbook by matching its sheet', async () => {
    const wb = xlsx(await svc.templateAllXlsx());
    for (const kind of IMPORT_KINDS) {
      const { rows, errors } = await svc.parse(kind, wb);
      expect(errors).toEqual([]);
      expect(rows.length).toBeGreaterThan(0);
    }
  });
});
