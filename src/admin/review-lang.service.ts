import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';

const NON_LATIN = /[֐-׿؀-ۿЀ-ӿ一-鿿぀-ヿ가-힯ঀ-৿ऀ-ॿ฀-๿԰-֏ሀ-፿]/;

/**
 * Detects each review's language, stores an English translation (textEn) and the native
 * script (overwrites `text` for romanized non-English). Single source of truth used by the
 * scrape pipeline (auto, for newly-imported reviews) and the admin bulk endpoint.
 */
@Injectable()
export class ReviewLangService {
  private readonly logger = new Logger(ReviewLangService.name);
  constructor(private prisma: PrismaService, private ai: AiService) {}

  /** A review needs localization if it isn't already English and hasn't been processed. */
  private isCandidate(r: { text: string; lang: string | null; textEn: string | null }): boolean {
    if (r.textEn) return false;                 // already localized
    if (r.lang && r.lang !== 'en') return true; // tagged non-English
    return NON_LATIN.test(r.text || '');        // non-Latin script slipped through as en/null
  }

  async localizeReview(id: string): Promise<'translated' | 'english' | 'skip'> {
    const r = await this.prisma.review.findUnique({ where: { id }, select: { id: true, text: true, lang: true, textEn: true } });
    if (!r || !this.isCandidate(r)) return 'skip';
    const d = await this.ai.localizeReview(r.text);
    if (!d?.lang) throw new Error('no lang');
    if (d.isEnglish) {
      await this.prisma.review.update({ where: { id }, data: { lang: 'en', textEn: null } });
      return 'english';
    }
    // Use the reconstructed native script only when it's genuinely non-Latin; else keep original.
    const native = d.native && NON_LATIN.test(d.native) ? d.native.slice(0, 5000) : r.text;
    await this.prisma.review.update({
      where: { id },
      data: { lang: d.lang, textEn: (d.english || '').slice(0, 6000), text: native },
    });
    return 'translated';
  }

  /** Localize all not-yet-processed reviews for one hospital (used by the scrape pipeline). */
  async localizeHospital(hospitalId: string): Promise<{ translated: number; english: number }> {
    const rows = await this.prisma.review.findMany({
      where: { hospitalId },
      select: { id: true, text: true, lang: true, textEn: true },
    });
    let translated = 0, english = 0;
    for (const r of rows) {
      if (!this.isCandidate(r)) continue;
      try {
        const res = await this.localizeReview(r.id);
        if (res === 'translated') translated++;
        else if (res === 'english') english++;
      } catch (e: any) {
        this.logger.warn(`localize failed for review ${r.id}: ${e.message}`);
      }
      await new Promise((res) => setTimeout(res, 120));
    }
    return { translated, english };
  }

  /** Bulk localize every not-yet-processed review across the DB (admin endpoint). */
  async localizeAll(opts: { limit?: number } = {}) {
    const rows = await this.prisma.review.findMany({ select: { id: true, text: true, lang: true, textEn: true } });
    const candidates = rows.filter((r) => this.isCandidate(r)).slice(0, opts.limit ?? rows.length);
    this.logger.log(`Localizing ${candidates.length} reviews`);
    let translated = 0, english = 0, failed = 0;
    for (const r of candidates) {
      try {
        const res = await this.localizeReview(r.id);
        if (res === 'translated') translated++; else if (res === 'english') english++;
      } catch (e: any) { failed++; this.logger.warn(`localize failed ${r.id}: ${e.message}`); }
      await new Promise((res) => setTimeout(res, 120));
    }
    this.logger.log(`Localize done: translated=${translated} english=${english} failed=${failed}`);
    return { total: candidates.length, translated, english, failed };
  }
}
