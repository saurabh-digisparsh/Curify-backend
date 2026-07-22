import { UploadService } from './upload.service';

/**
 * Regression: "Sandeep Bora Angio Report.pdf" — a 4-page scan whose only extractable
 * text is page furniture ("-- 1 of 4 --"). That is non-empty, so it used to satisfy
 * the readable-content check, and the model was asked to produce a fully scored
 * cardiac analysis with nothing to read. It duly invented one, differently each run
 * (composite 91, then 0, then 51).
 *
 * The rule under test: a PDF's text layer counts only if it contains real report text.
 */
describe('UploadService — PDF text layer detection', () => {
  // extractPdfText is private and pdf-parse is the only thing it calls; drive it
  // through the real method with a stubbed parse result.
  const svc = new UploadService({} as any, {} as any);
  const extract = (text: string) => {
    jest.spyOn(require('pdf-parse'), 'PDFParse').mockImplementation(function (this: any) {
      this.getText = async () => ({ text });
      this.destroy = async () => undefined;
    } as any);
    return (svc as any).extractPdfText({ buffer: Buffer.from('x'), mimetype: 'application/pdf', originalname: 't.pdf' });
  };
  afterEach(() => jest.restoreAllMocks());

  it('rejects a scan whose only text is page markers', async () => {
    // Verbatim from the real file.
    await expect(extract('-- 1 of 4 --\n-- 2 of 4 --\n-- 3 of 4 --\n-- 4 of 4 --')).resolves.toBeUndefined();
  });

  it('rejects an empty or whitespace-only text layer', async () => {
    await expect(extract('')).resolves.toBeUndefined();
    await expect(extract('   \n\n  \t ')).resolves.toBeUndefined();
  });

  it('accepts a genuine report and returns its text', async () => {
    const real =
      'HRCT CHEST — MAGNUM C.T. SCAN CENTRE. Patient: MRS PRANALI KADAM, 46 Years Female. ' +
      'Impression: Known case of connective tissue disorder with interstitial lung disease. ' +
      'Findings consistent with fibrosing ILD related to CTD, fibrotic NSIP pattern. ' +
      'Septal thickening in bilateral lungs, florid in bilateral lower lobes. Traction bronchiolectasis seen.';
    await expect(extract(real)).resolves.toContain('fibrotic NSIP');
  });

  it('accepts a non-Latin report (patients upload Arabic/Devanagari scans)', async () => {
    // A letter count restricted to A-Z would reject these as scans and refuse a
    // perfectly readable report.
    await expect(extract('ت'.repeat(250))).resolves.toBeDefined();
    await expect(extract('क'.repeat(250))).resolves.toBeDefined();
  });

  it('rejects a scan that also carries a short header watermark', async () => {
    // Scanners stamp a clinic name/URL onto otherwise image-only pages — still not
    // a report, and still not something to score a patient on.
    await expect(extract('-- 1 of 4 --\nCity Diagnostics\nwww.citydiag.example\n-- 2 of 4 --')).resolves.toBeUndefined();
  });
});
