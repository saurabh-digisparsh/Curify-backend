import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AiService } from '../ai/ai.service';

// AI calls are the most expensive thing this public endpoint can trigger —
// throttle tighter than the global default (per-IP: 10 messages/minute).
const CHAT_THROTTLE = { default: { ttl: 60_000, limit: 10 } };
// UI translation arrives as a series of small chunk requests (~6 per language),
// each cached client-side — allow a full language + retries per window.
const TRANSLATE_THROTTLE = { default: { ttl: 300_000, limit: 30 } };

@ApiTags('Assistant')
@Controller('assistant')
export class AssistantController {
  constructor(private ai: AiService) {}

  @ApiOperation({ summary: 'Patient AI assistant chat (pre-signup, stateless — nothing persisted)' })
  @Throttle(CHAT_THROTTLE)
  @Post('chat')
  chat(
    @Body() body: { messages?: { role: 'user' | 'assistant'; content: string }[]; language?: string },
  ) {
    return this.ai.assistantChat({
      messages: Array.isArray(body?.messages) ? body.messages : [],
      language: typeof body?.language === 'string' ? body.language.slice(0, 10) : undefined,
    });
  }

  @ApiOperation({ summary: 'Transient description-only analysis for the chat patient flow (no file, nothing persisted)' })
  @Throttle(CHAT_THROTTLE)
  @Post('analyze')
  analyze(
    @Body() body: { description?: string; treatment?: string; country?: string; urgency?: string },
  ) {
    // Description-only by design: file uploads carry PHI that must be stored under
    // an authenticated owner — those go through the guarded /upload route. This
    // endpoint keeps the pre-signup chat flowing and persists NOTHING.
    const description = String(body?.description || '').trim().slice(0, 4000);
    if (description.length < 10) throw new BadRequestException('description too short');
    return this.ai.analyzeReport({
      description,
      treatment: typeof body?.treatment === 'string' ? body.treatment.slice(0, 100) : undefined,
      country: typeof body?.country === 'string' ? body.country.slice(0, 100) : undefined,
      urgency: typeof body?.urgency === 'string' ? body.urgency.slice(0, 50) : undefined,
    });
  }

  @ApiOperation({ summary: 'AI-translate the UI string catalog into a target language (cached client-side)' })
  @Throttle(TRANSLATE_THROTTLE)
  @Post('translate-ui')
  translateUi(@Body() body: { language?: string; strings?: Record<string, string> }) {
    const language = String(body?.language || '').toLowerCase();
    if (!/^[a-z]{2,3}$/.test(language)) throw new BadRequestException('Invalid language code');
    if (!body?.strings || typeof body.strings !== 'object' || Array.isArray(body.strings)) {
      throw new BadRequestException('strings must be an object');
    }
    if (JSON.stringify(body.strings).length > 20_000) throw new BadRequestException('Catalog too large');
    return this.ai.translateUi({ language, strings: body.strings });
  }
}
