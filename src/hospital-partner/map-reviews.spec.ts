import { PartnerService } from './partner.service';

// Branch disambiguation is the risky bit of review mapping: sibling branches and
// same-city rival groups share a near-identical name, and mis-mapping attributes
// one hospital's patient reviews to another. Rows below are the real Delhi
// "Max"-matching hospitals; the applicant is Max Saket (address names the branch).
const ROWS = [
  { id: 'gmap-dwarka', name: 'Max Super Speciality Hospital Dwarka', city: 'Delhi' },
  { id: 'gmap-blk', name: 'BLK-Max Super Speciality Hospital Delhi', city: 'New Delhi' },
  { id: 'max-delhi', name: 'Max Super Speciality Hospital', city: 'Saket, New Delhi' },
  { id: 'blk-delhi', name: 'BLK-Max Super Speciality Hospital', city: 'New Delhi' },
  { id: 'gmap-patparganj', name: 'Max Super Speciality Hospital, Patparganj', city: 'Delhi' },
  { id: 'gmap-saket', name: 'Max Super Speciality Hospital, Saket (Max Saket)', city: 'New Delhi' },
  { id: 'gmap-shalimar', name: 'Max Super Speciality Hospital, Shalimar Bagh', city: 'New Delhi' },
  { id: 'gmap-noida', name: 'Max Super Speciality Hospital, Sector 128, Noida', city: 'Noida' },
];
const SAKET_ADDR = '1 2, Press Enclave Marg, Saket Institutional Area, Saket, New Delhi, Delhi 110017, India';

describe('mapExistingReviews branch matching', () => {
  let moved: string[] = [];
  const prisma: any = {
    hospital: { findMany: async () => ROWS },
    review: { updateMany: async ({ where }: any) => { moved = where.hospitalId.in; return { count: moved.length }; } },
  };
  const svc = new PartnerService(prisma, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
  const map = (name: string, city: string, address?: string) =>
    (svc as any).mapExistingReviews('new-id', name, city, address).then(() => moved);

  beforeEach(() => { moved = []; });

  it('maps the applicant\'s own branch rows (both duplicates of Max Saket)', async () => {
    const got = await map('Max Super Speciality Hospital', 'New Delhi', SAKET_ADDR);
    expect(got.sort()).toEqual(['gmap-saket', 'max-delhi']);
  });

  it('never maps sibling branches or a rival group with a near-identical name', async () => {
    const got = await map('Max Super Speciality Hospital', 'New Delhi', SAKET_ADDR);
    for (const stray of ['gmap-dwarka', 'gmap-patparganj', 'gmap-shalimar', 'gmap-blk', 'blk-delhi']) {
      expect(got).not.toContain(stray);
    }
  });

  it('maps nothing when the address does not name a branch we hold a row for', async () => {
    expect(await map('Max Super Speciality Hospital', 'Mumbai', 'Andheri East, Mumbai')).toEqual([]);
  });
});
