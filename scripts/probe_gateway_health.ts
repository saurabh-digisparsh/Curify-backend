/**
 * Is the Ollama gateway healthy, and if not, what input breaks it?
 * Sends progressively longer TEXT-ONLY prompts (no images) to the primary model.
 *
 *   npx ts-node scripts/probe_gateway_health.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';

for (const line of fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'ollama',
  baseURL: process.env.AI_BASE_URL,
  timeout: 120_000,
  maxRetries: 0,
  ...(process.env.AI_BASIC_AUTH ? { defaultHeaders: { Authorization: `Basic ${process.env.AI_BASIC_AUTH}` } } : {}),
});
const MODEL = process.env.AI_MODEL || 'qwen2.5vl:7b';

async function attempt(label: string, content: string, json = false) {
  const t = Date.now();
  try {
    const res = await client.chat.completions.create({
      model: MODEL, temperature: 0, max_tokens: 200,
      ...(json ? { response_format: { type: 'json_object' as const } } : {}),
      messages: [{ role: 'user', content }],
    } as any);
    const out = (res.choices[0].message.content || '').replace(/\s+/g, ' ').slice(0, 70);
    console.log(`✅ ${label.padEnd(34)} ${String(Date.now() - t).padStart(6)} ms  → ${out}`);
    return true;
  } catch (e: any) {
    console.log(`❌ ${label.padEnd(34)} ${String(Date.now() - t).padStart(6)} ms  → ${e.message.replace(/\s+/g, ' ').slice(0, 110)}`);
    return false;
  }
}

async function main() {
  console.log(`gateway: ${process.env.AI_BASE_URL}   model: ${MODEL}\n`);
  await attempt('tiny prompt', 'Say OK.');
  await attempt('tiny prompt, json mode', 'Return {"ok":true} as JSON.', true);
  for (const n of [500, 1500, 3000, 5000, 6000]) {
    // Realistic filler: repeated clinical text, not random noise.
    const body = 'Proximal LAD has 95% stenosis. Mid LAD has 95% stenosis. RCA dominant. '.repeat(Math.ceil(n / 70)).slice(0, n);
    await attempt(`text ${n} chars`, `Summarise in one line:\n${body}`);
  }
  await attempt('text 5000 chars, json mode', `Return {"summary":"..."} for:\n${'LAD 95% stenosis. '.repeat(280)}`, true);
}

main().catch((e) => { console.error(e); process.exit(1); });
