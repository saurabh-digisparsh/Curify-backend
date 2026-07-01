/**
 * Lead-generation configuration for the medical-tourism prospecting feature.
 *
 * We hunt YouTube videos/Shorts where people express intent around getting
 * medical care abroad (too expensive / long waits / seeking options) and pitch
 * India hospitals. Primary audiences: USA, Middle East, Africa.
 */

// ── Quota (YouTube Data API v3 free tier) ────────────────────────────────────
// Default daily quota is 10,000 units; search.list costs 100, videos.list 1.
// We self-cap at a fraction (default 70%) so we never exhaust the project quota.
export const YT_DAILY_QUOTA = parseInt(process.env.YOUTUBE_DAILY_QUOTA || '10000', 10);
export const YT_QUOTA_PCT = parseFloat(process.env.YOUTUBE_QUOTA_PCT || '0.7');
export const YT_QUOTA_CAP = Math.floor(YT_DAILY_QUOTA * YT_QUOTA_PCT);
export const YT_SEARCH_COST = 100; // search.list
export const YT_VIDEOS_COST = 1; // videos.list (batch of up to 50 ids)

// When AI classification is on, only keep videos the model confirms as a genuine
// lead with confidence STRICTLY ABOVE this threshold. Everything else is dropped.
// Lowered to 50 to widen the funnel (more leads pass AI qualification).
export const AI_MIN_CONFIDENCE = 50;

export type RegionKey = 'USA' | 'MIDDLE_EAST' | 'AFRICA';

// regionCode biases results to a market; relevanceLanguage biases language.
export const REGION_CONFIG: Record<RegionKey, { label: string; codes: string[]; langs: string[] }> = {
  USA: { label: 'USA', codes: ['US'], langs: ['en'] },
  MIDDLE_EAST: { label: 'Middle East', codes: ['AE', 'SA', 'QA', 'KW', 'OM', 'EG'], langs: ['en', 'ar'] },
  AFRICA: { label: 'Africa', codes: ['NG', 'KE', 'GH', 'ZA', 'TZ', 'UG'], langs: ['en'] },
};

