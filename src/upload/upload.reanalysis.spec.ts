import { writeFile, mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { UploadService, MAX_REANALYSIS, MAX_DOCUMENTS } from './upload.service';

/**
 * The two decisions a client must never be trusted for on this route:
 *   1. the re-analysis cap — every run is a full GPU generation on unchanged input;
 *   2. ownership of `previousReportId` — it names a set of stored PHI documents to
 *      pull into the caller's own analysis, so an unchecked id leaks another
 *      patient's medical reports.
 */
describe('UploadService — re-analysis cap & document carry-forward', () => {
  let dir: string;
  let docPath: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'curify-report-'));
    docPath = join(dir, 'report.pdf');
    await writeFile(docPath, 'stored report bytes');
  });
  afterAll(async () => rm(dir, { recursive: true, force: true }));

  // Fake DB holding one report row; `create` records what the service asked for
  // so we can assert on the new row without a real Postgres.
  function build(report: any) {
    const created: any[] = [];
    const prisma: any = {
      report: {
        findUnique: async ({ where }: any) => (where.id === report?.id ? report : null),
        create: async ({ data }: any) => {
          created.push(data);
          return { ...data, id: 'new-report' };
        },
        update: async () => ({}),
      },
    };
    // The AI never runs here — the job is fire-and-forget and these assertions are
    // all about the decision made before it starts.
    const svc = new UploadService(prisma, { analyzeReport: async () => ({}) } as any);
    return { svc, created };
  }

  const stored = () => [{ path: docPath, name: 'report.pdf', mime: 'application/pdf' }];
  const report = (over: any = {}) => ({
    id: 'r1', userId: 'u1', reanalysisCount: 0, docPaths: stored(),
    treatment: 'cardiology', country: 'India', urgency: 'soon', ...over,
  });

  it('allows re-analysis up to the cap, then refuses', async () => {
    for (let n = 0; n < MAX_REANALYSIS; n++) {
      const { svc, created } = build(report({ reanalysisCount: n }));
      await expect(svc.reanalyze('r1', 'u1')).resolves.toMatchObject({ status: 'PROCESSING' });
      // Each run must record itself, or the cap never advances and re-runs are infinite.
      expect(created[0].reanalysisCount).toBe(n + 1);
    }

    const { svc } = build(report({ reanalysisCount: MAX_REANALYSIS }));
    await expect(svc.reanalyze('r1', 'u1')).rejects.toThrow(/already been re-analysed/i);
  });

  it('re-analysis keeps the original report — it never overwrites it', async () => {
    // A failed re-run must not cost the patient the analysis they already have.
    const { svc, created } = build(report());
    const res: any = await svc.reanalyze('r1', 'u1');
    expect(res.reportId).toBe('new-report');
    expect(created[0].reanalysisCount).toBe(1);
  });

  it('refuses to re-analyse when the stored documents are gone', async () => {
    // Otherwise it would silently fall back to the description and return a
    // confident, N/A-filled report built from a treatment hint.
    const { svc } = build(report({ docPaths: [{ path: join(dir, 'missing.pdf'), mime: 'application/pdf' }] }));
    await expect(svc.reanalyze('r1', 'u1')).rejects.toThrow(/no longer available/i);

    const none = build(report({ docPaths: [] }));
    await expect(none.svc.reanalyze('r1', 'u1')).rejects.toThrow(/no longer available/i);
  });

  it("refuses another patient's report — for re-analysis and for carry-forward", async () => {
    // Both routes take a report id from the client and read its stored PHI.
    const a = build(report({ userId: 'someone-else' }));
    await expect(a.svc.reanalyze('r1', 'u1')).rejects.toThrow(/not found/i);

    const b = build(report({ userId: 'someone-else' }));
    await expect(
      b.svc.analyzeAndStore({ userId: 'u1', files: [], previousReportId: 'r1' }),
    ).rejects.toThrow(/not found/i);
  });

  it('analyses the new file TOGETHER with the ones already stored', async () => {
    // The whole point of "upload another report": the AI must see old + new in one
    // pass and produce a combined report, not analyse the new file in isolation.
    const seen: any[] = [];
    let done: () => void;
    const finished = new Promise<void>((r) => { done = r; });
    const prisma: any = {
      report: {
        // Stored as an image so both documents travel the same route to the model
        // and the merge itself is what's being asserted (a stored PDF would instead
        // be OCR'd/parsed into reportText).
        findUnique: async () => report({ docPaths: [{ path: docPath, name: 'old.png', mime: 'image/png' }] }),
        create: async ({ data }: any) => ({ ...data, id: 'combined' }),
        update: async () => ({}),
      },
    };
    const ai: any = {
      analyzeReport: async (p: any) => { seen.push(p); done(); return { diagnosis: { condition: 'x' } }; },
    };
    const svc = new UploadService(prisma, ai);

    await svc.analyzeAndStore({
      userId: 'u1',
      previousReportId: 'r1',
      // An image so the job skips PDF parsing and hands both straight to the model.
      files: [{ buffer: Buffer.from('new scan bytes'), mimetype: 'image/png', originalname: 'new.png' } as any],
    });
    await finished;

    // Both documents reached the model, earlier one first.
    expect(seen[0].files).toHaveLength(2);
    expect(seen[0].files.map((f: any) => Buffer.from(f.base64, 'base64').toString())).toEqual([
      'stored report bytes', 'new scan bytes',
    ]);
  });

  it('reuses text extracted on an earlier run instead of re-reading the document', async () => {
    // A scanned PDF costs ~18 s to OCR. Without caching, every follow-up upload
    // re-reads all the earlier scans and an 8-document analysis runs for minutes.
    let extracted = 0;
    const prisma: any = {
      report: {
        findUnique: async () => report({
          docPaths: [{ path: docPath, name: 'old.pdf', mime: 'application/pdf', text: 'PREVIOUSLY OCR D REPORT TEXT' }],
        }),
        create: async ({ data }: any) => ({ ...data, id: 'combined' }),
        update: async () => ({}),
      },
    };
    let done: () => void;
    const finished = new Promise<void>((r) => { done = r; });
    const seen: any[] = [];
    const svc = new UploadService(prisma, { analyzeReport: async (p: any) => { seen.push(p); done(); return { diagnosis: {} }; } } as any);
    jest.spyOn(svc as any, 'extractPdfText').mockImplementation(async () => { extracted++; return 'freshly read'; });

    await svc.analyzeAndStore({
      userId: 'u1', previousReportId: 'r1',
      files: [{ buffer: Buffer.from('%PDF-new'), mimetype: 'application/pdf', originalname: 'new.pdf' } as any],
    });
    await finished;

    // Only the NEW document was read; the cached text was reused for the old one.
    expect(extracted).toBe(1);
    expect(seen[0].reportText).toContain('PREVIOUSLY OCR D REPORT TEXT');
    expect(seen[0].reportText).toContain('freshly read');
  });

  it(`refuses to exceed ${MAX_DOCUMENTS} documents across old + new`, async () => {
    // The cap spans the whole analysis, not one request — otherwise each re-upload
    // could add another 8 and grow the prompt without limit.
    const many = Array.from({ length: 7 }, (_, i) => ({ path: docPath, name: `r${i}.pdf`, mime: 'application/pdf' }));
    const { svc } = build(report({ docPaths: many }));
    const file = (n: string) => ({ buffer: Buffer.from('x'), mimetype: 'image/png', originalname: n } as any);

    // 7 stored + 2 new = 9 → refused, and the message says how much room is left.
    await expect(
      svc.analyzeAndStore({ userId: 'u1', previousReportId: 'r1', files: [file('a.png'), file('b.png')] }),
    ).rejects.toThrow(/add 1 more/i);

    // 7 + 1 = 8 → exactly at the cap, allowed.
    const ok = build(report({ docPaths: many }));
    await expect(
      ok.svc.analyzeAndStore({ userId: 'u1', previousReportId: 'r1', files: [file('a.png')] }),
    ).resolves.toMatchObject({ status: 'PROCESSING' });
  });

  it('tells the patient plainly when the analysis is already full', async () => {
    const full = Array.from({ length: MAX_DOCUMENTS }, () => ({ path: docPath, mime: 'application/pdf' }));
    const { svc } = build(report({ docPaths: full }));
    await expect(
      svc.analyzeAndStore({
        userId: 'u1', previousReportId: 'r1',
        files: [{ buffer: Buffer.from('x'), mimetype: 'image/png', originalname: 'a.png' } as any],
      }),
    ).rejects.toThrow(/already covers the maximum/i);
  });

  it('carries the earlier documents onto the new report', async () => {
    // The point of the feature: a follow-up upload is analysed WITH the earlier
    // reports, so the new row must inherit their paths rather than start empty.
    const { svc, created } = build(report());
    await svc.reanalyze('r1', 'u1');
    expect(created[0].filename).toContain('report.pdf');
    // Request context is carried too, so the re-run sees the same case as the original.
    expect(created[0]).toMatchObject({ treatment: 'cardiology', country: 'India', urgency: 'soon' });
  });
});
