import { AiService } from './ai.service';

/**
 * The composite score is what a patient and a hospital actually act on.
 *
 * It used to be a number the LLM emitted: for one identical angiography report it
 * returned 43, 42.5, 71 and 71 across four runs while every clinical finding stayed
 * the same. It is now derived in code from the model's per-parameter scores, so the
 * same findings always produce the same score.
 */
describe('AiService.scoreReport — deterministic composite scoring', () => {
  // scoreReport is private and touches no I/O; construct without a live provider.
  const svc = new AiService();
  const score = (report: any) => { (svc as any).scoreReport(report); return report; };

  const cat = (name: string, scores: number[]) => ({
    name, parameters: scores.map((s, i) => ({ parameter: `p${i}`, score: s })),
  });

  it('is a pure function of the findings — identical input, identical score', () => {
    const build = () => ({ categories: [cat('Blood Report', [0, 2, 4, 1])], composite: [] });
    const runs = Array.from({ length: 5 }, () => score(build()).compositeScore);
    expect(new Set(runs).size).toBe(1);
  });

  it('scores all-normal as 0 and all-critical as 100', () => {
    expect(score({ categories: [cat('Blood Report', [0, 0, 0])] }).compositeScore).toBe(0);
    expect(score({ categories: [cat('Blood Report', [4, 4, 4])] }).compositeScore).toBe(100);
  });

  it('places the score in the band its severity label claims', () => {
    // mean 1.75 + worst 4 → 2.875/4 = 72% → Severe. The label must never disagree
    // with the number, which is exactly what broke before ("Severe" with a 43).
    const r = score({ categories: [cat('Blood Report', [0, 2, 4, 1])] });
    expect(r.compositeScore).toBe(72);
    expect(r.compositeSeverity).toBe('Severe');
  });

  it('does not let normal findings average away a critical one', () => {
    // The safety property: adding normal rows beside a critical finding must not
    // walk the score down into a reassuring band. Under a plain mean, a 95% LAD
    // stenosis scored "Mild" once enough normal vessels were listed.
    const padded = score({ categories: [cat('Angiography', [4, 0, 0, 0, 0, 0])] });
    // Must not land in a reassuring band. Under a plain mean this was 17 → "Normal".
    expect(padded.compositeScore).toBeGreaterThanOrEqual(41);
    expect(['Moderate', 'Severe', 'Critical']).toContain(padded.compositeSeverity);
  });

  it('applies the clinical weighting the model chose', () => {
    // Respiratory case: HRCT severe (4s) weighted 80, blood normal (0s) weighted 20.
    // Weighted heavily toward the lungs → high score, not the 50 a mean would give.
    const r = score({
      categories: [cat('HRCT Chest Report', [4, 4]), cat('Blood Report', [0, 0])],
      composite: [
        { category: 'HRCT Chest Report', weightPct: 80 },
        { category: 'Blood Report', weightPct: 20 },
      ],
    });
    expect(r.compositeScore).toBe(80);
    expect(r.compositeSeverity).toBe('Severe');
  });

  it('falls back to equal weights when the model omits or zeroes them', () => {
    const r = score({ categories: [cat('A', [4, 4]), cat('B', [0, 0])], composite: [] });
    expect(r.compositeScore).toBe(50);
  });

  it('rebuilds composite[] so the displayed table matches the total', () => {
    const r = score({
      categories: [cat('HRCT Chest Report', [4, 4]), cat('Blood Report', [0, 0])],
      composite: [
        { category: 'HRCT Chest Report', weightPct: 80 },
        { category: 'Blood Report', weightPct: 20 },
      ],
    });
    expect(r.composite.map((c: any) => c.weightPct).reduce((a: number, b: number) => a + b, 0)).toBe(100);
    expect(r.composite[0]).toMatchObject({ category: 'HRCT Chest Report', subScore: '8 / 8', severity: 'Critical' });
    expect(r.composite[1]).toMatchObject({ category: 'Blood Report', subScore: '0 / 8', severity: 'Normal' });
  });

  it('ignores unscorable parameters instead of counting them as normal', () => {
    // A missing/garbage score must not silently drag the average toward 0 — that
    // would make a severe report look mild.
    const r = score({
      categories: [{ name: 'Blood Report', parameters: [{ score: 4 }, { score: null }, { score: 'n/a' }, { score: 9 }] }],
    });
    expect(r.compositeScore).toBe(100); // only the single valid 4 counts
  });

  it('repairs a description-only report whose band label is not a real band', () => {
    // "Moderate-High" is not in the 0-100 band table; the old normaliser skipped it
    // and let an arbitrary 42.5 through.
    const r = score({ categories: [], composite: [], compositeScore: 42.5, compositeSeverity: 'Moderate-High' });
    expect(Number.isInteger(r.compositeScore)).toBe(true);
    expect(['Normal', 'Mild', 'Moderate', 'Severe', 'Critical']).toContain(r.compositeSeverity);
  });

  it('snaps a description-only score into the band it claims', () => {
    const r = score({ categories: [], compositeScore: 5, compositeSeverity: 'Severe' });
    expect(r.compositeScore).toBeGreaterThanOrEqual(61);
    expect(r.compositeScore).toBeLessThanOrEqual(80);
  });
});