// Search phrases grouped by the three patient personas we want to reach: people
// deciding where to go for care, people who can't afford treatment at home, and
// people suffering with no cure found. These are prime medical-tourism prospects.
export const QUERY_GROUPS: Record<string, string[]> = {
  // 1) Can't decide WHERE to go for medical care
  where_to_go: [
    'which country for medical treatment',
    'best country for surgery abroad',
    'where to get treatment abroad',
    'should i go abroad for surgery',
    'confused where to get treatment',
    'medical tourism which country is best',
  ],
  // 2) Can't AFFORD treatment in their own country
  cant_afford: [
    "can't afford surgery",
    'surgery too expensive in my country',
    'no insurance need surgery help',
    'medical bills too high cannot pay',
    'cheaper treatment in another country',
    'cannot afford treatment what to do',
  ],
  // 3) In PAIN / suffering and unable to find a cure
  pain_no_cure: [
    'chronic pain doctors can t help',
    'still in pain no cure',
    "can't find cure for my condition",
    'desperate for treatment no answers',
    'suffering no diagnosis need help',
    'long waiting list still in pain',
  ],
  // 4) First-person, COMMUNITY-ASK research — an individual openly seeking help /
  //    experiences / advice before going (EXACTLY the seed Short: "I'm researching
  //    medical tourism and I need YOUR experience stories"). These are the truest
  //    leads — a real person reaching out, not a channel broadcasting advice.
  researching: [
    'i need your medical tourism experience',
    'researching medical tourism',
    'has anyone done medical tourism',
    'looking for advice treatment abroad',
    'help me decide treatment abroad',
    'anyone been to india for treatment',
    'thinking of surgery abroad need advice',
    'should i go abroad for treatment',
    'need recommendations medical tourism',
    'considering treatment abroad',
    'medical tourism advice please',
    'planning to go abroad for surgery',
    'want to go abroad for treatment',
    'where should i go for treatment abroad',
    'india for medical treatment advice',
    'going to india for surgery tips',
    'medical tourism india help',
    'anyone gone abroad for surgery',
    'is medical tourism safe should i go',
    'thinking about getting treatment in india',
  ],
  // 5) First-person, procedure-specific help-seeking (still deciding, not done).
  procedure_considering: [
    'considering knee replacement abroad',
    'anyone got hair transplant abroad advice',
    'thinking about ivf abroad need advice',
    'should i get dental work abroad',
    'is it worth getting surgery abroad',
    'looking for surgeon abroad recommendations',
    'anyone had weight loss surgery abroad',
    'questions before getting surgery abroad',
    'considering cancer treatment abroad',
    'thinking about knee surgery abroad',
    'planning hair transplant abroad',
    'want dental implants abroad advice',
    'considering bariatric surgery abroad',
    'planning cosmetic surgery abroad',
    'considering spine surgery abroad',
    'should i get ivf abroad',
  ],
  // 6) COMPETITOR-AWARE — people weighing rival destinations / providers (Thailand,
  //    Turkey, Mexico, Singapore, etc.) or asking which country is best. Prime
  //    targets to win over by pitching India as the better-value alternative.
  competitor: [
    'india vs thailand medical tourism',
    'turkey vs india hair transplant',
    'thailand or india for surgery',
    'mexico vs india medical tourism',
    'best country for medical tourism',
    'cheapest country for surgery',
    'is turkey worth it for surgery',
    'thailand vs india hospital cost',
    'which is better india or turkey treatment',
    'comparing medical tourism countries',
    'singapore vs india treatment cost',
    'best destination for surgery abroad',
    'where is cheapest for medical tourism',
    'turkey or india for hair transplant',
  ],
  // 7) WESTERN AFFORDABILITY — high-cost-healthcare patients (US/UK/Canada/Australia)
  //    priced out at home and looking abroad to save money. The transcript analysis
  //    showed this is a rich seam (e.g. "Tennessee, no insurance, knee replacement").
  western_affordability: [
    "can't afford surgery in america",
    'no insurance need surgery going abroad',
    'surgery abroad to save money',
    'cheaper to get surgery in another country',
    'us healthcare too expensive going abroad',
    'medical tourism from usa',
    'medical tourism from canada',
    'medical tourism from uk',
    'going abroad for surgery without insurance',
    'affordable surgery overseas no insurance',
    'cant afford healthcare leaving the country',
    'dental work abroad to save money',
  ],
  // 8) PROCEDURE-SPECIFIC medical-tourism intent (the procedures the AI keeps
  //    extracting from transcripts). First-person "for [procedure] abroad".
  procedure_medtourism: [
    'medical tourism for knee replacement',
    'medical tourism for ivf',
    'medical tourism for dental implants',
    'medical tourism for weight loss surgery',
    'medical tourism for hair transplant',
    'medical tourism for heart surgery',
    'medical tourism for cancer treatment',
    'going abroad for knee replacement',
    'going abroad for ivf treatment',
    'is it safe to get surgery in india',
    'best country for affordable ivf',
    'cheapest place for dental work abroad',
  ],
};

export const ALL_QUERY_GROUPS = Object.keys(QUERY_GROUPS);

// ── Heuristic intent scoring ─────────────────────────────────────────────────
// Weighted keyword buckets aligned to the 3 target personas. A video's
// title+description is scanned and scored 0-100.
export const INTENT_KEYWORDS: { weight: number; terms: string[] }[] = [
  // STRONGEST signal — a real person personally ASKING the community for help /
  // experiences / advice / recommendations (the seed Short's exact pattern).
  { weight: 35, terms: ['i need your', 'i need help', 'help me', 'has anyone', 'anyone been', 'anyone done', 'anyone got', 'anyone had', 'anyone has', "i'm looking for", 'i am looking for', 'looking for advice', 'need advice', 'any advice', 'need recommendations', 'any recommendations', 'any suggestions', 'any tips', 'should i', 'your experience', 'experience stories', 'reaching out', 'let me know', 'please let me know', 'please help'] },
  // Persona 1 — undecided where to go for care / actively researching options
  { weight: 25, terms: ['which country', 'where to', 'where can i', 'best country', 'should i go', 'confused', "don't know where", 'decide', 'options abroad', 'researching', 'research', 'considering', 'thinking about', 'looking into', 'planning'] },
  // Persona 2 — can't afford treatment at home (incl. Western high-cost-healthcare cues)
  { weight: 25, terms: ["can't afford", 'cannot afford', 'too expensive', 'no insurance', 'without insurance', 'no health insurance', 'uninsured', 'unaffordable', 'cheaper', 'save money', 'medical bills', 'cost too high', "can't pay", 'us healthcare', 'healthcare costs', 'out of pocket'] },
  // Persona 3 — in pain / no cure found
  { weight: 25, terms: ['still in pain', 'chronic pain', 'no cure', 'no relief', 'no answers', 'no diagnosis', 'suffering', 'desperate', "doctors can't", "doctors can t", 'nothing works'] },
  // Going-abroad intent (strong qualifier for all personas). Includes hashtag forms.
  { weight: 20, terms: ['abroad', 'overseas', 'another country', 'out of country', 'medical tourism', 'medicaltourism', 'health tourism', 'india', 'europe'] },
  // Competitor / destination-comparison signal — actively weighing rival
  // destinations or providers (prime targets to convert to India).
  { weight: 22, terms: ['vs india', 'india vs', 'vs thailand', 'vs turkey', 'vs mexico', 'or india', 'thailand', 'turkey', 'mexico', 'singapore', 'comparing', 'which is better', 'best destination', 'best country for', 'cheapest country'] },
  // Care context
  { weight: 12, terms: ['surgery', 'treatment', 'operation', 'procedure', 'transplant', 'replacement', 'therapy', 'condition', 'cancer', 'tumor', 'tumour', 'chemo', 'diagnosed', 'diagnosis'] },
  // Access friction
  { weight: 8, terms: ['waiting list', 'long wait', 'waitlist', 'months wait', 'denied', 'refused'] },
];

