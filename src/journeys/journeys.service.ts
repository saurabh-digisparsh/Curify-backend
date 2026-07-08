import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { deriveUrgent } from '../common/travel';

/** Fields a client may set — everything else (id, userId, timestamps) is server-owned. */
const WRITABLE = [
  'title', 'status', 'treatment', 'city', 'urgency', 'homeCountry', 'description',
  'travelDate', 'step', 'reportId', 'analysis', 'stayOrGo', 'hospitalId', 'tripPlan',
] as const;
type Writable = Partial<Record<(typeof WRITABLE)[number], any>>;

type ChatSender = 'PATIENT' | 'HOSPITAL' | 'SYSTEM';
type ChatKind = 'TEXT' | 'REPORT' | 'QUOTE_REQUEST' | 'QUOTE';
export interface ChatMsg { id: string; sender: ChatSender; kind: ChatKind; body: string; reportId?: string; amountUsd?: number; at: string }

@Injectable()
export class JourneysService {
  constructor(private prisma: PrismaService, private ai: AiService) {}

  // ── Hospital chat (patient ↔ Curify staff on the hospital's behalf) ──
  private getMessages(j: any): ChatMsg[] {
    return (j?.hospitalChat?.messages as ChatMsg[]) ?? [];
  }
  private newMsg(p: Partial<ChatMsg> & { sender: ChatSender; body: string }): ChatMsg {
    return { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, at: new Date().toISOString(), kind: 'TEXT', ...p };
  }
  private async appendMessage(id: string, current: ChatMsg[], msg: ChatMsg) {
    const messages = [...current, msg];
    // Cast the whole payload: `hospitalChat` may not be in the generated client
    // types until `prisma generate` runs (matches the migration this ships with).
    await this.prisma.journey.update({ where: { id }, data: { hospitalChat: { messages } } as any });
    return messages;
  }

  /** Patient reads their chat with the selected hospital. */
  async getChat(userId: string, id: string) {
    const j = await this.get(userId, id); // ownership check
    return { messages: this.getMessages(j), hospitalId: j.hospitalId };
  }

  /** Patient posts a message / shares a report / requests a quote. */
  async addPatientMessage(userId: string, id: string, dto: { body?: string; kind?: ChatKind; reportId?: string }) {
    const j = await this.get(userId, id);
    const kind: ChatKind = dto.kind || 'TEXT';
    let body = (dto.body || '').trim();
    if (kind === 'QUOTE_REQUEST' && !body) body = 'I would like a detailed all-inclusive price quotation for my treatment, please.';
    if (kind === 'REPORT' && !body) body = 'Shared my medical report for your review.';
    if (!body) throw new BadRequestException('Message cannot be empty');
    const msg = this.newMsg({ sender: 'PATIENT', kind, body, ...(dto.reportId ? { reportId: dto.reportId } : {}) });
    return { messages: await this.appendMessage(id, this.getMessages(j), msg) };
  }

  /** Curify staff (admin) replies on the hospital's behalf; may post a quote. */
  async addHospitalMessage(id: string, dto: { body?: string; kind?: ChatKind; amountUsd?: number }) {
    const j = await this.prisma.journey.findUnique({ where: { id } });
    if (!j) throw new NotFoundException('Journey not found');
    const kind: ChatKind = dto.kind || 'TEXT';
    let body = (dto.body || '').trim();
    if (kind === 'QUOTE' && !body && dto.amountUsd) body = `Here is your all-inclusive quotation: $${dto.amountUsd.toLocaleString()}.`;
    if (!body) throw new BadRequestException('Message cannot be empty');
    const msg = this.newMsg({ sender: 'HOSPITAL', kind, body, ...(dto.amountUsd != null ? { amountUsd: dto.amountUsd } : {}) });
    return { messages: await this.appendMessage(id, this.getMessages(j as any), msg) };
  }

  /** Admin inbox: every journey that has a chat, newest first. */
  async listChats() {
    const journeys = await this.prisma.journey.findMany({
      orderBy: { updatedAt: 'desc' }, take: 200,
      include: { user: { select: { name: true, email: true } } },
    });
    const withChat = journeys.filter((j) => this.getMessages(j as any).length > 0);
    const hids = [...new Set(withChat.map((j) => j.hospitalId).filter(Boolean))] as string[];
    const hospitals = hids.length ? await this.prisma.hospital.findMany({ where: { id: { in: hids } }, select: { id: true, name: true } }) : [];
    const hmap = new Map(hospitals.map((h) => [h.id, h.name]));
    return withChat.map((j) => {
      const msgs = this.getMessages(j as any);
      const last = msgs[msgs.length - 1];
      return {
        journeyId: j.id,
        patient: (j as any).user?.name || (j as any).user?.email || 'Patient',
        hospital: j.hospitalId ? (hmap.get(j.hospitalId) || 'Hospital') : 'Hospital',
        treatment: j.treatment,
        messageCount: msgs.length,
        lastMessage: last?.body || '',
        lastAt: last?.at || j.updatedAt.toISOString(),
        awaitingReply: last?.sender === 'PATIENT',
      };
    });
  }

