"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BRIGHTDATA_X_PROFILES = exports.BRIGHTDATA_IG_PROFILES = exports.BRIGHTDATA_COMMENTS_LIMIT = exports.BRIGHTDATA_REDDIT_COMMENTS_DATASET = exports.BRIGHTDATA_REDDIT_SORT = exports.BRIGHTDATA_REDDIT_DATE = exports.BRIGHTDATA_SERP_SITES = exports.FACEBOOK_GROUP_SEARCH_TERMS = exports.BRIGHTDATA_X_PHRASES = exports.BRIGHTDATA_HASHTAGS = exports.YT_KEYWORD_GROUP = exports.BRIGHTDATA_KEYWORDS = exports.SPAM_TERMS = exports.BRAND_TERMS = exports.PARTNER_TERMS = exports.MEDTOURISM_TERMS = exports.ORIGIN_TERMS = exports.COST_TERMS = exports.PROCEDURE_TERMS = exports.BRIGHTDATA_DATASETS = exports.BRIGHT_DATA_SERP_ZONE = exports.BRIGHT_DATA_CREDIT_CAP = exports.PAST_SIGNALS = exports.INTENT_KEYWORDS = exports.ALL_QUERY_GROUPS = exports.QUERY_GROUPS = exports.REGION_CONFIG = exports.AI_MIN_CONFIDENCE = exports.YT_VIDEOS_COST = exports.YT_SEARCH_COST = exports.YT_QUOTA_CAP = exports.YT_QUOTA_PCT = exports.YT_DAILY_QUOTA = void 0;
exports.regionFromCode = regionFromCode;
exports.hasPartnerSignal = hasPartnerSignal;
exports.scoreSignals = scoreSignals;
exports.isSpam = isSpam;
exports.serpTermsFor = serpTermsFor;
exports.scoreIntent = scoreIntent;
exports.YT_DAILY_QUOTA = parseInt(process.env.YOUTUBE_DAILY_QUOTA || '10000', 10);
exports.YT_QUOTA_PCT = parseFloat(process.env.YOUTUBE_QUOTA_PCT || '0.7');
exports.YT_QUOTA_CAP = Math.floor(exports.YT_DAILY_QUOTA * exports.YT_QUOTA_PCT);
exports.YT_SEARCH_COST = 100;
exports.YT_VIDEOS_COST = 1;
exports.AI_MIN_CONFIDENCE = 50;
exports.REGION_CONFIG = {
    USA: { label: 'USA', codes: ['US'], langs: ['en'] },
    MIDDLE_EAST: { label: 'Middle East', codes: ['AE', 'SA', 'QA', 'KW', 'OM', 'EG'], langs: ['en', 'ar'] },
    AFRICA: { label: 'Africa', codes: ['NG', 'KE', 'GH', 'ZA', 'TZ', 'UG'], langs: ['en'] },
};
exports.QUERY_GROUPS = {
    where_to_go: [
        'which country for medical treatment',
        'best country for surgery abroad',
        'where to get treatment abroad',
        'should i go abroad for surgery',
        'confused where to get treatment',
        'medical tourism which country is best',
    ],
    cant_afford: [
        "can't afford surgery",
        'surgery too expensive in my country',
        'no insurance need surgery help',
        'medical bills too high cannot pay',
        'cheaper treatment in another country',
        'cannot afford treatment what to do',
    ],
    pain_no_cure: [
        'chronic pain doctors can t help',
        'still in pain no cure',
        "can't find cure for my condition",
        'desperate for treatment no answers',
        'suffering no diagnosis need help',
        'long waiting list still in pain',
    ],
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
exports.ALL_QUERY_GROUPS = Object.keys(exports.QUERY_GROUPS);
exports.INTENT_KEYWORDS = [
    { weight: 35, terms: ['i need your', 'i need help', 'help me', 'has anyone', 'anyone been', 'anyone done', 'anyone got', 'anyone had', 'anyone has', "i'm looking for", 'i am looking for', 'looking for advice', 'need advice', 'any advice', 'need recommendations', 'any recommendations', 'any suggestions', 'any tips', 'should i', 'your experience', 'experience stories', 'reaching out', 'let me know', 'please let me know', 'please help'] },
    { weight: 25, terms: ['which country', 'where to', 'where can i', 'best country', 'should i go', 'confused', "don't know where", 'decide', 'options abroad', 'researching', 'research', 'considering', 'thinking about', 'looking into', 'planning'] },
    { weight: 25, terms: ["can't afford", 'cannot afford', 'too expensive', 'no insurance', 'without insurance', 'no health insurance', 'uninsured', 'unaffordable', 'cheaper', 'save money', 'medical bills', 'cost too high', "can't pay", 'us healthcare', 'healthcare costs', 'out of pocket'] },
    { weight: 25, terms: ['still in pain', 'chronic pain', 'no cure', 'no relief', 'no answers', 'no diagnosis', 'suffering', 'desperate', "doctors can't", "doctors can t", 'nothing works'] },
    { weight: 20, terms: ['abroad', 'overseas', 'another country', 'out of country', 'medical tourism', 'medicaltourism', 'health tourism', 'india', 'europe'] },
    { weight: 22, terms: ['vs india', 'india vs', 'vs thailand', 'vs turkey', 'vs mexico', 'or india', 'thailand', 'turkey', 'mexico', 'singapore', 'comparing', 'which is better', 'best destination', 'best country for', 'cheapest country'] },
    { weight: 12, terms: ['surgery', 'treatment', 'operation', 'procedure', 'transplant', 'replacement', 'therapy', 'condition', 'cancer', 'tumor', 'tumour', 'chemo', 'diagnosed', 'diagnosis'] },
    { weight: 8, terms: ['waiting list', 'long wait', 'waitlist', 'months wait', 'denied', 'refused'] },
];
const CODE_TO_REGION = {};
for (const [key, cfg] of Object.entries(exports.REGION_CONFIG)) {
    for (const code of cfg.codes)
        CODE_TO_REGION[code] = key;
}
function regionFromCode(code) {
    return (code && CODE_TO_REGION[code]) || 'OTHER';
}
exports.PAST_SIGNALS = [
    'my journey', 'my experience', 'my story', 'my results', 'my recovery',
    'after my', 'post op', 'post-op', 'months post', 'i got my', 'i had my',
    'before and after', 'transformation', 'successful', 'success story',
    'testimonial', 'patient from', 'comes to india', 'came to india',
    'flew to', 'went to india', 'shares', 'honest vlog', 'recovery update',
    'how it went', 'thank you doctor', 'here is my', "here's my",
];
exports.BRIGHT_DATA_CREDIT_CAP = parseInt(process.env.BRIGHT_DATA_CREDIT_CAP || '5000', 10);
exports.BRIGHT_DATA_SERP_ZONE = process.env.BRIGHT_DATA_SERP_ZONE || 'serp_api1';
exports.BRIGHTDATA_DATASETS = {
    REDDIT: { id: 'gd_lvz8ah06191smkebj4', mode: 'discover_keyword' },
    QUORA: { id: 'gd_lvz1rbj81afv3m6n5y', mode: 'url' },
    INSTAGRAM: { id: 'gd_lk5ns7kz21pck8jpis', mode: 'discover_url' },
    FACEBOOK: { id: 'gd_lz11l67o2cb3r0lkj3', mode: 'url' },
    X: { id: 'gd_lwxkxvnf1cynvib9co', mode: 'discover_profile_url' },
};
exports.PROCEDURE_TERMS = [
    'heart bypass', 'bypass surgery', 'cardiac', 'heart surgery', 'angioplasty',
    'open heart', 'valve replacement', 'pacemaker',
    'knee replacement', 'hip replacement', 'joint replacement',
    'liver transplant', 'kidney transplant', 'bone marrow transplant', 'stem cell transplant',
    'organ transplant', 'transplant', 'kidney failure', 'dialysis',
    'cancer', 'oncology', 'chemo', 'chemotherapy', 'tumor', 'tumour', 'immunotherapy',
    'proton therapy', 'car t', 'car-t', 'car-t cell', 'leukemia', 'lymphoma',
    'ivf', 'fertility', 'icsi', 'surrogacy',
    'bariatric', 'weight loss surgery', 'gastric',
    'spine surgery', 'spinal', 'neurosurgery', 'brain surgery', 'epilepsy', 'stroke',
    'hair transplant', 'dental', 'dental implant', 'cosmetic', 'plastic surgery',
    'eye surgery', 'lasik',
    'surgery', 'surgeries', 'treatment',
    'procedure', 'procedures', 'operation', 'medical service', 'medical services', 'medical procedure',
];
exports.COST_TERMS = [
    'cost', 'costs', 'price', 'how much', 'afford', 'affordable', 'cheap', 'cheaper',
    'expensive', 'budget', 'quote', 'estimate', 'package', 'charges', 'fees',
    'naira', 'cedi', 'shilling', 'aed', 'dirham', 'sar', 'riyal', 'qar', 'omr', 'bhd',
    'rupee', 'usd', 'dollar', 'pay', 'payment',
];
exports.ORIGIN_TERMS = [
    'oman', 'omani', 'uae', 'emirates', 'dubai', 'abu dhabi', 'saudi', 'saudi arabia',
    'riyadh', 'jeddah', 'qatar', 'qatari', 'doha', 'bahrain', 'kuwait', 'muscat', 'gcc',
    'nigeria', 'nigerian', 'kenya', 'kenyan', 'ghana', 'ghanaian', 'tanzania',
    'ethiopia', 'uganda', 'lagos', 'abuja', 'nairobi', 'accra',
    'south africa', 'zimbabwe', 'zambia', 'cameroon', 'rwanda', 'senegal', 'sudan', 'angola',
    'canada', 'canadian', 'usa', 'u.s.', 'united states', 'america', 'american',
    'uk', 'u.k.', 'united kingdom', 'britain', 'british', 'england', 'scotland',
    'australia', 'australian', 'ireland', 'irish', 'new zealand',
];
exports.MEDTOURISM_TERMS = [
    'medical tourism', 'health tourism', 'medical travel', 'medical value travel',
    'treatment abroad', 'surgery abroad', 'treatment overseas', 'treatment in india',
    'surgery in india', 'operation in india', 'hospital in india', 'medical visa',
    'going to india for', 'come to india for', 'flying to india', 'go abroad for treatment',
];
exports.PARTNER_TERMS = [
    'referral', 'referrals', 'commission', 'partnership', 'partner with', 'facilitator',
    'facilitators', 'agency', 'agencies', 'coordinator', 'mou', 'we send patients',
    'send patients to', 'patient pipeline', 'patient referral', 'looking for hospitals',
    'tie up', 'tie-up', 'empanelment', 'empanel', 'channel partner', 'b2b', 'collaborate',
    'collaboration', 'business partnership', 'refer patients', 'patient leads',
];
function hasPartnerSignal(text) {
    const t = (text || '').toLowerCase();
    return exports.PARTNER_TERMS.some((x) => t.includes(x));
}
exports.BRAND_TERMS = [
    'apollo', 'fortis', 'medanta', 'narayana', 'max hospital', 'max healthcare',
    'kokilaben', 'manipal', 'wockhardt', 'artemis', 'aster', 'amrita',
];
function scoreSignals(text) {
    const t = (text || '').toLowerCase();
    const procedures = exports.PROCEDURE_TERMS.filter((x) => t.includes(x));
    const origins = exports.ORIGIN_TERMS.filter((x) => t.includes(x));
    const partners = exports.PARTNER_TERMS.filter((x) => t.includes(x));
    const hasProcedure = procedures.length > 0;
    const hasCost = exports.COST_TERMS.some((x) => t.includes(x));
    const hasOrigin = origins.length > 0;
    const hasPartner = partners.length > 0;
    const hasMedTourism = exports.MEDTOURISM_TERMS.some((x) => t.includes(x)) || exports.BRAND_TERMS.some((x) => t.includes(x)) || /\bindia\b/.test(t);
    const signalCount = [hasProcedure, hasCost, hasOrigin].filter(Boolean).length;
    const temperature = signalCount >= 3 ? (hasMedTourism ? 'hot-corridor' : 'hot-generic')
        : signalCount === 2 ? 'warm' : 'cold';
    const intentScore = Math.min(100, (hasProcedure ? 35 : 0) + (hasCost ? 25 : 0) + (hasOrigin ? 25 : 0) +
        (hasMedTourism ? 15 : 0) + (hasPartner ? 25 : 0));
    return { hasProcedure, hasCost, hasOrigin, hasMedTourism, hasPartner, partners, signalCount, temperature, procedures, origins, intentScore };
}
exports.SPAM_TERMS = [
    'proctored', 'online class', 'online classes', 'homework', 'ace your', 'ace my',
    'take my exam', 'do my exam', 'do your exam', 'exam help', 'pass your exam',
    'assignment help', 'write my', 'essay help', 'dissertation', 'coursework',
    'pay someone', 'nursing class', 'nursing classes', 'boost your gpa',
    'guaranteed grades', 'free websites', 'hire us', 'we will do your',
];
function isSpam(text) {
    const t = (text || '').toLowerCase();
    return exports.SPAM_TERMS.some((s) => t.includes(s));
}
exports.BRIGHTDATA_KEYWORDS = [
    'medical tourism', 'medical tourism india', 'medical travel', 'medical travel india',
    'treatment in india', 'travel for treatment', 'treatment abroad', 'going to india for surgery',
    'need treatment in india', 'affordable surgery abroad', 'affordable surgery india',
    'overseas medical treatment', 'hospital abroad for treatment', 'medical trip abroad',
    'second opinion abroad', 'second opinion india hospital', 'india medical visa', 'medical visa india',
    'health tourism', 'healthcare tourism', 'healthcare abroad', 'cross border healthcare', 'international patients',
    'medical travel agency', 'medical travel facilitator', 'medical concierge',
    'international patient coordinator', 'healthcare concierge', 'medical tourism consultant',
    'medical tourism partnership', 'patient referral india', 'hospital referral program india',
    'medical tourism agent wanted', 'medical travel agent commission', 'medical tourism facilitator wanted',
    'medical tourism tie up india',
    'india medical tourism', 'international patient india', 'best hospitals in india', 'affordable treatment india',
    'jci accredited hospitals india', 'nabh hospital india', 'medical packages india',
    'indian hospitals for foreigners', 'india treatment cost', 'india treatment cost vs usa',
    'india treatment cost vs uk', 'india treatment cost vs europe', 'india healthcare', 'india hospitals',
    'apollo hospitals international patients', 'fortis hospitals international patients',
    'medanta hospital international patients', 'narayana health international patients',
    'max hospital international patients', 'kokilaben hospital international patients',
    'manipal hospitals international patients', 'wockhardt hospital international patients',
    'cancer treatment india', 'cancer treatment india cost', 'cancer hospital india',
    'cancer treatment in india affordable', 'bone marrow transplant india', 'bone marrow transplant cost india',
    'stem cell transplant india', 'proton therapy india', 'car t cell therapy india',
    'leukemia treatment india', 'lymphoma treatment india', 'breast cancer treatment india',
    'cervical cancer treatment india', 'liver cancer treatment india', 'lung cancer treatment india',
    'cardiac surgery india', 'heart surgery india', 'heart bypass surgery india', 'open heart surgery india',
    'valve replacement surgery india', 'angioplasty india', 'pacemaker surgery india',
    'kidney transplant india', 'kidney transplant cost india', 'liver transplant india',
    'liver transplant cost india', 'organ transplant india', 'kidney failure treatment india',
    'knee replacement india', 'knee replacement cost india', 'hip replacement india',
    'spinal surgery india', 'spine surgery india cost', 'joint replacement india',
    'brain surgery india', 'neurosurgery india', 'epilepsy treatment india', 'stroke treatment india',
    'ivf treatment india', 'ivf cost india', 'fertility treatment india', 'surrogacy india',
    'dialysis india', 'bariatric surgery india', 'weight loss surgery india', 'cosmetic surgery india',
    'plastic surgery india', 'eye surgery india', 'lasik india', 'dental treatment india', 'dental implants india',
    'medical tourism uae', 'medical tourism dubai', 'medical travel dubai', 'treatment in india from dubai',
    'dubai to india medical tourism', 'medical tourism abu dhabi', 'treatment abroad from uae',
    'cancer treatment india from uae', 'kidney transplant from dubai', 'arabic speaking hospital india',
    'hindi speaking doctor india', 'indian expat treatment india', 'indian expat hospital india',
    'gcc patients india hospital',
    'medical tourism saudi arabia', 'treatment in india from saudi arabia', 'treatment in india from riyadh',
    'treatment in india from jeddah', 'saudi patients india hospital', 'affordable treatment saudi arabia',
    'medical tourism kuwait', 'medical tourism qatar', 'medical tourism bahrain', 'medical tourism oman',
    'treatment in india from kuwait', 'treatment in india from qatar', 'treatment in india from muscat',
    'treatment in india from doha',
    'medical tourism africa', 'medical tourism nigeria', 'medical tourism kenya', 'medical tourism ghana',
    'medical tourism uganda', 'medical tourism tanzania', 'medical tourism ethiopia',
    'africa to india medical tourism', 'india hospital africa', 'treatment in india africa',
    'nigerian patients india', 'africa to india treatment', 'affordable surgery india nigeria',
    'affordable surgery india kenya', 'cancer treatment india from africa', 'cancer treatment india nigeria',
    'medical tourism south africa', 'medical tourism zimbabwe', 'medical tourism zambia',
    'medical tourism cameroon', 'medical tourism rwanda', 'medical tourism senegal',
    'medical tourism sudan', 'medical tourism angola', 'treatment in india from africa',
    'south africa to india medical treatment',
];
exports.YT_KEYWORD_GROUP = 'medtourism_keywords';
exports.QUERY_GROUPS[exports.YT_KEYWORD_GROUP] = exports.BRIGHTDATA_KEYWORDS;
exports.BRIGHTDATA_HASHTAGS = [
    '#MedicalTourism', '#MedicalTourismIndia', '#MedicalTravel', '#MedicalTravelIndia',
    '#HealthcareTourism', '#HealthTourism', '#MedicalVisa', '#MedicalVisaIndia',
    '#TreatmentInIndia', '#TreatmentAbroad', '#MedicalAbroad', '#MedicalTrip',
    '#TravelForTreatment', '#HealthTravel',
    '#IndiaHealthcare', '#InternationalPatients', '#HospitalInIndia', '#HealthcareIndia',
    '#IndiaHospital', '#PatientInIndia', '#AffordableHealthcareIndia', '#AffordableHealthcare',
    '#AffordableSurgery',
    '#MedicalFacilitator', '#MedicalConcierge', '#HealthcareConcierge', '#PatientJourney',
    '#PatientExperience', '#MedicalTourismConsultant', '#MedicalTourismAgency',
    '#InternationalPatientCoordinator',
    '#CancerTreatmentIndia', '#HeartSurgeryIndia', '#CardiacSurgeryIndia', '#KidneyTransplantIndia',
    '#LiverTransplantIndia', '#OrganTransplantIndia', '#BoneMarrowTransplantIndia',
    '#KneeReplacementIndia', '#SpineSurgeryIndia', '#IVFIndia', '#FertilityTreatmentIndia',
    '#BariatricSurgeryIndia',
    '#ApolloHospitals', '#FortisHospitals', '#MedantaHospital', '#NarayanaHealth', '#MaxHospital',
    '#HealthTravelUAE', '#MedicalTourismDubai', '#MedicalTourismUAE', '#DubaiToIndia',
    '#UAEPatients', '#SaudiPatients',
    '#MedicalTourismAfrica', '#MedicalTourismNigeria', '#MedicalTourismKenya', '#NigeriaToIndia',
    '#KenyaToIndia', '#AfricaToIndia', '#MedicalTourismGhana', '#AfricanPatientsIndia',
];
exports.BRIGHTDATA_X_PHRASES = [
    '"medical tourism india"', '"treatment in india"', '"going to india for surgery"',
    '"need treatment in india"', '"looking for hospital in india"', '"anyone recommend hospital in india"',
    '"best hospital india for"', '"affordable surgery india"', '"cancer treatment india"',
    '"cardiac surgery india"', '"kidney transplant india"', '"medical visa india"',
    '"second opinion india"', '"india treatment cost"',
    '"treatment in india from dubai"', '"treatment in india from uae"', '"treatment in india from saudi"',
    '"treatment in india from riyadh"', '"dubai to india medical"', '"india hospital from uae"',
    '"treatment in india from nigeria"', '"treatment in india from kenya"', '"nigeria to india treatment"',
    '"kenya to india hospital"', '"africa to india medical"',
    'medical tourism india experience', 'medical travel india review', 'hospital india recommendation',
    'best cancer hospital india', 'affordable heart surgery india', 'knee replacement cost india',
    'liver transplant india cost', 'IVF treatment india', 'spine surgery india', 'bariatric surgery india',
    '"medical tourism partnership"', '"patient referral india"', '"hospital referral program"',
    '"medical tourism facilitator"', '"medical tourism agent"', '"international patient coordinator"',
    '"medical tourism MOU"', '"we send patients to india"', '"medical tourism commission"',
    'medical tourism agency india partnership', 'patient referral program india hospitals',
    'medical travel facilitator india tie up', 'hospital empanelment india international',
];
exports.FACEBOOK_GROUP_SEARCH_TERMS = [
    'medical tourism india', 'india treatment group', 'international patients india',
    'treatment abroad support', 'medical travel community', 'india hospital patients',
    'cancer treatment india support', 'organ transplant india', 'medical tourism support group',
    'affordable healthcare abroad',
    'africa india health travel', 'dubai india medical', 'GCC patients india',
    'Arabs in India hospital', 'medical tourism UAE group', 'medical tourism saudi group',
    'Nigerians in India medical', 'Kenyans medical treatment abroad', 'Africans seeking treatment india',
    'medical tourism Africa group', 'Nigeria india treatment community',
    'Indian expat health india', 'medical treatment abroad community',
    'patients seeking treatment india', 'international patient support india',
];
exports.BRIGHTDATA_SERP_SITES = {
    QUORA: 'quora.com', X: 'x.com', INSTAGRAM: 'instagram.com', FACEBOOK: 'facebook.com',
};
function serpTermsFor(platform) {
    if (platform === 'X')
        return exports.BRIGHTDATA_X_PHRASES;
    if (platform === 'INSTAGRAM')
        return exports.BRIGHTDATA_HASHTAGS;
    return exports.BRIGHTDATA_KEYWORDS;
}
exports.BRIGHTDATA_REDDIT_DATE = 'Past month';
exports.BRIGHTDATA_REDDIT_SORT = 'New';
exports.BRIGHTDATA_REDDIT_COMMENTS_DATASET = 'gd_lvzdpsdlw09j6t702';
exports.BRIGHTDATA_COMMENTS_LIMIT = 50;
exports.BRIGHTDATA_IG_PROFILES = [
    'https://www.instagram.com/apollohospitals/',
    'https://www.instagram.com/fortis_healthcare/',
    'https://www.instagram.com/maxhealthcare/',
];
exports.BRIGHTDATA_X_PROFILES = [
    'https://x.com/HospitalsApollo',
    'https://x.com/FortisHealthcare',
    'https://x.com/MaxHealthcare',
];
function scoreIntent(text) {
    const t = (text || '').toLowerCase();
    const matched = [];
    let score = 0;
    for (const bucket of exports.INTENT_KEYWORDS) {
        const hit = bucket.terms.find((term) => t.includes(term));
        if (hit) {
            score += bucket.weight;
            matched.push(hit);
        }
    }
    const pastHit = exports.PAST_SIGNALS.find((term) => t.includes(term));
    if (pastHit) {
        score -= 30;
        matched.push(`-${pastHit}`);
    }
    return { score: Math.max(0, Math.min(100, score)), matched };
}
//# sourceMappingURL=leads.config.js.map