// Reverse map (ISO country code → our region) so global searches can still tag a
// lead's region from the creator's channel country instead of targeting one.
const CODE_TO_REGION: Record<string, RegionKey> = {};
for (const [key, cfg] of Object.entries(REGION_CONFIG)) {
  for (const code of cfg.codes) CODE_TO_REGION[code] = key as RegionKey;
}
export function regionFromCode(code?: string | null): 'USA' | 'MIDDLE_EAST' | 'AFRICA' | 'OTHER' {
  return (code && CODE_TO_REGION[code]) || 'OTHER';
}

// Signals that a video is a COMPLETED treatment / success story / testimonial
// (the person already went) — we want active prospects, so these are penalised
// hard so they fall below the minScore threshold before AI classification.
export const PAST_SIGNALS = [
  'my journey', 'my experience', 'my story', 'my results', 'my recovery',
  'after my', 'post op', 'post-op', 'months post', 'i got my', 'i had my',
  'before and after', 'transformation', 'successful', 'success story',
  'testimonial', 'patient from', 'comes to india', 'came to india',
  'flew to', 'went to india', 'shares', 'honest vlog', 'recovery update',
  'how it went', 'thank you doctor', 'here is my', "here's my",
];

// ── Bright Data social capture (Reddit / Quora / Instagram / Facebook) ────────
// Hard cap on Bright Data spend (records delivered ≈ credits). Defaults to Bright
// Data's Web Scraper free tier (5,000 records/month). Override via env.
export const BRIGHT_DATA_CREDIT_CAP = parseInt(process.env.BRIGHT_DATA_CREDIT_CAP || '5000', 10);
// Bright Data SERP API zone (Google search) — used for Quora discovery via
// `site:quora.com <keyword>`, since the Quora scraper dataset is broken.
export const BRIGHT_DATA_SERP_ZONE = process.env.BRIGHT_DATA_SERP_ZONE || 'serp_api1';

// Marketplace dataset ids + how each is triggered (verified live against the key).
export const BRIGHTDATA_DATASETS: Record<
  'REDDIT' | 'QUORA' | 'INSTAGRAM' | 'FACEBOOK' | 'X',
  { id: string; mode: 'discover_keyword' | 'discover_search_url' | 'discover_url' | 'discover_profile_url' | 'url' }
> = {
  REDDIT: { id: 'gd_lvz8ah06191smkebj4', mode: 'discover_keyword' }, // Reddit - Posts (discover by keyword OR collect by URL) — only platform with working keyword discovery
  QUORA: { id: 'gd_lvz1rbj81afv3m6n5y', mode: 'url' }, // Quora posts — keyword/search discovery is broken on BD side, so URL-collect only
  INSTAGRAM: { id: 'gd_lk5ns7kz21pck8jpis', mode: 'discover_url' }, // Instagram - Posts (discover_by=url on a profile/hashtag URL)
  FACEBOOK: { id: 'gd_lz11l67o2cb3r0lkj3', mode: 'url' }, // Facebook - Posts by group URL (url_collection only, no discovery)
  X: { id: 'gd_lwxkxvnf1cynvib9co', mode: 'discover_profile_url' }, // X (Twitter) - Posts (discover_by=profile_url; input field 'url')
};