  /** Admin reads one chat's full transcript (no ownership scope — staff). */
  async getChatForStaff(id: string) {
    const j = await this.prisma.journey.findUnique({ where: { id }, include: { user: { select: { name: true, email: true } } } });
    if (!j) throw new NotFoundException('Journey not found');
    return { messages: this.getMessages(j as any), patient: (j as any).user?.name || (j as any).user?.email, treatment: j.treatment };
  }

  /** AI reads the whole transcript and folds any agreed quote into the trip plan. */
  async analyzeChat(userId: string, id: string) {
    const j = await this.get(userId, id);
    const msgs = this.getMessages(j);
    if (msgs.length === 0) throw new BadRequestException('There is no chat to analyze yet.');
    const transcript = msgs.map((m) => `${m.sender}: ${m.body}${m.amountUsd ? ` [quote $${m.amountUsd}]` : ''}`).join('\n');
    const result = await this.ai.analyzeHospitalChat({ transcript, treatment: j.treatment || '' });

    const tp: any = (j.tripPlan as any) || {};
    if (result?.agreedQuoteUsd) {
      tp.costs = { ...(tp.costs || {}), surgery: { item: 'Surgery (agreed with hospital)', amount: result.agreedQuoteUsd, note: 'Quoted in hospital chat' } };
      tp.totalEstimate = Object.values(tp.costs).reduce((s: number, c: any) => s + (Number(c.amount) || 0), 0);
      tp.chatSummary = result.summary;
      await this.prisma.journey.update({ where: { id }, data: { tripPlan: tp as any } });
    }
    return { summary: result?.summary || '', agreedQuoteUsd: result?.agreedQuoteUsd || null, inclusions: result?.inclusions || [], tripPlan: tp };
  }

  private pick(body: Writable) {
    const data: any = {};
    for (const k of WRITABLE) if (body[k] !== undefined) data[k] = body[k];
    // travelDate is client-set; `urgent` is DERIVED here and never trusted from the
    // client. Coerce the ISO string to a Date; drop an unparseable value silently.
    if (data.travelDate != null) {
      const d = new Date(data.travelDate);
      if (Number.isNaN(d.getTime())) delete data.travelDate;
      else { data.travelDate = d; data.urgent = deriveUrgent(d); }
    }
    return data;
  }

  async list(userId: string, opts?: { page?: number; pageSize?: number }) {
    // No pagination requested → full list (sidebar count, journey lookup).
    if (!opts) {
      return this.prisma.journey.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' } });
    }
    const page = Math.max(1, Number(opts.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(opts.pageSize) || 10));
    const where = { userId };
    const [total, journeys] = await Promise.all([
      this.prisma.journey.count({ where }),
      this.prisma.journey.findMany({
        where, orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize, take: pageSize,
      }),
    ]);
    return { journeys, total, page, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async get(userId: string, id: string) {
    // Ownership enforced by scoping the query to the caller — no cross-user reads.
    const journey = await this.prisma.journey.findFirst({ where: { id, userId } });
    if (!journey) throw new NotFoundException('Journey not found');
    return journey;
  }

  create(userId: string, body: Writable) {
    return this.prisma.journey.create({ data: { userId, ...this.pick(body) } });
  }

  async update(userId: string, id: string, body: Writable) {
    await this.get(userId, id); // ownership check
    return this.prisma.journey.update({ where: { id }, data: this.pick(body) });
  }

  /**
   * PUBLIC tracking payload for a shared journey link (no auth). Returns ONLY a
   * curated, low-sensitivity subset — the travel itinerary + status — never the
   * medical report/analysis. The cuid id acts as an unlisted share token.
   */
  async publicTracking(id: string) {
    const j = await this.prisma.journey.findUnique({ where: { id } });
    if (!j) throw new NotFoundException('Journey not found');
    const tp: any = j.tripPlan || {};
    const ti = tp.travelInfo || {};
    let hospital: { name: string; city: string; intlOfficePhone: string | null; intlOfficeEmail: string | null } | null = null;
    if (j.hospitalId) {
      hospital = await this.prisma.hospital.findUnique({
        where: { id: j.hospitalId },
        select: { name: true, city: true, intlOfficePhone: true, intlOfficeEmail: true },
      });
    }
    return {
      treatment: j.treatment,
      procedure: (j.analysis as any)?.diagnosis?.condition || j.treatment || null,
      homeCountry: j.homeCountry,
      departureCity: ti.departureCity ?? null,
      travelDate: ti.travelDate ?? null,
      hospitalName: hospital?.name ?? null,
      hospitalCity: hospital?.city ?? tp.city ?? null,
      hospitalPhone: hospital?.intlOfficePhone ?? null,
      hospitalEmail: hospital?.intlOfficeEmail ?? null,
      step: j.step,
      status: j.status,
    };
  }

  /** Delete a journey. Ownership enforced via get() (scoped to the caller). */
  async remove(userId: string, id: string) {
    await this.get(userId, id); // ownership check — 404s if not the caller's
    await this.prisma.journey.delete({ where: { id } });
    return { ok: true };
  }
}
