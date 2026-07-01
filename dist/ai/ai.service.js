"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiService = void 0;
const common_1 = require("@nestjs/common");
const openai_1 = require("openai");
let AiService = class AiService {
    constructor() {
        const baseURL = process.env.AI_BASE_URL;
        const basicAuth = process.env.AI_BASIC_AUTH;
        const key = process.env.OPENAI_API_KEY;
        const hasOpenAiKey = !!key && key !== 'your_openai_api_key_here';
        if (baseURL) {
            this.primary = {
                client: new openai_1.default({
                    apiKey: key || 'ollama',
                    baseURL,
                    ...(basicAuth ? { defaultHeaders: { Authorization: `Basic ${basicAuth}` } } : {}),
                }),
                model: process.env.AI_MODEL || 'qwen2.5vl:7b',
                label: `ollama:${baseURL}`,
            };
            this.fallback = hasOpenAiKey
                ? { client: new openai_1.default({ apiKey: key }), model: process.env.AI_FALLBACK_MODEL || 'gpt-4.1-mini', label: 'openai' }
                : null;
            if (!this.fallback) {
                console.warn('⚠️  Ollama gateway configured but no OPENAI_API_KEY — running without an AI fallback');
            }
        }
        else {
            if (!hasOpenAiKey) {
                console.warn('⚠️  No AI provider configured (set AI_BASE_URL for an OpenAI-compatible endpoint, or OPENAI_API_KEY) — AI features will fail at runtime');
            }
            this.primary = { client: new openai_1.default({ apiKey: key || 'missing' }), model: process.env.AI_MODEL || 'gpt-4.1-mini', label: 'openai' };
            this.fallback = null;
        }
        console.log(`🤖 AI provider: ${this.primary.label} (model ${this.primary.model})` +
            (this.fallback ? ` · fallback: ${this.fallback.label} (model ${this.fallback.model})` : ' · no fallback'));
    }
    async chat(messages, maxTokens = 1500, mockFallback) {
        const providers = this.fallback ? [this.primary, this.fallback] : [this.primary];
        let lastErr;
        for (let i = 0; i < providers.length; i++) {
            const p = providers[i];
            try {
                const res = await p.client.chat.completions.create({
                    model: p.model,
                    messages,
                    max_tokens: maxTokens,
                    temperature: 0.3,
                    response_format: { type: 'json_object' },
                });
                const text = res.choices[0].message.content?.trim() ?? '{}';
                return JSON.parse(text);
            }
            catch (err) {
                lastErr = err;
                const more = i < providers.length - 1;
                console.warn(`⚠️  AI call via ${p.label} failed (${err.message})${more ? ` — falling back to ${providers[i + 1].label}` : ''}`);
            }
        }
        if (mockFallback) {
            console.warn('⚠️  All AI providers failed — using mock data');
            return mockFallback();
        }
        throw new Error(`AI call failed: ${lastErr?.message}`);
    }
    async analyzeReport(params) {
        const userContent = [];
        if (params.fileBase64 && params.fileType?.startsWith('image/')) {
            userContent.push({
                type: 'image_url',
                image_url: { url: `data:${params.fileType};base64,${params.fileBase64}` },
            });
        }
        let contextText = 'Analyze this medical report and extract structured data. Base every field strictly on the report content below — do not invent a condition from the treatment hint.';
        if (params.reportText) {
            contextText += `\n\n--- MEDICAL REPORT TEXT (extracted from the uploaded file) ---\n${params.reportText}\n--- END OF REPORT ---`;
        }
        if (params.description)
            contextText += `\n\nPatient description: "${params.description}"`;
        if (params.treatment)
            contextText += `\nTreatment category hint (may be unrelated to the report): ${params.treatment}`;
        if (params.country)
            contextText += `\nPreferred destination: ${params.country}`;
        if (params.urgency)
            contextText += `\nUrgency: ${params.urgency}`;
        if (!params.fileBase64 && !params.reportText) {
            contextText += '\n\nNo file uploaded. Generate a realistic analysis from the description provided.';
        }
        userContent.push({ type: 'text', text: contextText });
        const now = new Date();
        const mockFallback = () => this.mockAnalysis(params);
        return this.chat([
            {
                role: 'system',
                content: `You are Curify's AI medical analyst. Extract structured data from medical reports.
Respond with valid JSON only matching this schema exactly:
{
  "reportId": "RPT-YYYY-NNN",
  "language": "detected language",
  "confidence": 0-100,
  "diagnosis": {
    "condition": "full condition name",
    "medical": "detailed medical description",
    "plain": "2-3 sentence patient-friendly explanation",
    "severity": "Low|Moderate|Moderate-High|High|Critical"
  },
  "flags": [{ "type": "warning|success|alert|info", "icon": "emoji", "text": "flag text" }],
  "extractedData": {
    "patientAge": null,
    "patientName": null,
    "patientCountry": "patient's home country if stated in the report, else null",
    "scanType": "type of scan or test performed",
    "scanDate": "YYYY-MM-DD or null",
    "referringDoctor": null
  }
}
Generate 3-5 clinically relevant flags with at least one warning and one info.
Set patientCountry only if the report explicitly mentions the patient's country/nationality/address; otherwise null.`,
            },
            { role: 'user', content: userContent },
        ], 1500, mockFallback);
    }
    mockAnalysis(params) {
        const isFever = params.description?.toLowerCase().includes('fever') || params.description?.toLowerCase().includes('temperature');
        const isOrtho = params.treatment === 'orthopedic' || params.description?.toLowerCase().includes('acl') || params.description?.toLowerCase().includes('knee');
        if (isFever) {
            return {
                reportId: `RPT-2026-${Math.floor(100 + Math.random() * 900)}`,
                language: 'English',
                confidence: 92,
                diagnosis: {
                    condition: 'Dengue Fever (Breakbone Fever)',
                    medical: 'Acute viral infection caused by Dengue virus (DENV), transmitted by Aedes mosquitoes. Presents with high-grade fever (≥38.5°C), severe myalgia, arthralgia, retro-orbital pain, and potential hemorrhagic complications. CBC may show thrombocytopenia and leukopenia.',
                    plain: 'You have dengue fever, a mosquito-borne viral illness causing high fever and body pain. Most cases resolve within 7–10 days with proper rest and hydration, but platelet levels should be monitored closely to rule out severe dengue.',
                    severity: 'Moderate',
                },
                flags: [
                    { type: 'warning', icon: '🩸', text: 'Monitor platelet count every 24–48 hours — dengue can cause dangerous drops' },
                    { type: 'alert', icon: '🌡️', text: 'Temperature ≥104°F for 5 days — fever persistence beyond 7 days warrants re-evaluation' },
                    { type: 'info', icon: '💧', text: 'Maintain oral hydration: 2–3 litres/day to prevent dehydration and shock' },
                    { type: 'warning', icon: '⚠️', text: 'Avoid NSAIDs (ibuprofen/aspirin) — increased bleeding risk; use paracetamol only' },
                    { type: 'success', icon: '✅', text: 'No signs of severe dengue (no abdominal pain, no persistent vomiting, no bleeding) reported' },
                ],
                extractedData: {
                    patientAge: null,
                    patientName: null,
                    patientCountry: null,
                    scanType: 'Blood Panel / CBC Report',
                    scanDate: new Date().toISOString().split('T')[0],
                    referringDoctor: null,
                },
            };
        }
        if (isOrtho) {
            return {
                reportId: `RPT-2026-${Math.floor(100 + Math.random() * 900)}`,
                language: 'English',
                confidence: 95,
                diagnosis: {
                    condition: 'ACL Tear — Grade III (Complete Rupture)',
                    medical: 'Complete disruption of the anterior cruciate ligament with associated joint instability. MRI findings consistent with full-thickness tear at the mid-substance. Possible bone bruising on lateral femoral condyle and tibial plateau.',
                    plain: 'You have a complete tear of the ACL — the main stabilising ligament in your knee. Surgical reconstruction is typically recommended for active patients, with excellent outcomes (90%+ return to sport). Without surgery, the knee remains unstable and risks further cartilage damage.',
                    severity: 'Moderate-High',
                },
                flags: [
                    { type: 'warning', icon: '🦴', text: 'Grade III complete tear — non-surgical management not recommended for active adults' },
                    { type: 'info', icon: '⏱️', text: 'Optimal surgery window: 6–8 weeks post-injury to allow swelling to reduce' },
                    { type: 'success', icon: '✅', text: '90%+ return-to-sport rate with arthroscopic ACL reconstruction at JCI centres' },
                    { type: 'warning', icon: '⚠️', text: 'Delay beyond 3 months increases risk of secondary meniscal damage' },
                ],
                extractedData: {
                    patientAge: 42,
                    patientName: null,
                    patientCountry: null,
                    scanType: 'MRI — Right Knee',
                    scanDate: new Date().toISOString().split('T')[0],
                    referringDoctor: null,
                },
            };
        }
        return {
            reportId: `RPT-2026-${Math.floor(100 + Math.random() * 900)}`,
            language: 'English',
            confidence: 88,
            diagnosis: {
                condition: 'Medical Condition Requiring Specialist Review',
                medical: 'Report reviewed by Curify AI. Detailed specialist assessment recommended for accurate diagnosis and treatment planning.',
                plain: 'Based on your report, our AI has flagged findings that require specialist review. We recommend consulting with one of our partner hospitals for a comprehensive evaluation.',
                severity: 'Moderate',
            },
            flags: [
                { type: 'info', icon: '🏥', text: 'Specialist consultation recommended at a JCI-accredited centre' },
                { type: 'warning', icon: '⚠️', text: 'Report flagged for detailed clinical review before treatment planning' },
                { type: 'success', icon: '✅', text: 'Our hospital partners can provide same-week specialist consultations' },
            ],
            extractedData: {
                patientAge: null,
                patientName: null,
                scanType: 'Medical Report',
                scanDate: new Date().toISOString().split('T')[0],
                referringDoctor: null,
            },
        };
    }
    async generateStayOrGo(params) {
        return this.chat([
            {
                role: 'system',
                content: `You are Curify's medical tourism advisor. Compare treatment at home vs abroad (India).
Respond with valid JSON matching this schema exactly:
{
  "home": {
    "country": "country name",
    "waitTime": "estimate",
    "cost": "USD range",
    "successRate": "percentage",
    "accredited": "number of JCI hospitals",
    "risks": ["risk1", "risk2", "risk3", "risk4"]
  },
  "abroad": {
    "waitTime": "estimate",
    "cost": "USD range",
    "successRate": "percentage",
    "accredited": "matched hospitals description",
    "benefits": ["benefit1", "benefit2", "benefit3", "benefit4"]
  },
  "timeline": [
    { "month": 0, "risk": 10, "label": "Diagnosis" },
    { "month": 1, "risk": 20, "label": "Month 1" },
    { "month": 3, "risk": 40, "label": "Month 3" },
    { "month": 6, "risk": 65, "label": "Month 6" },
    { "month": 12, "risk": 85, "label": "Month 12" }
  ],
  "recommendation": "stay|go",
  "recommendationReason": "1-2 sentence explanation"
}`,
            },
            {
                role: 'user',
                content: `Patient from: ${params.country || 'Nigeria'}
Diagnosis: ${params.diagnosis}
Treatment: ${params.treatment}
Urgency: ${params.urgency}
Analyze whether patient should treat at home or travel to India.`,
            },
        ], 1200);
    }
    async localizeReview(text) {
        return this.chat([
            {
                role: 'system',
                content: `You process a single patient review. The text may be plain English, a non-English language, OR a romanized (Latin-letter) transliteration of a non-English language. Do ALL of:
1. Detect the original language (ISO 639-1 code), based ONLY on the text.
2. Translate it to natural English.
3. Produce the text in the language's NATIVE script. For non-Latin-script languages (Arabic, Russian, Persian, Urdu, Bengali, Japanese, Chinese, Korean, Hindi, Tamil, Telugu, Kannada, Amharic, etc.) reconstruct the proper native script matching the meaning. For English or Latin-script languages, set native = the original text unchanged.
Respond ONLY as JSON: {"lang":"ISO code","isEnglish":true|false,"english":"...","native":"..."}.`,
            },
            { role: 'user', content: text.slice(0, 4000) },
        ], 1500);
    }
    async classifyLeads(candidates) {
        if (!candidates.length)
            return {};
        const list = candidates
            .map((c, i) => `${i + 1}. id=${c.id}\n   title: ${c.title}\n   desc: ${(c.description || '').slice(0, 300)}`)
            .join('\n');
        const result = await this.chat([
            {
                role: 'system',
                content: `You qualify YouTube videos/Shorts as sales leads for a medical-tourism company whose hospitals are in INDIA. We ONLY want ACTIVE PROSPECTS: a real INDIVIDUAL (a patient or their family member) who has NOT yet had treatment and is PERSONALLY seeking help/advice/experiences/recommendations about getting medical care abroad — someone we could reach out to and help.
THE IDEAL LEAD (rate confidence 85-95): a first-person ASK — a normal person openly reaching out, e.g. "I'm researching medical tourism and need YOUR experience stories", "has anyone gone abroad for knee surgery?", "should I get this done overseas?", "looking for advice / recommendations", "help me decide". They have a personal need and are asking for input BEFORE going.
ALSO leads (confidence 70-85) if clearly a personal pre-treatment situation: UNDECIDED where to go · CAN'T AFFORD it at home · SUFFERING with no cure found.
NOT leads (set isLead=false):
 - ADVICE / BROADCAST content — channels, agencies, influencers, or "experts" GIVING tips/guides ("how to choose a hospital", "top destinations", "X things to know", explainers, promos). They are publishing, not personally seeking help.
 - SUCCESS STORIES / TESTIMONIALS / completed-treatment recaps ("my journey to India", "successful transplant", "patient from X comes to India", "my results", "post-op", "recovery", "before & after") → set alreadyTreated=true.
 - Hospital/clinic marketing, news, scripted drama, unrelated vlogs.
KEY TEST: is a real person ASKING for help (lead) or is someone GIVING advice / showing a finished result (not a lead)?
For EACH item return: isLead (boolean), confidence (0-100), persona ("undecided" | "cant_afford" | "suffering" | "researching" | null), alreadyTreated (boolean), procedure (condition/treatment, or null), summary (one short sentence).
Respond ONLY as JSON: {"results":[{"id":"<id>","isLead":true,"confidence":90,"persona":"researching","alreadyTreated":false,"procedure":"knee replacement","summary":"..."}]}`,
            },
            { role: 'user', content: list },
        ], 2000);
        const map = {};
        for (const r of result?.results || []) {
            if (r?.id) {
                map[r.id] = {
                    isLead: !!r.isLead,
                    confidence: Math.max(0, Math.min(100, Number(r.confidence) || 0)),
                    persona: r.persona || null,
                    alreadyTreated: !!r.alreadyTreated,
                    procedure: r.procedure || null,
                    summary: r.summary || '',
                };
            }
        }
        return map;
    }
    async classifyCategories(items) {
        if (!items.length)
            return {};
        const list = items
            .map((c, i) => {
            const text = `${c.title ? c.title + ' — ' : ''}${(c.body || '').replace(/\s+/g, ' ').slice(0, 600)}`;
            return `${i + 1}. id=${c.id}\n   platform: ${c.platform || '?'}\n   text: ${text || '(empty)'}`;
        })
            .join('\n');
        const result = await this.chat([
            {
                role: 'system',
                content: `You categorize social-media posts captured by a medical-tourism company (hospitals in INDIA, patients mostly from the USA, Middle East, and Africa). For EACH post, read its text and assign exactly ONE category:
 - "LEAD" (🟢 patient): a real INDIVIDUAL (a patient or a family member) talking about THEIR OWN medical situation — seeking treatment/surgery abroad, asking for help / advice / experiences / recommendations / costs ("I need", "looking for", "anyone recommend", "cost of", "how much", "best hospital for", "my father/mother/husband has <condition>"), weighing options, or sharing their own medical-tourism journey. A genuine patient prospect we could help.
 - "PARTNER" (🔵 business partner): a person or organisation offering or seeking a B2B referral relationship — facilitators, agencies, coordinators, consultants or clinics talking about "referral", "commission", "partnership", "facilitator", "coordinator", "MOU", "we send patients", "patient pipeline", "looking for hospitals", "tie-up", "empanelment", "channel partner". They want to send/receive patients or partner — NOT a patient themselves. This is a WANTED lead type (do NOT mark these MARKETING).
 - "MARKETING": promotional or advertising content with NO partnership intent — hospitals, clinics, agencies or influencers PROMOTING or SELLING services, packages, treatments, discounts, "contact/DM us", booking links, or unrelated commercial spam (e.g. exam-cheating, SEO link spam).
 - "NEWS": journalistic, informational, educational, or broadcast content — news articles, reports, statistics, "how-to"/guides/explainers, academic/research, or general non-personal discussion about medical tourism as a topic.
 - "OTHER": off-topic, irrelevant, unintelligible, generic wellness/spa/yoga, or not related to medical tourism / healthcare at all.
KEY TEST: a real person speaking about THEIR OWN care need = LEAD; someone seeking/offering a referral or patient-pipeline partnership = PARTNER; someone merely selling/promoting = MARKETING; impersonal reporting/education = NEWS; unrelated = OTHER.
For EACH item return: id, category (one of LEAD|PARTNER|MARKETING|NEWS|OTHER), reason (short phrase, max ~12 words).
Respond ONLY as JSON: {"results":[{"id":"<id>","category":"LEAD","reason":"patient asking for knee surgery cost in India"}]}`,
            },
            { role: 'user', content: list },
        ], 2000);
        const valid = new Set(['LEAD', 'PARTNER', 'MARKETING', 'NEWS', 'OTHER']);
        const map = {};
        for (const r of result?.results || []) {
            const cat = String(r?.category || '').toUpperCase();
            if (r?.id && valid.has(cat)) {
                map[r.id] = { category: cat, reason: String(r.reason || '').slice(0, 200) };
            }
        }
        return map;
    }
    async analyzeTranscript(input) {
        const result = await this.chat([
            {
                role: 'system',
                content: `You qualify a YouTube video as a sales LEAD for a medical-tourism company whose hospitals are in INDIA, by reading its full TRANSCRIPT. A LEAD is a real INDIVIDUAL (a patient or their family member) personally engaging with medical tourism FOR THEIR OWN SITUATION — someone we could actually help.

ACCEPT as a lead (isLead=true) — a genuine individual who is:
 - ASKING for help / advice / experiences / recommendations before going (score 80-100) — e.g. "should I go abroad for surgery?", "has anyone done this?", "need your experiences".
 - RESEARCHING options / undecided where to go / weighing affordability for their OWN care (score 65-85).
 - SHARING THEIR OWN medical-tourism JOURNEY or experience — deciding, in-progress, or recently done (score 60-80).
 - SEEKING INFORMATION for their OWN potential treatment abroad (score 55-75).
The common thread: a real person speaking about THEIR OWN medical situation, decision, or need.

REJECT (isLead=false, score 0-30) — content PRODUCED FOR AN AUDIENCE, not a personal situation:
 - TUTORIALS / HOW-TO / GUIDES / "X things to know" / step-by-step / explainers / listicles / myth-busting / checklists / "tips" — educational BROADCAST by a channel, creator, doctor, or "expert", however on-topic.
 - PROMOTIONAL / MARKETING / ADVERTISING — agencies, hospitals, clinics, facilitators, or influencers promoting services / packages / discounts.
 - News, interviews-for-an-audience, scripted, or unrelated content.

KEY TEST: Is a real person talking about THEIR OWN journey / decision / need (LEAD), or is a channel/creator/business PUBLISHING a guide, tutorial, explainer, or promo for viewers (NOT a lead)? An on-topic informational video is NOT a lead when it is a how-to / guide / promotional piece rather than a personal account.

isLead = true only when score >= 55. Return JSON ONLY: {"isLead":bool,"score":0-100,"confidence":0-100,"persona":"undecided"|"cant_afford"|"suffering"|"researching"|"journey"|null,"alreadyTreated":bool,"procedure":"condition/treatment or null","originCountry":"speaker's home country if stated, else null","summary":"one short sentence on who they are and what they need"}`,
            },
            {
                role: 'user',
                content: `TITLE: ${input.title}\nDESCRIPTION: ${(input.description || '').slice(0, 400)}\n\n--- TRANSCRIPT ---\n${input.transcript}\n--- END TRANSCRIPT ---`,
            },
        ], 700);
        return {
            isLead: !!result?.isLead,
            score: Math.max(0, Math.min(100, Number(result?.score) || 0)),
            confidence: Math.max(0, Math.min(100, Number(result?.confidence) || 0)),
            persona: result?.persona || null,
            alreadyTreated: !!result?.alreadyTreated,
            procedure: result?.procedure || null,
            originCountry: result?.originCountry || null,
            summary: result?.summary || '',
        };
    }
    async generateHospitalEnrichment(params) {
        const reviewBlock = params.reviews.length
            ? params.reviews
                .slice(0, 6)
                .map((r, i) => `(${i + 1}) [${r.rating ?? '?'}★ ${r.nationality ?? ''}] ${(r.text || '').slice(0, 400)}`)
                .join('\n')
            : '(no reviews available)';
        return this.chat([
            {
                role: 'system',
                content: `You are Curify's hospital data analyst for an India medical-tourism platform serving international (mostly African) patients.
Given a hospital and a sample of its real patient reviews, produce a realistic comparison profile.
Respond with ONLY valid JSON matching this schema exactly:
{
  "specialty": "primary specialty, e.g. 'Cardiology'",
  "procedures": ["3-6 representative procedures offered"],
  "quotedPriceUsd": 0,
  "localPriceUsd": 0,
  "localBenchmarkUsd": 0,
  "included": ["4-6 short package inclusions, e.g. 'Surgery','Anesthesia','4-night stay','Pre-op tests'"],
  "notIncluded": ["2-4 short exclusions, e.g. 'International flights','Visa'"],
  "pros": ["1-2 short honest strengths for an international patient"],
  "cons": ["1-2 short honest considerations / drawbacks"],
  "surgeon": {
    "name": "Dr. Full Name",
    "title": "e.g. 'Senior Consultant & Head of Department'",
    "specialization": "e.g. 'Minimally Invasive Joint Surgery'",
    "yearsExperience": 0,
    "totalProcedures": 0,
    "successRate": 0,
    "complications": 0,
    "patientRating": 0,
    "avgSurgeryTime": "e.g. '2.5 hours'",
    "nextAvailable": "e.g. 'Within 2 weeks'",
    "publications": 0,
    "education": ["2-3 'Degree, Institution' entries"],
    "languages": ["English", "Hindi", "+ 1-2 more"],
    "awards": ["1-3 short awards/recognitions"]
  }
}
Rules:
- Prices realistic for India medical tourism ($2,000-$15,000 international package); quoted should exceed local.
- surgeon.name: if a doctor is named in the reviews, USE that real name; else a plausible Indian specialist for the specialty.
- surgeon stats realistic for a senior Indian specialist: yearsExperience 10-35, totalProcedures 1000-20000, successRate 90-99 (percent), complications 0.5-4 (percent), patientRating 4.3-4.9 (out of 5), publications 5-120.
- Keep strings concise. Output JSON only.`,
            },
            {
                role: 'user',
                content: `Hospital: ${params.name}
City: ${params.city}, ${params.country}
Google rating: ${params.overallRating ?? 'n/a'}
JCI accredited: ${params.jciAccredited ?? false}
Sample patient reviews:
${reviewBlock}`,
            },
        ], 900);
    }
    async matchHospitals(params) {
        const hospitalSummary = params.hospitals.map(h => ({
            id: h.id,
            name: h.name,
            city: h.city,
            quotedPrice: h.quotedPriceUsd,
            fairnessScore: h.fairnessScore,
            rating: h.overallRating,
            jci: h.jciAccredited,
        }));
        return this.chat([
            {
                role: 'system',
                content: `You are Curify's hospital matching AI. Rank hospitals for a specific patient.
Respond with valid JSON matching this schema:
{
  "rankedHospitalIds": ["id1", "id2"],
  "insights": {
    "hospitalId": {
      "matchScore": 0-100,
      "personalizedPro": "why good for THIS patient",
      "personalizedCon": "honest consideration for THIS patient",
      "estimatedWait": "wait time estimate"
    }
  },
  "topRecommendation": "hospitalId",
  "recommendationReason": "1-2 sentences"
}`,
            },
            {
                role: 'user',
                content: `Patient diagnosis: ${params.diagnosis}
Treatment: ${params.treatment}
Home country: ${params.country}
Urgency: ${params.urgency}
Available hospitals: ${JSON.stringify(hospitalSummary, null, 2)}
Rank these hospitals for this specific patient.`,
            },
        ], 1500);
    }
    async generateTripPlan(params) {
        return this.chat([
            {
                role: 'system',
                content: `You are Curify's trip planning AI. Generate a personalized medical trip timeline.
Respond with valid JSON matching this schema:
{
  "timeline": [
    {
      "day": -14,
      "phase": "preparation|arrival|pre-surgery|surgery|recovery|return|follow-up",
      "title": "event title",
      "description": "brief description",
      "icon": "emoji",
      "status": "upcoming"
    }
  ],
  "costs": {
    "surgery": { "item": "description", "amount": 4500, "note": "explanation" },
    "flights": { "item": "description", "amount": 980, "note": "explanation" },
    "visa": { "item": "description", "amount": 25, "note": "explanation" },
    "hotel": { "item": "description", "amount": 350, "note": "explanation" },
    "companion": { "item": "description", "amount": 450, "note": "explanation" },
    "insurance": { "item": "description", "amount": 150, "note": "explanation" },
    "misc": { "item": "description", "amount": 200, "note": "explanation" },
    "emergency": { "item": "description", "amount": 665, "note": "explanation" }
  },
  "totalEstimate": 7320,
  "insuranceAlert": {
    "type": "warning",
    "text": "insurance advisory",
    "recommendation": "recommended plan"
  },
  "travelTips": ["tip1", "tip2", "tip3"]
}`,
            },
            {
                role: 'user',
                content: `Generate trip plan:
Hospital: ${params.hospital.name}, ${params.hospital.city}
Surgeon: ${params.surgeon?.name || 'Assigned surgeon'}
Surgery price: $${params.hospital.quotedPriceUsd}
Procedure: ${params.treatment || params.diagnosis}
Patient from: ${params.country || 'Nigeria'}
Included: ${(params.hospital.included || []).join(', ')}`,
            },
        ], 2000);
    }
    async generateRecoveryPlan(params) {
        return this.chat([
            {
                role: 'system',
                content: `You are Curify's post-treatment recovery AI. Generate personalized recovery plans.
Respond with valid JSON matching this schema:
{
  "checkIns": [
    {
      "day": 3,
      "status": "completed|upcoming",
      "date": "YYYY-MM-DD",
      "title": "check-in title",
      "summary": "expected recovery status",
      "doctorNote": "doctor's note or null"
    }
  ],
  "recoveryTips": [{ "icon": "emoji", "text": "tip" }],
  "doctorHandoff": {
    "from": "treating doctor",
    "to": "home doctor",
    "document": "document name",
    "status": "Sent and acknowledged",
    "sentDate": "YYYY-MM-DD"
  }
}`,
            },
            {
                role: 'user',
                content: `Recovery plan for:
Procedure: ${params.treatment || params.diagnosis}
Hospital: ${params.hospital}
Surgeon: ${params.surgeon}
Surgery date: today
Include check-ins at Day 3, Day 7, Day 30, Day 90.
Generate 6 specific recovery tips.`,
            },
        ], 1500);
    }
    async generateFamilyUpdates(params) {
        return this.chat([
            {
                role: 'system',
                content: `You are Curify's family communication AI. Generate reassuring surgery status updates.
Respond with valid JSON matching this schema:
{
  "updates": [
    { "time": "HH:MM AM/PM", "text": "family-friendly update", "status": "completed|active|pending", "icon": "emoji" }
  ],
  "milestones": [{ "label": "milestone", "done": true, "active": false }],
  "currentStatus": "status description",
  "estimatedNext": "what happens next"
}`,
            },
            {
                role: 'user',
                content: `Status updates for:
Procedure: ${params.procedure}
Hospital: ${params.hospital}
Surgeon: ${params.surgeon}
Current stage: ${params.stage}
Generate realistic surgical timeline updates that reassure family members.`,
            },
        ], 1000);
    }
};
exports.AiService = AiService;
exports.AiService = AiService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], AiService);
//# sourceMappingURL=ai.service.js.map