// The Curify medical-tourism "3-Signal Qualifier" (from the query pack):
// a post is a real ICP when it names a PROCEDURE + a COST cue + an ORIGIN country.
// 3/3 = hot, 2/3 = warm, else cold.
export const PROCEDURE_TERMS = [
  // Cardiac
  'heart bypass', 'bypass surgery', 'cardiac', 'heart surgery', 'angioplasty',
  'open heart', 'valve replacement', 'pacemaker',
  // Orthopaedic
  'knee replacement', 'hip replacement', 'joint replacement',
  // Transplants
  'liver transplant', 'kidney transplant', 'bone marrow transplant', 'stem cell transplant',
  'organ transplant', 'transplant', 'kidney failure', 'dialysis',
  // Oncology
  'cancer', 'oncology', 'chemo', 'chemotherapy', 'tumor', 'tumour', 'immunotherapy',
  'proton therapy', 'car t', 'car-t', 'car-t cell', 'leukemia', 'lymphoma',
  // Fertility
  'ivf', 'fertility', 'icsi', 'surrogacy',
  // Bariatric
  'bariatric', 'weight loss surgery', 'gastric',
  // Neuro / spine
  'spine surgery', 'spinal', 'neurosurgery', 'brain surgery', 'epilepsy', 'stroke',
  // Aesthetic / dental / eye
  'hair transplant', 'dental', 'dental implant', 'cosmetic', 'plastic surgery',
  'eye surgery', 'lasik',
  // Generic
  'surgery', 'surgeries', 'treatment',
  // generic procedure language — real inquiries often don't name the operation
  'procedure', 'procedures', 'operation', 'medical service', 'medical services', 'medical procedure',
];
export const COST_TERMS = [
  'cost', 'costs', 'price', 'how much', 'afford', 'affordable', 'cheap', 'cheaper',
  'expensive', 'budget', 'quote', 'estimate', 'package', 'charges', 'fees',
  'naira', 'cedi', 'shilling', 'aed', 'dirham', 'sar', 'riyal', 'qar', 'omr', 'bhd',
  'rupee', 'usd', 'dollar', 'pay', 'payment',
];
export const ORIGIN_TERMS = [
  // GCC
  'oman', 'omani', 'uae', 'emirates', 'dubai', 'abu dhabi', 'saudi', 'saudi arabia',
  'riyadh', 'jeddah', 'qatar', 'qatari', 'doha', 'bahrain', 'kuwait', 'muscat', 'gcc',
  // Africa — East & West
  'nigeria', 'nigerian', 'kenya', 'kenyan', 'ghana', 'ghanaian', 'tanzania',
  'ethiopia', 'uganda', 'lagos', 'abuja', 'nairobi', 'accra',
  // Africa — Southern & Central (expanded to match the new keyword pack)
  'south africa', 'zimbabwe', 'zambia', 'cameroon', 'rwanda', 'senegal', 'sudan', 'angola',
  // Major Western source countries (high-cost / long-wait healthcare → travel abroad)
  'canada', 'canadian', 'usa', 'u.s.', 'united states', 'america', 'american',
  'uk', 'u.k.', 'united kingdom', 'britain', 'british', 'england', 'scotland',
  'australia', 'australian', 'ireland', 'irish', 'new zealand',
];

// Medical-tourism / India-corridor relevance — the topic the new "medical tourism"
// search keys are about. Used as a 4th scoring component so on-topic posts rank up
// even with only one hard ICP signal.
export const MEDTOURISM_TERMS = [
  'medical tourism', 'health tourism', 'medical travel', 'medical value travel',
  'treatment abroad', 'surgery abroad', 'treatment overseas', 'treatment in india',
  'surgery in india', 'operation in india', 'hospital in india', 'medical visa',
  'going to india for', 'come to india for', 'flying to india', 'go abroad for treatment',
];

// 🔵 BUSINESS-PARTNER signals (from the BrightData query pack): people/orgs offering
// or seeking a referral relationship — facilitators, agencies, coordinators looking
// to send/receive patients. These are a WANTED lead type (category PARTNER), distinct
// from a patient (🟢 LEAD) and from discard (🔴 MARKETING/NEWS/OTHER).
export const PARTNER_TERMS = [
  'referral', 'referrals', 'commission', 'partnership', 'partner with', 'facilitator',
  'facilitators', 'agency', 'agencies', 'coordinator', 'mou', 'we send patients',
  'send patients to', 'patient pipeline', 'patient referral', 'looking for hospitals',
  'tie up', 'tie-up', 'empanelment', 'empanel', 'channel partner', 'b2b', 'collaborate',
  'collaboration', 'business partnership', 'refer patients', 'patient leads',
];
export function hasPartnerSignal(text: string): boolean {
  const t = (text || '').toLowerCase();
  return PARTNER_TERMS.some((x) => t.includes(x));
}

