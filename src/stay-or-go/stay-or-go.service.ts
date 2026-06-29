import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';

@Injectable()
export class StayOrGoService {
  constructor(private prisma: PrismaService, private ai: AiService) {}

  /**
   * Normalise any stored/generated result into the nested shape the frontend
   * consumes: { home, abroad, timeline, recommendation, recommendationReason }.
   * Seeded/cached templates use a FLAT column layout (homeCost, indiaCost, …);
   * the AI path already returns the nested shape. We unify both here so the
   * StayOrGo page never receives an undefined `home`/`abroad` (which crashed it).
   */
  private toClientShape(raw: any) {
    if (!raw) return raw;
    // Already nested (AI path) — pass through.
    if (raw.home && raw.abroad) return raw;

    const asList = (v: any): string[] =>
      Array.isArray(v) ? v.filter(Boolean) : v ? [String(v)] : [];

    return {
      home: {
        country: raw.homeCountry,
        waitTime: raw.homeWaitTime,
        cost: raw.homeCost,
        successRate: raw.homeSuccessRate,
        accredited: raw.homeQuality,
        risks: asList(raw.homeRisk),
      },
      abroad: {
        waitTime: raw.indiaWaitTime,
        cost: raw.indiaCost,
        successRate: raw.indiaSuccessRate,
        accredited: raw.indiaQuality,
        benefits: asList(raw.summary),
      },
      timeline: Array.isArray(raw.riskTimeline) ? raw.riskTimeline : [],
      recommendation: raw.recommendation,
      recommendationReason: raw.reasoning,
      source: raw.source ?? 'template',
    };
  }

  async analyze(params: { diagnosis: string; country: string; treatment: string; urgency: string }) {
    // Try template first — no AI cost
    const template = await this.prisma.stayOrGoTemplate.findFirst({
      where: {
        procedure: { contains: params.treatment, mode: 'insensitive' },
        homeCountry: { contains: params.country, mode: 'insensitive' },
      },
    });

    if (template) {
      return this.toClientShape({ ...template, source: 'template' });
    }

    // Fallback: AI generates the nested shape and we cache it as a new template.
    const aiResult = await this.ai.generateStayOrGo(params);

    // Cache to DB so the next user with the same combo gets a template hit.
    // aiResult is NESTED, so read from aiResult.home.* / aiResult.abroad.*.
    try {
      await this.prisma.stayOrGoTemplate.create({
        data: {
          procedure: params.treatment,
          homeCountry: params.country,
          homeCost: aiResult.home?.cost ?? '',
          homeWaitTime: aiResult.home?.waitTime ?? '',
          homeSuccessRate: aiResult.home?.successRate ?? '',
          homeRisk: (aiResult.home?.risks ?? []).join('; '),
          homeQuality: aiResult.home?.accredited ?? 'Variable',
          indiaCost: aiResult.abroad?.cost ?? '',
          indiaWaitTime: aiResult.abroad?.waitTime ?? '',
          indiaSuccessRate: aiResult.abroad?.successRate ?? '',
          indiaRisk: 'Low',
          indiaQuality: aiResult.abroad?.accredited ?? 'World-class',
          recommendation: aiResult.recommendation ?? 'go',
          reasoning: aiResult.recommendationReason ?? '',
          summary: aiResult.abroad?.benefits ?? [],
          riskTimeline: aiResult.timeline ?? [],
        },
      });
    } catch {
      // Ignore cache write errors
    }

    return this.toClientShape({ ...aiResult, source: 'ai' });
  }
}
