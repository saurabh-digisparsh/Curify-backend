import { Injectable, BadRequestException } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { PrismaService } from '../prisma/prisma.service';
import { EnrichmentService } from './enrichment.service';

/** Columns the admin can provide; everything else is filled by AI after import. */
export const TEMPLATE_FIELDS = ['name', 'city', 'country', 'address', 'website', 'phone', 'specialty'] as const;

interface RawRow { [k: string]: any }
export interface PreviewRow {
  name: string; city: string; country?: string; address?: string; website?: string; phone?: string; specialty?: string;
  valid: boolean; reason: string;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);
const norm = (s: string) => (s || '').toLowerCase().replace(/\b(hospital|hospitals|clinic|centre|center|pvt|ltd|the)\b/g, '').replace(/[^a-z0-9]/g, '').trim();
const cityKey = (s: string) => (s || '').toLowerCase().replace(/bengaluru/, 'bangalore').replace(/[^a-z]/g, '').trim();

@Injectable()
export class FileImportService {
  constructor(private prisma: PrismaService, private enrichment: EnrichmentService) {}

  /** Parse an uploaded CSV or JSON file into raw rows. */
  parse(file: Express.Multer.File): RawRow[] {
    const text = (file?.buffer ?? Buffer.from('')).toString('utf8').trim();
    if (!text) throw new BadRequestException('Empty file');
    const isJson = file.originalname?.toLowerCase().endsWith('.json') || (file.mimetype || '').includes('json') || text.startsWith('[') || text.startsWith('{');
    try {
      if (isJson) {
        const j = JSON.parse(text);
        const arr = Array.isArray(j) ? j : (j.hospitals ?? j.data ?? []);
        if (!Array.isArray(arr)) throw new Error('JSON must be an array of hospitals');
        return arr;
      }
      return parse(text, { columns: true, skip_empty_lines: true, trim: true, bom: true });
    } catch (e: any) {
      throw new BadRequestException(`Could not parse file: ${e.message}`);
    }
  }

  /** Validate rows (name + city required). No DB writes — a dry-run preview. */
  validate(rows: RawRow[]): { rows: PreviewRow[]; valid: number; invalid: number } {
    const out = rows.map((r) => {
      const name = String(r.name ?? '').trim();
      const city = String(r.city ?? '').trim();
      const ok = !!name && !!city;
      return {
        name, city,
        country: r.country ? String(r.country).trim() : undefined,
        address: r.address ? String(r.address).trim() : undefined,
        website: r.website ? String(r.website).trim() : undefined,
        phone: r.phone ? String(r.phone).trim() : undefined,
        specialty: r.specialty ? String(r.specialty).trim() : undefined,
        valid: ok,
        reason: ok ? '' : 'Missing required field (name and city)',
      } as PreviewRow;
    });
    return { rows: out, valid: out.filter((r) => r.valid).length, invalid: out.filter((r) => !r.valid).length };
  }

  /**
   * Commit valid rows: dedup (update existing, else create), then kick off AI enrichment
   * in the background to fill all the missing details. Returns a fast summary.
   */
  async commit(rows: PreviewRow[]) {
    const existing = await this.prisma.hospital.findMany({ select: { id: true, name: true, city: true } });
    let created = 0, updated = 0, skipped = 0;
    const dropped: { name: string; city: string; reason: string }[] = [];

    for (const r of rows) {
      const name = String(r.name ?? '').trim();
      const city = String(r.city ?? '').trim();
      if (!name || !city) { dropped.push({ name, city, reason: 'Missing name/city' }); skipped++; continue; }

      const data: Record<string, any> = {
        name, city,
        country: r.country || 'India',
        address: r.address || undefined,
        website: r.website || undefined,
        intlOfficePhone: r.phone || undefined,
        specialty: r.specialty || undefined,
      };

      const match = existing.find((h) => norm(h.name) === norm(name) && cityKey(h.city) === cityKey(city));
      if (match) {
        await this.prisma.hospital.update({ where: { id: match.id }, data: data as any });
        updated++;
      } else {
        const id = `file-${slug(`${name}-${city}`)}`;
        await this.prisma.hospital.upsert({ where: { id }, create: { id, ...data } as any, update: data as any });
        created++;
      }
    }

    // AI fills the rest (price, surgeon, pros/cons, procedures…) for any hospital missing a price.
    this.enrichment.enrichMissing().catch(() => { /* logged in service */ });

    return { created, updated, skipped, dropped, enrichStarted: true };
  }
}