// India hospital brands patients search by name — strong on-topic / corridor signal.
export const BRAND_TERMS = [
  'apollo', 'fortis', 'medanta', 'narayana', 'max hospital', 'max healthcare',
  'kokilaben', 'manipal', 'wockhardt', 'artemis', 'aster', 'amrita',
];

export function scoreSignals(text: string): {
  hasProcedure: boolean; hasCost: boolean; hasOrigin: boolean; hasMedTourism: boolean;
  hasPartner: boolean; partners: string[];
  signalCount: number; temperature: 'hot' | 'warm' | 'cold';
  procedures: string[]; origins: string[]; intentScore: number;
} {
  const t = (text || '').toLowerCase();
  const procedures = PROCEDURE_TERMS.filter((x) => t.includes(x));
  const origins = ORIGIN_TERMS.filter((x) => t.includes(x));
  const partners = PARTNER_TERMS.filter((x) => t.includes(x));
  const hasProcedure = procedures.length > 0;
  const hasCost = COST_TERMS.some((x) => t.includes(x));
  const hasOrigin = origins.length > 0;
  const hasPartner = partners.length > 0;
  // Medical-tourism relevance — corridor context (incl. a bare "India" or brand mention).
  const hasMedTourism =
    MEDTOURISM_TERMS.some((x) => t.includes(x)) || BRAND_TERMS.some((x) => t.includes(x)) || /\bindia\b/.test(t);
  // The 3 hard ICP signals (procedure + cost + origin) still set temperature.
  const signalCount = [hasProcedure, hasCost, hasOrigin].filter(Boolean).length;
  const temperature = signalCount >= 3 ? 'hot' : signalCount === 2 ? 'warm' : 'cold';
  // Weighted 0-100: procedure 35, cost 25, origin 25, medical-tourism relevance 15.
  // A business-partner signal adds 25 so referral/facilitator posts (which often carry
  // no procedure/cost/origin) still surface instead of being buried as cold.
  const intentScore = Math.min(100,
    (hasProcedure ? 35 : 0) + (hasCost ? 25 : 0) + (hasOrigin ? 25 : 0) +
    (hasMedTourism ? 15 : 0) + (hasPartner ? 25 : 0));
  return { hasProcedure, hasCost, hasOrigin, hasMedTourism, hasPartner, partners, signalCount, temperature, procedures, origins, intentScore };
}

// Academic-cheating / service spam that pollutes broad keyword searches (e.g.
// "ACE YOUR PROCTORED EXAMS", "do my online class", "homework help"). These posts
// are still SAVED (never deleted) but flagged so they're hidden from the lead list
// by default. Terms kept narrow to avoid false-positives on real medical posts.
export const SPAM_TERMS = [
  'proctored', 'online class', 'online classes', 'homework', 'ace your', 'ace my',
  'take my exam', 'do my exam', 'do your exam', 'exam help', 'pass your exam',
  'assignment help', 'write my', 'essay help', 'dissertation', 'coursework',
  'pay someone', 'nursing class', 'nursing classes', 'boost your gpa',
  'guaranteed grades', 'free websites', 'hire us', 'we will do your',
];
export function isSpam(text: string): boolean {
  const t = (text || '').toLowerCase();
  return SPAM_TERMS.some((s) => t.includes(s));
}

