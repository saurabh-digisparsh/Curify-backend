import { UploadService } from './upload.service';

// Mocked so the grouping logic is tested without touching the disk. Every path in
// the fixtures "exists" at 1 KB except the one named `gone.pdf`.
jest.mock('fs/promises', () => ({
  ...jest.requireActual('fs/promises'),
  stat: jest.fn(async (p: string) => {
    if (String(p).includes('gone')) throw new Error('ENOENT');
    return { size: 1024 };
  }),
}));

/**
 * My Documents self-check (ponytail rule). The invariants that make this list
 * usable, both learned from live data:
 *   (1) one real upload = one row, even though re-analyses create extra report
 *       rows that reference the SAME file on disk (measured: 9 refs, 3 files),
 *   (2) a file shared by a journey-linked and an unlinked report is filed under
 *       the journey, never stranded in "Not linked to a journey",
 *   (3) the emitted `index` still addresses the right slot in docPaths after
 *       duplicates are filtered out — otherwise the file route streams the wrong
 *       document, which for PHI is the worst possible bug.
 */
describe('UploadService.listMyDocuments', () => {
  const ANGIO = '/uploads/reports/angio.pdf';
  const HRCT = '/uploads/reports/hrct.pdf';

  // Mirrors the real shape found in the DB: newest first, the two newest reports
  // linked to journeys, the older ones being superseded re-analyses.
  function build() {
    const prisma: any = {
      report: {
        findMany: async () => [
          { id: 'r5', reportRef: 'RPT-5', createdAt: new Date('2026-02-05'), conditionName: 'CAD', treatment: 'cardiology',
            docPaths: [{ path: ANGIO, name: 'Angio.pdf', mime: 'application/pdf' }] },
          { id: 'r4', reportRef: 'RPT-4', createdAt: new Date('2026-02-04'), conditionName: 'CAD', treatment: 'cardiology',
            docPaths: [{ path: ANGIO, name: 'Angio.pdf', mime: 'application/pdf' },
                       { path: HRCT, name: 'HRCT.pdf', mime: 'application/pdf' }] },
          { id: 'r3', reportRef: 'RPT-3', createdAt: new Date('2026-02-03'), conditionName: null, treatment: null,
            docPaths: [{ path: ANGIO, name: 'Angio.pdf', mime: 'application/pdf' }] },
          { id: 'r2', reportRef: 'RPT-2', createdAt: new Date('2026-02-02'), conditionName: null, treatment: null,
            docPaths: [{ path: '', name: 'never-persisted.pdf', mime: 'application/pdf' }] },
          { id: 'r1', reportRef: 'RPT-1', createdAt: new Date('2026-02-01'), conditionName: null, treatment: null,
            docPaths: [{ path: '/uploads/reports/gone.pdf', name: 'gone.pdf', mime: 'application/pdf' }] },
        ],
      },
      journey: {
        findMany: async () => [
          { id: 'j1', title: 'Cardiology', treatment: 'cardiology', status: 'ACTIVE', reportId: 'r4' },
        ],
      },
    };
    return new UploadService(prisma, {} as any);
  }

  it('emits each stored file once and files shared files under the journey', async () => {
    const groups = await build().listMyDocuments('u1');

    const journey = groups.find((g) => g.journeyId === 'j1')!;
    const unlinked = groups.find((g) => g.journeyId === null)!;

    // (1)+(2) ANGIO is referenced by r5, r4 and r3 but belongs to the journey (r4).
    expect(journey.documents.map((d) => d.name).sort()).toEqual(['Angio.pdf', 'HRCT.pdf']);
    expect(unlinked?.documents.some((d) => d.name === 'Angio.pdf')).toBe(false);

    // Three distinct files across the whole list, never nine rows.
    const all = groups.flatMap((g) => g.documents);
    expect(all.filter((d) => d.name === 'Angio.pdf')).toHaveLength(1);

    // (3) HRCT is index 1 of r4's docPaths — dedup must not renumber it to 0.
    const hrct = journey.documents.find((d) => d.name === 'HRCT.pdf')!;
    expect(hrct).toMatchObject({ reportId: 'r4', index: 1 });

    // The unlinked group carries only the vanished file; the never-persisted one
    // (blank path, unretrievable forever) is dropped rather than shown as a dead row.
    expect(unlinked.documents.map((d) => d.name)).toEqual(['gone.pdf']);
    expect(unlinked.documents[0].size).toBeNull(); // → "No longer stored" in the UI

    // Journeys first, unlinked last.
    expect(groups[groups.length - 1].journeyId).toBeNull();
  });

  it('refuses a document that is not the caller\'s', async () => {
    const prisma: any = {
      report: { findUnique: async () => ({ id: 'r1', userId: 'someone-else', docPaths: [{ path: ANGIO, name: 'a.pdf' }] }) },
      journey: { findMany: async () => [] },
    };
    const svc = new UploadService(prisma, {} as any);
    await expect(svc.documentFile('r1', 0, 'u1')).rejects.toThrow('Document not found');
    // Same 404 for an out-of-range index, so ids/slots can't be probed.
    await expect(svc.documentFile('r1', 99, 'someone-else')).rejects.toThrow('Document not found');
  });
});
