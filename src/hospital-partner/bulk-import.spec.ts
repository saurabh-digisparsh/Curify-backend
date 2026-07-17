import { BadRequestException } from '@nestjs/common';
import { BulkImportService } from './bulk-import.service';

const file = (csv: string): any => ({ buffer: Buffer.from(csv, 'utf8'), originalname: 'x.csv' });

describe('BulkImportService', () => {
  const svc = new BulkImportService();

  it('round-trips its own template: what we hand out is what we accept', () => {
    for (const kind of ['doctors', 'packages'] as const) {
      const { rows, errors } = svc.parse(kind, file(svc.template(kind)));
      expect(errors).toEqual([]);
      expect(rows.length).toBe(2); // the two sample rows
    }
  });

  it('parses doctors, splitting lists on ; and coercing ints/bools', () => {
    const { rows, errors } = svc.parse<any>('doctors', file(
      'name,specialty,yearsExperience,languages,teleconsultEnabled\nDr. A,Cardiac,12,English;Arabic,yes\n',
    ));
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ name: 'Dr. A', specialty: 'Cardiac', yearsExperience: 12, languages: ['English', 'Arabic'], teleconsultEnabled: true });
  });

  it('reports the Excel row number for a bad row and keeps good rows out of the write', () => {
    const { rows, errors } = svc.parse<any>('packages', file(
      'package,priceUsd\nKnee,7500\n,4000\nHip,abc\n',
    ));
    expect(rows).toHaveLength(1);                       // only "Knee" is clean
    expect(errors.map((e) => e.row)).toEqual([3, 4]);   // header is row 1, as in Excel
    expect(errors[0].message).toMatch(/required/);
    expect(errors[1].message).toMatch(/whole number/);
  });

  it('rejects a negative price rather than storing it', () => {
    const { errors } = svc.parse('packages', file('package,priceUsd\nKnee,-500\n'));
    expect(errors).toHaveLength(1);
  });

  it('rejects an email a DTO would have rejected', () => {
    const { rows, errors } = svc.parse('doctors', file('name,email\nDr. A,not-an-email\n'));
    expect(rows).toHaveLength(0);
    expect(errors[0].message).toMatch(/not a valid email/);
  });

  it('tolerates a BOM and the required-marker (*) in template headers', () => {
    const { rows, errors } = svc.parse<any>('packages', file('﻿package*,priceUsd*\nKnee,7500\n'));
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ name: 'Knee', priceUsd: 7500 });
  });

  it('names the problem when the wrong template is uploaded', () => {
    expect(() => svc.parse('packages', file(svc.template('doctors')))).toThrow(BadRequestException);
    expect(() => svc.parse('packages', file(svc.template('doctors')))).toThrow(/packages template/);
  });

  it('refuses an empty or missing file', () => {
    expect(() => svc.parse('doctors', file('name,specialty\n'))).toThrow(/no rows/);
    expect(() => svc.parse('doctors', undefined)).toThrow(/Attach a CSV/);
  });
});