// Master keyword pack for Bright Data discovery (Reddit keyword-discovery + Quora/
// Facebook SERP). The 3-signal scorer grades each captured post.
export const BRIGHTDATA_KEYWORDS = [
  // ── Core intent phrases ──
  'medical tourism', 'medical tourism india', 'medical travel', 'medical travel india',
  'treatment in india', 'travel for treatment', 'treatment abroad', 'going to india for surgery',
  'need treatment in india', 'affordable surgery abroad', 'affordable surgery india',
  'overseas medical treatment', 'hospital abroad for treatment', 'medical trip abroad',
  'second opinion abroad', 'second opinion india hospital', 'india medical visa', 'medical visa india',
  'health tourism', 'healthcare tourism', 'healthcare abroad', 'cross border healthcare', 'international patients',
  // ── Partner / Facilitator discovery (🔵) ──
  'medical travel agency', 'medical travel facilitator', 'medical concierge',
  'international patient coordinator', 'healthcare concierge', 'medical tourism consultant',
  'medical tourism partnership', 'patient referral india', 'hospital referral program india',
  'medical tourism agent wanted', 'medical travel agent commission', 'medical tourism facilitator wanted',
  'medical tourism tie up india',
  // ── India — General ──
  'india medical tourism', 'international patient india', 'best hospitals in india', 'affordable treatment india',
  'jci accredited hospitals india', 'nabh hospital india', 'medical packages india',
  'indian hospitals for foreigners', 'india treatment cost', 'india treatment cost vs usa',
  'india treatment cost vs uk', 'india treatment cost vs europe', 'india healthcare', 'india hospitals',
  // ── India — Top hospital brands (patients search by name) ──
  'apollo hospitals international patients', 'fortis hospitals international patients',
  'medanta hospital international patients', 'narayana health international patients',
  'max hospital international patients', 'kokilaben hospital international patients',
  'manipal hospitals international patients', 'wockhardt hospital international patients',
  // ── Procedure-specific — Oncology ──
  'cancer treatment india', 'cancer treatment india cost', 'cancer hospital india',
  'cancer treatment in india affordable', 'bone marrow transplant india', 'bone marrow transplant cost india',
  'stem cell transplant india', 'proton therapy india', 'car t cell therapy india',
  'leukemia treatment india', 'lymphoma treatment india', 'breast cancer treatment india',
  'cervical cancer treatment india', 'liver cancer treatment india', 'lung cancer treatment india',
  // ── Procedure-specific — Cardiac ──
  'cardiac surgery india', 'heart surgery india', 'heart bypass surgery india', 'open heart surgery india',
  'valve replacement surgery india', 'angioplasty india', 'pacemaker surgery india',
  // ── Procedure-specific — Transplants ──
  'kidney transplant india', 'kidney transplant cost india', 'liver transplant india',
  'liver transplant cost india', 'organ transplant india', 'kidney failure treatment india',
  // ── Procedure-specific — Orthopaedic ──
  'knee replacement india', 'knee replacement cost india', 'hip replacement india',
  'spinal surgery india', 'spine surgery india cost', 'joint replacement india',
  // ── Procedure-specific — Neurology ──
  'brain surgery india', 'neurosurgery india', 'epilepsy treatment india', 'stroke treatment india',
  // ── Procedure-specific — IVF / Fertility ──
  'ivf treatment india', 'ivf cost india', 'fertility treatment india', 'surrogacy india',
  // ── Procedure-specific — Other ──
  'dialysis india', 'bariatric surgery india', 'weight loss surgery india', 'cosmetic surgery india',
  'plastic surgery india', 'eye surgery india', 'lasik india', 'dental treatment india', 'dental implants india',
  // ── UAE / Dubai ──
  'medical tourism uae', 'medical tourism dubai', 'medical travel dubai', 'treatment in india from dubai',
  'dubai to india medical tourism', 'medical tourism abu dhabi', 'treatment abroad from uae',
  'cancer treatment india from uae', 'kidney transplant from dubai', 'arabic speaking hospital india',
  'hindi speaking doctor india', 'indian expat treatment india', 'indian expat hospital india',
  'gcc patients india hospital',
  // ── Saudi Arabia ──
  'medical tourism saudi arabia', 'treatment in india from saudi arabia', 'treatment in india from riyadh',
  'treatment in india from jeddah', 'saudi patients india hospital', 'affordable treatment saudi arabia',
  // ── Other GCC countries ──
  'medical tourism kuwait', 'medical tourism qatar', 'medical tourism bahrain', 'medical tourism oman',
  'treatment in india from kuwait', 'treatment in india from qatar', 'treatment in india from muscat',
  'treatment in india from doha',
  // ── Africa — East & West ──
  'medical tourism africa', 'medical tourism nigeria', 'medical tourism kenya', 'medical tourism ghana',
  'medical tourism uganda', 'medical tourism tanzania', 'medical tourism ethiopia',
  'africa to india medical tourism', 'india hospital africa', 'treatment in india africa',
  'nigerian patients india', 'africa to india treatment', 'affordable surgery india nigeria',
  'affordable surgery india kenya', 'cancer treatment india from africa', 'cancer treatment india nigeria',
  // ── Africa — Southern & Central ──
  'medical tourism south africa', 'medical tourism zimbabwe', 'medical tourism zambia',
  'medical tourism cameroon', 'medical tourism rwanda', 'medical tourism senegal',
  'medical tourism sudan', 'medical tourism angola', 'treatment in india from africa',
  'south africa to india medical treatment',
];

