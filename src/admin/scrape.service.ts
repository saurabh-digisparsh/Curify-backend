import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { spawn } from 'child_process';
import * as path from 'path';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TriggerScrapeDto } from './dto/trigger-scrape.dto';
import { EnrichmentService } from './enrichment.service';
import { ReviewLangService } from './review-lang.service';
import { natRegion } from '../common/regions';

const ROWS_BEGIN = '===ROWS_BEGIN===';
const ROWS_END = '===ROWS_END===';
const SCRAPERS_DIR = path.join(process.cwd(), 'scripts', 'scrapers');

// Scraped review dates arrive as free-text ("Aug 15, 2024", ISO, sometimes relative).
// Parse absolute forms into a Date; unparseable/relative strings ("2 months ago") → null.
// ponytail: no relative-date parser — add one if the scraper starts returning those.
function toReviewDate(s?: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function parsePrice(raw: string): number | null {
  const n = parseInt(String(raw).replace(/[^0-9]/g, ''), 10);
  return isNaN(n) || n < 100 || n > 500_000 ? null : n;
}

@Injectable()
export class ScrapeService {
  private readonly logger = new Logger(ScrapeService.name);

  constructor(
    private prisma: PrismaService,
    private enrichment: EnrichmentService,
    private reviewLang: ReviewLangService,
  ) {}

  /** Create a job and kick off the scrape in the background; returns immediately. */
  async trigger(dto: TriggerScrapeDto, adminId: string) {
    const job = await this.prisma.scrapeJob.create({
      data: {
        target: dto.target,
        params: { location: dto.location ?? null, hospitalName: dto.hospitalName ?? null, region: dto.region ?? null, minReviews: dto.minReviews ?? null },
        status: 'PENDING',
        triggeredBy: adminId,
      },
    });

    // Fire-and-forget — the admin polls GET /admin/scrape/:id for progress.
    void this.run(job.id, dto);
    return job;
  }

  findAll() {
    return this.prisma.scrapeJob.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  }

  /**
   * Scrape EVERY hospital in the DB (refresh reviews per hospital). Creates one
   * tracked ScrapeJob and loops sequentially in the background; returns immediately.
   * Used by the manual trigger and the daily 02:00 IST cron.
   */
  async scrapeAllHospitals(triggeredBy: string) {
    const hospitals = await this.prisma.hospital.findMany({ select: { id: true, name: true, city: true } });
    const job = await this.prisma.scrapeJob.create({
      data: {
        target: 'all-hospitals',
        params: { count: hospitals.length } as any,
        status: 'RUNNING',
        triggeredBy,
        startedAt: new Date(),
      },
    });
    void this.runAllHospitals(job.id, hospitals);
    return job;
  }

  /**
   * Scrape exactly ONE hospital — the next one in a round-robin that advances each
   * day and wraps back to the first after the last. Runs the full pipeline for that
   * hospital (bounded by whatever Google/API quota is available). Used by the daily
   * 02:00 IST cron so each day refreshes a different hospital.
   */
  async scrapeNextHospital(triggeredBy: string) {
    const hospitals = await this.prisma.hospital.findMany({ orderBy: { id: 'asc' }, select: { id: true, name: true, city: true } });
    if (!hospitals.length) throw new Error('no hospitals in the DB to scrape');

    // Cursor: pick up after the last hospital this rotation scraped; else start at 0.
    const lastJob = await this.prisma.scrapeJob.findFirst({ where: { target: 'hospital-rotation' }, orderBy: { createdAt: 'desc' } });
    const lastId = (lastJob?.params as any)?.hospitalId as string | undefined;
    let idx = 0;
    if (lastId) {
      const pos = hospitals.findIndex((h) => h.id === lastId);
      idx = pos === -1 ? 0 : (pos + 1) % hospitals.length; // wrap to first after the last
    }
    const h = hospitals[idx];

    const job = await this.prisma.scrapeJob.create({
      data: {
        target: 'hospital-rotation',
        params: { hospitalId: h.id, hospitalName: h.name, hospitalCity: h.city, index: idx, total: hospitals.length } as any,
        status: 'RUNNING',
        triggeredBy,
        startedAt: new Date(),
      },
    });
    this.logger.log(`hospital-rotation: scraping #${idx + 1}/${hospitals.length} — '${h.name}' (${h.city})`);
    // Full pipeline (JCI → reviews → surgeons → surgeon-reviews → prices) for this one hospital,
    // capturing the review-count delta + per-review new/updated/rejected log for the detail view.
    void this.runHospitalRotation(job.id, h);
    return job;
  }

  /**
   * Scrape reviews for ONE specific hospital by id — used by hospital onboarding
   * go-live to fetch reviews for a freshly-published hospital that has none yet.
   * Fire-and-forget: returns the created job; the review pipeline runs in the
   * background and maps reviews onto this hospital's id.
   * minReviews caps how many foreign reviews the pipeline collects before stopping.
   */
  async scrapeOneHospital(hospitalId: string, triggeredBy: string, minReviews?: number) {
    const h = await this.prisma.hospital.findUnique({ where: { id: hospitalId }, select: { id: true, name: true, city: true } });
    if (!h) throw new NotFoundException('Hospital not found');
    const job = await this.prisma.scrapeJob.create({
      data: {
        target: 'hospital-rotation',
        params: { hospitalId: h.id, hospitalName: h.name, hospitalCity: h.city, onboarding: true } as any,
        status: 'RUNNING', triggeredBy, startedAt: new Date(),
      },
    });
    this.logger.log(`onboarding scrape: fetching reviews for '${h.name}' (${h.city})`);
    void this.runHospitalRotation(job.id, h, minReviews);
    return job;
  }

  /** Run the FOREIGN-PIPELINE for ONE hospital, recording review count before/after + per-review log. */
  private async runHospitalRotation(jobId: string, hospital: { id: string; name: string; city: string }, minReviews?: number) {
    const dto = { target: 'foreign-pipeline', hospitalName: hospital.name, location: hospital.city, minReviews } as TriggerScrapeDto;
    const reviewCountBefore = await this.prisma.review.count({ where: { hospitalId: hospital.id } });
    try {
      const { rows } = await this.spawnScraper('foreign-pipeline', dto);
      // Force foreign reviews onto THIS hospital's id so the count delta is accurate.
      const res: any = await this.importPipeline(rows, dto.location, hospital.id);
      const reviewLog: any[] = Array.isArray(res.log) ? res.log : [];
      const reviewCountAfter = await this.prisma.review.count({ where: { hospitalId: hospital.id } });
      await this.prisma.scrapeJob.update({
        where: { id: jobId },
        data: {
          status: 'DONE',
          finishedAt: new Date(),
          created: res.revNew ?? res.created ?? 0,
          updated: res.revUpd ?? res.updated ?? 0,
          skipped: res.skipped ?? 0,
          summary: {
            hospitalId: hospital.id, hospitalName: hospital.name, hospitalCity: hospital.city,
            pipeline: 'foreign-pipeline',
            foreignFetched: res.fetched ?? 0,
            reviewCountBefore, reviewCountAfter,
            newReviews: reviewLog.filter((r) => r.outcome === 'new').length,
            updatedReviews: reviewLog.filter((r) => r.outcome === 'updated').length,
            rejectedReviews: reviewLog.filter((r) => r.outcome === 'rejected').length,
            reviews: reviewLog,
          } as any,
        },
      });
      this.logger.log(`rotation ${jobId} done (foreign-pipeline): '${hospital.name}' reviews ${reviewCountBefore}→${reviewCountAfter}`);
    } catch (e: any) {
      await this.prisma.scrapeJob.update({
        where: { id: jobId },
        data: { status: 'FAILED', finishedAt: new Date(), error: String(e.message ?? e).slice(0, 2000) },
      });
      this.logger.error(`rotation ${jobId} failed: ${e.message}`);
    }
  }

  private async runAllHospitals(jobId: string, hospitals: { id: string; name: string; city: string }[]) {
    let created = 0, updated = 0, skipped = 0, done = 0, failed = 0;
    for (const h of hospitals) {
      try {
        const { rows } = await this.spawnScraper('foreign-pipeline', { target: 'foreign-pipeline', location: h.city, hospitalName: h.name } as TriggerScrapeDto);
        const counts: any = await this.importPipeline(rows, h.city, h.id);
        created += counts.revNew ?? counts.created ?? 0; updated += counts.revUpd ?? counts.updated ?? 0; skipped += counts.skipped ?? 0;
      } catch (e: any) {
        failed++;
        this.logger.warn(`all-hospitals: '${h.name}' failed: ${e.message}`);
      }
      done++;
      await this.prisma.scrapeJob.update({
        where: { id: jobId },
        data: { created, updated, skipped, output: `${done}/${hospitals.length} hospitals scraped (${failed} failed)` },
      }).catch(() => undefined);
    }
    await this.prisma.scrapeJob.update({
      where: { id: jobId },
      data: { status: 'DONE', finishedAt: new Date(), created, updated, skipped, output: `${done}/${hospitals.length} hospitals scraped (${failed} failed)` },
    });
    this.logger.log(`all-hospitals job ${jobId} done: ${done} scraped, ${created} new reviews, ${updated} updated, ${failed} failed`);
  }

  async findOne(id: string) {
    const job = await this.prisma.scrapeJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Scrape job not found');
    return job;
  }

  // The combined 'full' pipeline: hospital → reviews → surgeons → surgeon
  // reviews → pricing, in order, each storing as it completes.
  private static readonly FULL_STAGES: { target: string; label: string }[] = [
    { target: 'jci', label: 'Hospitals' },
    { target: 'reviews', label: 'Hospital reviews' },
    { target: 'surgeons', label: 'Surgeons' },
    { target: 'surgeon-reviews', label: 'Surgeon reviews' },
    { target: 'prices', label: 'Pricing' },
  ];

  // ── Internal: run the Python scraper, then import its rows ──────────────────
  private async run(jobId: string, dto: TriggerScrapeDto) {
    await this.prisma.scrapeJob.update({
      where: { id: jobId },
      data: { status: 'RUNNING', startedAt: new Date() },
    });

    if (dto.target === 'full') return this.runFull(jobId, dto);

    try {
      const { rows, output } = await this.spawnScraper(dto.target, dto);
      const counts: any = dto.target === 'foreign-pipeline'
        ? await this.importPipeline(rows, dto.location)
        : await this.importRows(dto.target, rows, dto.location);

      // Build a human run summary (shown in the job's "description" section).
      const summary = dto.target === 'foreign-pipeline'
        ? {
            combination: [dto.hospitalName, dto.location, dto.region].filter(Boolean).join(' · ') || '—',
            hospital: dto.hospitalName ?? null,
            city: dto.location ?? null,
            region: dto.region ?? null,
            minTarget: dto.minReviews ?? null,
            fetched: counts.fetched ?? 0,        // total records fetched
            foreign: counts.fetched ?? 0,        // all fetched are foreign by design
            new: counts.revNew ?? counts.created ?? 0,
            updated: counts.revUpd ?? counts.updated ?? 0,
            metMinimum: (counts.fetched ?? 0) >= (dto.minReviews ?? 0),
          }
        : undefined;

      await this.prisma.scrapeJob.update({
        where: { id: jobId },
        data: {
          status: 'DONE',
          finishedAt: new Date(),
          created: counts.created,
          updated: counts.updated,
          skipped: counts.skipped,
          summary: summary as any,
          output: output.slice(-4000),
        },
      });
    } catch (err: any) {
      this.logger.error(`Scrape job ${jobId} failed: ${err.message}`);
      await this.prisma.scrapeJob.update({
        where: { id: jobId },
        data: { status: 'FAILED', finishedAt: new Date(), error: String(err.message ?? err).slice(0, 2000) },
      });
    }
  }

  /** Run every stage in sequence as ONE job, updating per-stage progress live. */
  private async runFull(jobId: string, dto: TriggerScrapeDto) {
    const stages = ScrapeService.FULL_STAGES.map((s) => ({
      target: s.target, label: s.label, status: 'PENDING' as string,
      created: 0, updated: 0, skipped: 0, note: '' as string,
    }));
    await this.prisma.scrapeJob.update({ where: { id: jobId }, data: { stages } });

    let totalC = 0, totalU = 0, totalS = 0;

    for (let i = 0; i < stages.length; i++) {
      const st = stages[i];
      st.status = 'RUNNING';
      await this.prisma.scrapeJob.update({ where: { id: jobId }, data: { stages } });

      try {
        const { rows, output } = await this.spawnScraper(st.target, dto);
        const counts = await this.importRows(st.target, rows, dto.location);
        st.created = counts.created; st.updated = counts.updated; st.skipped = counts.skipped;
        st.status = 'DONE';
        if (rows.length === 0) {
          // Surface the scraper's own note (e.g. "source not wired") from stderr.
          const noteLine = output.split('\n').reverse().find((l) => l.includes(`${st.target}:`));
          st.note = (noteLine || 'no rows returned').trim().slice(0, 200);
        }
        totalC += counts.created; totalU += counts.updated; totalS += counts.skipped;
      } catch (err: any) {
        st.status = 'FAILED';
        st.note = String(err.message ?? err).slice(0, 200);
        this.logger.warn(`full job ${jobId} stage ${st.target} failed: ${err.message}`);
      }
      await this.prisma.scrapeJob.update({ where: { id: jobId }, data: { stages } });
    }

    const anyDone = stages.some((s) => s.status === 'DONE');
    await this.prisma.scrapeJob.update({
      where: { id: jobId },
      data: {
        status: anyDone ? 'DONE' : 'FAILED',
        finishedAt: new Date(),
        created: totalC, updated: totalU, skipped: totalS,
        stages,
      },
    });
  }

  private spawnScraper(target: string, dto: TriggerScrapeDto): Promise<{ rows: any[]; output: string }> {
    const python = process.env.PYTHON_BIN || 'python';
    const args = [
      'run_scrape.py',
      '--target', target,
      '--location', dto.location ?? '',
      '--hospital', dto.hospitalName ?? '',
      '--region', dto.region ?? '',
      '--min', String(dto.minReviews ?? 0),
    ];

    // The scraper gets its OWN YouTube key (key 2) so it never competes with the
    // leads pipeline (key 1) for the per-key daily quota.
    const scraperEnv = {
      ...process.env,
      YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY_2 || process.env.YOUTUBE_API_KEY_1 || process.env.YOUTUBE_API_KEY,
    };
    return new Promise((resolve, reject) => {
      const proc = spawn(python, args, { cwd: SCRAPERS_DIR, env: scraperEnv });
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (d) => (stdout += d.toString()));
      proc.stderr.on('data', (d) => (stderr += d.toString()));
      proc.on('error', (e) =>
        reject(new Error(`Failed to start "${python}" (is Python installed / PYTHON_BIN set?): ${e.message}`)),
      );
      proc.on('close', (code) => {
        if (code !== 0) return reject(new Error(`Scraper exited ${code}: ${stderr.slice(-1000)}`));
        try {
          const start = stdout.indexOf(ROWS_BEGIN);
          const end = stdout.indexOf(ROWS_END);
          if (start === -1 || end === -1) throw new Error('No ROWS markers in scraper output');
          const json = stdout.slice(start + ROWS_BEGIN.length, end).trim();
          resolve({ rows: JSON.parse(json), output: stderr });
        } catch (e: any) {
          reject(new Error(`Could not parse scraper output: ${e.message}`));
        }
      });
    });
  }

  // ── Normalisation helpers for duplicate detection (Rule 1) ──────────────────
  private normName(s: string): string {
    return (s || '').toLowerCase().split('|')[0]
      .replace(/\b(pvt|ltd|private|limited|hospitals?|healthcare|medical|centre|center|institute|clinic|best|in|the|road|rd|unit|of)\b/g, ' ')
      .replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  private cityKey(s: string): string {
    const c = (s || '').toLowerCase();
    if (/bengaluru|bangalore/.test(c)) return 'bangalore';
    if (/bombay|mumbai/.test(c)) return 'mumbai';
    if (/madras|chennai/.test(c)) return 'chennai';
    if (/calcutta|kolkata/.test(c)) return 'kolkata';
    if (/gurgaon|gurugram/.test(c)) return 'gurgaon';
    if (/delhi|ncr/.test(c)) return 'delhi';
    return c.split(/[\s(,]/)[0] || c;
  }

  /**
   * RULE 1 — has this hospital already been scraped? Returns the existing id to
   * reuse, or null to create. Matches on: exact id (same Google place / slug),
   * or a strong name+city overlap. Logs a warning for weaker look-alikes rather
   * than auto-merging (different branches of one chain are genuinely distinct).
   */
  private async resolveExistingHospitalId(name: string, city: string, desiredId: string): Promise<string | null> {
    const exact = await this.prisma.hospital.findUnique({ where: { id: desiredId }, select: { id: true } });
    if (exact) return exact.id;

    const nn = this.normName(name);
    if (!nn) return null;
    const ck = this.cityKey(city);
    const tokens = new Set(nn.split(' ').filter(Boolean));
    const all = await this.prisma.hospital.findMany({ select: { id: true, name: true, city: true } });
    let weak: string | null = null;
    for (const h of all) {
      if (this.cityKey(h.city) !== ck) continue;
      const hn = this.normName(h.name);
      if (!hn) continue;
      if (hn === nn || hn.includes(nn) || nn.includes(hn)) return h.id;       // strong → reuse
      const ht = new Set(hn.split(' ').filter(Boolean));
      const inter = [...tokens].filter((t) => ht.has(t)).length;
      if (inter >= 2 && inter >= Math.min(tokens.size, ht.size)) return h.id; // strong overlap → reuse
      if (inter >= 1) weak = h.id;                                            // same chain+city → warn only
    }
    if (weak) this.logger.warn(`Rule1: '${name}' (${city}) resembles existing '${weak}' — created separately, review for merge`);
    return null;
  }

  /**
   * RULE 2 — verify a hospital against the live JCI directory by name + city.
   * Spawns the `jci` scraper (early-stops on a name match). Best-effort.
   */
  private async verifyJci(name: string, city: string): Promise<boolean> {
    const keyword = this.normName(name).split(' ').filter((w) => w.length > 3).sort((a, b) => b.length - a.length)[0]
      || name.split(/\s+/)[0];
    const { rows } = await this.spawnScraper('jci', {
      target: 'jci', location: city, hospitalName: keyword,
    } as TriggerScrapeDto);
    return Array.isArray(rows) && rows.length > 0;
  }

  /**
   * Import the foreign-patient pipeline: typed rows (hospital | review | surgeon
   * | surgeon-review). Conditional save — only runs if foreign reviews exist
   * (the Python returns nothing otherwise). Stores hospital, foreign reviews,
   * surgeons (from doctor mentions), and each surgeon's reviews.
   */
  private async importPipeline(rows: any[], location?: string, forceHospitalId?: string) {
    let created = 0, updated = 0, skipped = 0;
    let revNew = 0, revUpd = 0; // foreign-review specific (for the run summary)
    const log: any[] = []; // per-review new/updated/rejected outcomes (for the job detail)
    const fetched = rows.filter((r) => r.kind === 'review' || r.kind === 'surgeon-review').length;
    if (!rows.length) return { created, updated, skipped, fetched: 0, revNew, revUpd, log, hospitalId: forceHospitalId ?? null }; // no foreign patients

    const hash = (t: string) =>
      crypto.createHash('md5').update(t.toLowerCase().replace(/\s+/g, ' ').trim()).digest('hex');

    // 1) Hospital (must exist before reviews/surgeons reference it).
    const hRow = rows.find((r) => r.kind === 'hospital');
    if (!hRow) return { created, updated, skipped, fetched, revNew, revUpd, log, hospitalId: forceHospitalId ?? null };
    const hName = (hRow.hospitalName || '').trim();
    const hCity = (hRow.hospitalCity || location || '').trim();
    const hRating = parseFloat(hRow.hospitalRating);
    const hPhone = hRow.hospitalPhone || null;
    const hSite = hRow.hospitalWebsite || null;
    const hAddr = hRow.hospitalAddress || null;
    const hLat = typeof hRow.hospitalLat === 'number' ? hRow.hospitalLat : null;
    const hLng = typeof hRow.hospitalLng === 'number' ? hRow.hospitalLng : null;
    const hMaps = hRow.hospitalMapsUri || null;
    const desiredId = hRow.hospitalPlaceId
      ? `gmap-${slugify(hRow.hospitalPlaceId)}`
      : slugify(`${hName}-${hCity || 'na'}`);

    // ── RULE 1: is this hospital already in the DB? (avoid duplicate slugs) ──
    // Rotation forces a specific hospital id so reviews attach to exactly that record.
    const existingId = forceHospitalId ?? await this.resolveExistingHospitalId(hName, hCity, desiredId);
    const hospitalId = existingId ?? desiredId;
    const isNew = forceHospitalId ? false : !existingId;

    if (isNew) {
      await this.prisma.hospital.create({
        data: {
          id: hospitalId, name: hName, city: hCity || 'Unknown', country: 'India',
          overallRating: isNaN(hRating) ? null : hRating,
          intlOfficePhone: hPhone, website: hSite,
          address: hAddr, latitude: hLat, longitude: hLng, googleMapsUri: hMaps,
        },
      });
      this.logger.log(`Rule1: created NEW hospital '${hospitalId}'`);
      // ── RULE 2: new hospital → verify JCI accreditation against the directory ──
      const isJci = await this.verifyJci(hName, hCity).catch(() => false);
      if (isJci) {
        await this.prisma.hospital.update({ where: { id: hospitalId }, data: { jciAccredited: true } });
        this.logger.log(`Rule2: '${hospitalId}' confirmed JCI-accredited`);
      } else {
        this.logger.log(`Rule2: '${hospitalId}' not found in JCI directory (left non-JCI)`);
      }
    } else {
      // reuse the existing record — update freshest data, never downgrade JCI.
      await this.prisma.hospital.update({
        where: { id: hospitalId },
        data: {
          overallRating: isNaN(hRating) ? undefined : hRating,
          intlOfficePhone: hPhone ?? undefined,
          website: hSite ?? undefined,
          address: hAddr ?? undefined,
          latitude: hLat ?? undefined,
          longitude: hLng ?? undefined,
          googleMapsUri: hMaps ?? undefined,
        },
      });
      this.logger.log(`Rule1: reused existing hospital '${hospitalId}' (no duplicate created)`);
    }

    // 2) Surgeons (from doctor mentions) → name→id map.
    const surgeonIds = new Map<string, string>();
    for (const r of rows.filter((x) => x.kind === 'surgeon')) {
      const sName = (r.surgeonName || '').trim();
      if (!sName) { skipped++; continue; }
      const sid = slugify(`${sName}-${hospitalId}`);
      await this.prisma.surgeon.upsert({
        where: { id: sid },
        update: { hospital: hName },
        create: { id: sid, name: sName, hospital: hName, country: 'India' },
      });
      surgeonIds.set(sName.toLowerCase(), sid);
      created++;
    }

    // 3) Reviews — ONE row per distinct review (dedup by contentHash). RULE:
    //    if the review already exists → UPDATE, else CREATE. A surgeon-review no
    //    longer makes a duplicate row; it just links the doctor onto the single row.
    const reviewIdByHash = new Map<string, string>();
    for (const r of rows) {
      if (r.kind !== 'review' && r.kind !== 'surgeon-review') continue;
      const text = (r.text ?? '').trim();
      const rev = (outcome: string, reason: string) => ({
        outcome, reason,
        reviewer: String(r.name || 'Anonymous').slice(0, 80),
        rating: parseInt(String(r.rating ?? ''), 10) || null,
        text: String(text || r.text || '').slice(0, 220),
        link: (r.link || '').startsWith('http') ? r.link : null,
        date: r.date || null,
        nationality: r.country || null,
      });
      if (text.length < 20) { log.push(rev('rejected', `review text too short (${text.length} chars, need ≥ 20)`)); skipped++; continue; }

      const contentHash = hash(text);
      const surgeonId = r.kind === 'surgeon-review'
        ? surgeonIds.get((r.surgeonName || '').toLowerCase()) ?? null
        : null;

      let existingId = reviewIdByHash.get(contentHash);
      if (!existingId) {
        const found = await this.prisma.review.findFirst({
          where: { hospitalId, contentHash }, select: { id: true },
        });
        existingId = found?.id;
      }

      if (existingId) {
        // duplicate → update (attach a surgeon link if this row carries one).
        if (surgeonId) await this.prisma.review.update({ where: { id: existingId }, data: { surgeonId } });
        reviewIdByHash.set(contentHash, existingId);
        log.push(rev('updated', 'already stored — refreshed'));
        updated++; revUpd++;
      } else {
        const rating = parseInt(String(r.rating ?? ''), 10);
        const total = parseInt(String(r.total_reviews ?? ''), 10);
        const row = await this.prisma.review.create({
          data: {
            hospitalId,
            surgeonId: surgeonId ?? undefined,
            reviewerName: (r.name || 'Anonymous').slice(0, 120),
            rating: isNaN(rating) || rating < 1 || rating > 5 ? 5 : rating,
            reviewDate: toReviewDate(r.date),
            text: text.slice(0, 5000),
            lang: r.lang || 'en',
            nationality: r.country || null,
            region: natRegion(r.country || null),
            totalReviews: isNaN(total) ? null : total,
            link: (r.link || '').startsWith('http') ? r.link : null,
            tokens: Array.isArray(r.tokens) ? r.tokens : undefined,
            flags: Array.isArray(r.flags) ? r.flags : undefined,
            contentHash,
            verified: false,
          },
          select: { id: true },
        });
        reviewIdByHash.set(contentHash, row.id);
        log.push(rev('new', 'new foreign review added'));
        created++; revNew++;
      }
    }

    // 4) Localize the imported reviews: detect language, store English translation (textEn)
    //    and native script for non-English reviews. Best-effort & offline.
    try {
      const res = await this.reviewLang.localizeHospital(hospitalId);
      if (res.translated) this.logger.log(`Localized ${res.translated} non-English review(s) for '${hospitalId}'`);
    } catch (e: any) {
      this.logger.warn(`Review localization skipped for '${hospitalId}': ${e.message}`);
    }

    // 5) Enrich a freshly-created hospital (price/included/surgeon/pros-cons/specialty).
    //    Best-effort & offline — never fail the scrape if the AI call errors. Reviews are
    //    now in the DB, so the enrichment can ground pros/cons and the surgeon in them.
    if (isNew) {
      try {
        await this.enrichment.enrichHospital(hospitalId);
        this.logger.log(`Enriched new hospital '${hospitalId}'`);
      } catch (e: any) {
        this.logger.warn(`Enrichment skipped for '${hospitalId}': ${e.message}`);
      }
    }

    return { created, updated, skipped, fetched, revNew, revUpd, log, hospitalId };
  }

  private async importRows(target: string, rows: any[], location?: string, forceHospitalId?: string) {
    let created = 0, updated = 0, skipped = 0;
    // Per-review outcome log (new / updated / rejected + reason) for the job detail view.
    const log: { outcome: string; reason: string; reviewer: string; rating: number | null; text: string; link: string | null; date: string | null }[] = [];

    for (const row of rows) {
      try {
        if (target === 'jci') {
          const name = (row.name ?? '').trim();
          if (!name) { skipped++; continue; }
          const id = row.id || slugify(name);
          const existing = await this.prisma.hospital.findUnique({ where: { id } });
          if (existing) {
            await this.prisma.hospital.update({ where: { id }, data: { jciAccredited: true } });
            updated++;
          } else {
            await this.prisma.hospital.create({
              data: { id, name, city: row.city || 'Unknown', country: row.country || 'India', jciAccredited: true },
            });
            created++;
          }
        } else if (target === 'surgeons') {
          const name = (row.name ?? '').trim();
          if (!name) { skipped++; continue; }
          const id = `${slugify(name)}-${slugify(row.hospital || 'na')}`;
          const years = parseInt(String(row.yearsExperience ?? '').match(/\d+/)?.[0] ?? '', 10);
          const data = {
            name,
            title: row.title || null,
            specialization: row.specialization || null,
            yearsExperience: isNaN(years) ? null : years,
            hospital: row.hospital || null,
            country: row.country || 'India',
            photoUrl: (row.photoUrl || '').startsWith('http') ? row.photoUrl : null,
          };
          const existing = await this.prisma.surgeon.findUnique({ where: { id } });
          if (existing) { await this.prisma.surgeon.update({ where: { id }, data }); updated++; }
          else { await this.prisma.surgeon.create({ data: { id, ...data } }); created++; }
        } else if (target === 'prices') {
          const price = parsePrice(row.price);
          const name = (row.hospitalName ?? '').trim();
          if (!price || !name) { skipped++; continue; }
          const keyword = name.split(/\s+/).find((w: string) => w.length > 4) ?? name;
          const res = await this.prisma.hospital.updateMany({
            where: { name: { contains: keyword, mode: 'insensitive' } },
            data: { quotedPriceUsd: price },
          });
          if (res.count > 0) updated += res.count;
          else skipped++;
        } else if (target === 'reviews' || target === 'surgeon-reviews') {
          // Link a scraped Google Maps review to a hospital by NAME + LOCATION.
          const text = (row.text ?? '').trim();
          const hospitalName = (row.hospitalName ?? '').trim();
          const rev = (outcome: string, reason: string) => ({
            outcome, reason,
            reviewer: String(row.name || row.reviewerName || 'Anonymous').slice(0, 80),
            rating: parseInt(String(row.rating ?? ''), 10) || null,
            text: String(text || row.text || '').slice(0, 220),
            link: (row.link || '').startsWith('http') ? row.link : null,
            date: row.date || null,
          });
          if (!hospitalName) { log.push(rev('rejected', 'no hospital name on the scraped review')); skipped++; continue; }
          if (!text || text.length < 20) { log.push(rev('rejected', `review text too short (${text.length} chars, need ≥ 20)`)); skipped++; continue; }

          const keyword = hospitalName.split(/\s+/).find((w: string) => w.length > 4) ?? hospitalName;
          const city = (row.hospitalCity || location || '').trim();
          // Rotation scrapes a SPECIFIC hospital → attach reviews to exactly that id
          // (don't re-match by name, which can split reviews onto a duplicate record).
          let hospital: { id: string } | null = forceHospitalId ? { id: forceHospitalId } : null;
          if (!hospital) hospital = await this.prisma.hospital.findFirst({
            where: {
              name: { contains: keyword, mode: 'insensitive' },
              ...(city ? { city: { contains: city, mode: 'insensitive' } } : {}),
            },
            select: { id: true },
          });
          // "scrape data AND review": if the hospital isn't in the DB yet, create it
          // from the scraped Google Maps place so its reviews have a home.
          if (!hospital) {
            const id = slugify(`${hospitalName}-${city || 'na'}`);
            const rating = parseFloat(row.hospitalRating);
            hospital = await this.prisma.hospital.upsert({
              where: { id },
              update: {},
              create: {
                id,
                name: hospitalName,
                city: city || 'Unknown',
                country: 'India',
                overallRating: isNaN(rating) ? null : rating,
              },
              select: { id: true },
            });
          }

          // Dedup on normalised text hash, scoped to the hospital.
          const contentHash = crypto.createHash('md5')
            .update(text.toLowerCase().replace(/\s+/g, ' ').trim()).digest('hex');
          const rating = parseInt(String(row.rating ?? ''), 10);
          const total = parseInt(String(row.total_reviews ?? ''), 10);
          const data = {
            reviewerName: (row.name || row.reviewerName || 'Anonymous').slice(0, 120),
            rating: isNaN(rating) || rating < 1 || rating > 5 ? 5 : rating,
            reviewDate: toReviewDate(row.date),
            text: text.slice(0, 5000),
            lang: row.lang || 'en',
            nationality: row.country || null,
            totalReviews: isNaN(total) ? null : total,
            link: (row.link || '').startsWith('http') ? row.link : null,
            tokens: Array.isArray(row.tokens) ? row.tokens : undefined,
            flags: Array.isArray(row.flags) ? row.flags : undefined,
          };
          // RULE: duplicate → update, else create.
          const dup = await this.prisma.review.findFirst({
            where: { hospitalId: hospital.id, contentHash }, select: { id: true },
          });
          if (dup) {
            await this.prisma.review.update({ where: { id: dup.id }, data });
            log.push(rev('updated', 'already stored — metrics/text refreshed'));
            updated++;
          } else {
            await this.prisma.review.create({
              data: { hospitalId: hospital.id, ...data, contentHash, verified: false },
            });
            log.push(rev('new', 'new review added'));
            created++;
          }
        } else {
          skipped++;
        }
      } catch (e: any) {
        this.logger.warn(`Import row failed: ${e.message}`);
        if (target === 'reviews' || target === 'surgeon-reviews') {
          log.push({ outcome: 'rejected', reason: `import error: ${e.message?.slice(0, 80)}`, reviewer: String(row.name || 'Anonymous').slice(0, 80), rating: null, text: String(row.text || '').slice(0, 220), link: null, date: row.date || null });
        }
        skipped++;
      }
    }

    return { created, updated, skipped, log };
  }
}
