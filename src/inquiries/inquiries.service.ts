import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertInquiryDto } from './dto/upsert-inquiry.dto';

@Injectable()
export class InquiriesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Upsert an anonymous chat lead by email (identity + funnel metadata only — no
   * PHI). Called repeatedly as the chat progresses, so a partial update never
   * nulls-out fields captured on an earlier turn.
   * (`prisma as any`: the `inquiry` delegate lands in the generated client only
   * after `prisma generate` runs with the migration this ships with.)
   */
  async upsert(dto: UpsertInquiryDto) {
    const email = dto.email.toLowerCase();
    const { email: _e, travelDate, ...rest } = dto;
    const data = this.definedOnly(rest);
    if (travelDate) {
      const d = new Date(travelDate);
      if (!Number.isNaN(d.getTime())) data.travelDate = d;
    }
    const inq = await (this.prisma as any).inquiry.upsert({
      where: { email },
      update: data,
      create: { email, ...data },
      select: { id: true },
    });
    return { ok: true, id: inq.id };
  }

  /** Mark a lead CONVERTED + link it to the new user (called from signup). */
  async markConverted(email: string, userId: string) {
    await (this.prisma as any).inquiry.updateMany({
      where: { email: email.toLowerCase(), status: 'NEW' },
      data: { status: 'CONVERTED', userId, convertedAt: new Date() },
    });
  }

  /** Drop undefined/empty so a partial upsert doesn't overwrite earlier answers. */
  private definedOnly(obj: Record<string, any>) {
    const out: any = {};
    for (const [k, v] of Object.entries(obj)) if (v !== undefined && v !== '') out[k] = v;
    return out;
  }
}