// Feed the SAME expanded medical-tourism keyword pack into YouTube discovery, not
// just Bright Data social capture. Registered here (after BRIGHTDATA_KEYWORDS is
// defined) as a first-class, selectable query group so the admin form, the default
// runs, and the daily cron can all search YouTube with these keywords.
export const YT_KEYWORD_GROUP = 'medtourism_keywords';
QUERY_GROUPS[YT_KEYWORD_GROUP] = BRIGHTDATA_KEYWORDS;

// Instagram/Facebook hashtags — used for hashtag SERP discovery (site:instagram.com #tag).
export const BRIGHTDATA_HASHTAGS = [
  // ── Core ──
  '#MedicalTourism', '#MedicalTourismIndia', '#MedicalTravel', '#MedicalTravelIndia',
  '#HealthcareTourism', '#HealthTourism', '#MedicalVisa', '#MedicalVisaIndia',
  '#TreatmentInIndia', '#TreatmentAbroad', '#MedicalAbroad', '#MedicalTrip',
  '#TravelForTreatment', '#HealthTravel',
  // ── India healthcare ──
  '#IndiaHealthcare', '#InternationalPatients', '#HospitalInIndia', '#HealthcareIndia',
  '#IndiaHospital', '#PatientInIndia', '#AffordableHealthcareIndia', '#AffordableHealthcare',
  '#AffordableSurgery',
  // ── Facilitator / Partner signals (🔵) ──
  '#MedicalFacilitator', '#MedicalConcierge', '#HealthcareConcierge', '#PatientJourney',
  '#PatientExperience', '#MedicalTourismConsultant', '#MedicalTourismAgency',
  '#InternationalPatientCoordinator',
  // ── Procedure-specific ──
  '#CancerTreatmentIndia', '#HeartSurgeryIndia', '#CardiacSurgeryIndia', '#KidneyTransplantIndia',
  '#LiverTransplantIndia', '#OrganTransplantIndia', '#BoneMarrowTransplantIndia',
  '#KneeReplacementIndia', '#SpineSurgeryIndia', '#IVFIndia', '#FertilityTreatmentIndia',
  '#BariatricSurgeryIndia',
  // ── Hospital brands (patients use these) ──
  '#ApolloHospitals', '#FortisHospitals', '#MedantaHospital', '#NarayanaHealth', '#MaxHospital',
  // ── GCC-specific ──
  '#HealthTravelUAE', '#MedicalTourismDubai', '#MedicalTourismUAE', '#DubaiToIndia',
  '#UAEPatients', '#SaudiPatients',
  // ── Africa-specific ──
  '#MedicalTourismAfrica', '#MedicalTourismNigeria', '#MedicalTourismKenya', '#NigeriaToIndia',
  '#KenyaToIndia', '#AfricaToIndia', '#MedicalTourismGhana', '#AfricanPatientsIndia',
];

// X (Twitter) search phrases — used for X SERP discovery (site:x.com "phrase").
// Quoted = exact match (high precision). Unquoted = broad match (higher volume).
export const BRIGHTDATA_X_PHRASES = [
  // ── Core quoted phrases (exact match — highest precision) ──
  '"medical tourism india"', '"treatment in india"', '"going to india for surgery"',
  '"need treatment in india"', '"looking for hospital in india"', '"anyone recommend hospital in india"',
  '"best hospital india for"', '"affordable surgery india"', '"cancer treatment india"',
  '"cardiac surgery india"', '"kidney transplant india"', '"medical visa india"',
  '"second opinion india"', '"india treatment cost"',
  // ── GCC-specific quoted phrases ──
  '"treatment in india from dubai"', '"treatment in india from uae"', '"treatment in india from saudi"',
  '"treatment in india from riyadh"', '"dubai to india medical"', '"india hospital from uae"',
  // ── Africa-specific quoted phrases ──
  '"treatment in india from nigeria"', '"treatment in india from kenya"', '"nigeria to india treatment"',
  '"kenya to india hospital"', '"africa to india medical"',
  // ── Patient intent — unquoted (broader match, high volume) ──
  'medical tourism india experience', 'medical travel india review', 'hospital india recommendation',
  'best cancer hospital india', 'affordable heart surgery india', 'knee replacement cost india',
  'liver transplant india cost', 'IVF treatment india', 'spine surgery india', 'bariatric surgery india',
  // ── Partner / B2B discovery — quoted (🔵) ──
  '"medical tourism partnership"', '"patient referral india"', '"hospital referral program"',
  '"medical tourism facilitator"', '"medical tourism agent"', '"international patient coordinator"',
  '"medical tourism MOU"', '"we send patients to india"', '"medical tourism commission"',
  // ── Partner / B2B discovery — unquoted (🔵) ──
  'medical tourism agency india partnership', 'patient referral program india hospitals',
  'medical travel facilitator india tie up', 'hospital empanelment india international',
];

// ── Facebook Group search strings — used to DISCOVER relevant groups to monitor.
// Facebook's dataset is url-collection only (no keyword discovery), so these feed
// group-finding (manually or via a future group-URL discovery step), not post search.
export const FACEBOOK_GROUP_SEARCH_TERMS = [
  // Direct group searches
  'medical tourism india', 'india treatment group', 'international patients india',
  'treatment abroad support', 'medical travel community', 'india hospital patients',
  'cancer treatment india support', 'organ transplant india', 'medical tourism support group',
  'affordable healthcare abroad',
  // GCC-focused groups
  'africa india health travel', 'dubai india medical', 'GCC patients india',
  'Arabs in India hospital', 'medical tourism UAE group', 'medical tourism saudi group',
  // Africa-focused groups
  'Nigerians in India medical', 'Kenyans medical treatment abroad', 'Africans seeking treatment india',
  'medical tourism Africa group', 'Nigeria india treatment community',
  // Diaspora / expat patient groups
  'Indian expat health india', 'medical treatment abroad community',
  'patients seeking treatment india', 'international patient support india',
];

// Google site to search per platform for SERP-based keyword/hashtag discovery.
export const BRIGHTDATA_SERP_SITES: Record<'QUORA' | 'X' | 'INSTAGRAM' | 'FACEBOOK', string> = {
  QUORA: 'quora.com', X: 'x.com', INSTAGRAM: 'instagram.com', FACEBOOK: 'facebook.com',
};

/** The default search terms to use for a platform's SERP discovery. */
export function serpTermsFor(platform: string): string[] {
  if (platform === 'X') return BRIGHTDATA_X_PHRASES;
  if (platform === 'INSTAGRAM') return BRIGHTDATA_HASHTAGS;
  return BRIGHTDATA_KEYWORDS; // QUORA, FACEBOOK
}

// Recency window for Reddit discovery (Bright Data "date" filter). "Past month"
// = posts from the last month up to now. Valid values: 'All time', 'Past year',
// 'Past month', 'Past week', 'Today'.
export const BRIGHTDATA_REDDIT_DATE = 'Past month';
// Sort MUST be 'New' to honour the date window — 'Relevance' ignores it and
// returns 0 rows for a recency-scoped search.
export const BRIGHTDATA_REDDIT_SORT = 'New';
// Dedicated dataset for pulling a post's full comment thread (one row per comment).
export const BRIGHTDATA_REDDIT_COMMENTS_DATASET = 'gd_lvzdpsdlw09j6t702';
// Cap comments fetched per post (bounds Bright Data credit spend per "Load comments").
export const BRIGHTDATA_COMMENTS_LIMIT = 50;
// Default Instagram profiles to discover posts from when no URLs are supplied —
// India medical-tourism hospital accounts (IG has no keyword/hashtag discovery here).
export const BRIGHTDATA_IG_PROFILES = [
  'https://www.instagram.com/apollohospitals/',
  'https://www.instagram.com/fortis_healthcare/',
  'https://www.instagram.com/maxhealthcare/',
];
// Default X (Twitter) profiles to discover posts from when no URLs are supplied —
// India medical-tourism hospital accounts (X has no keyword discovery, profile only).
export const BRIGHTDATA_X_PROFILES = [
  'https://x.com/HospitalsApollo',
  'https://x.com/FortisHealthcare',
  'https://x.com/MaxHealthcare',
];

export function scoreIntent(text: string): { score: number; matched: string[] } {
  const t = (text || '').toLowerCase();
  const matched: string[] = [];
  let score = 0;
  for (const bucket of INTENT_KEYWORDS) {
    const hit = bucket.terms.find((term) => t.includes(term));
    if (hit) {
      score += bucket.weight;
      matched.push(hit);
    }
  }
  // Penalise completed-treatment / success-story content.
  const pastHit = PAST_SIGNALS.find((term) => t.includes(term));
  if (pastHit) {
    score -= 30;
    matched.push(`-${pastHit}`);
  }
  return { score: Math.max(0, Math.min(100, score)), matched };
}
