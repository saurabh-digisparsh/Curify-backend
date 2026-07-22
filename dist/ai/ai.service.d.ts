export declare class AiService {
    private readonly primary;
    private readonly fallback;
    constructor();
    private chat;
    assistantChat(params: {
        messages: {
            role: 'user' | 'assistant';
            content: string;
        }[];
        language?: string;
    }): Promise<any>;
    classifyTreatment(params: {
        text: string;
        catalog: {
            slug: string;
            label: string;
            specialty: string | null;
        }[];
    }): Promise<{
        slug: string | null;
        label: string;
        specialty: string | null;
    }>;
    parseTravelDate(params: {
        text: string;
    }): Promise<{
        date: string | null;
    }>;
    translateUi(params: {
        language: string;
        strings: Record<string, string>;
    }): Promise<Record<string, string>>;
    analyzeReport(params: {
        fileBase64?: string;
        fileType?: string;
        files?: {
            base64: string;
            type: string;
        }[];
        reportText?: string;
        description?: string;
        treatment?: string;
        country?: string;
        urgency?: string;
    }): Promise<any>;
    private static readonly BANDS;
    private scoreReport;
    generateStayOrGo(params: {
        diagnosis: string;
        country: string;
        treatment: string;
        urgency: string;
    }): Promise<any>;
    localizeReview(text: string): Promise<{
        lang: string;
        isEnglish: boolean;
        english: string;
        native: string;
    }>;
    classifyLeads(candidates: {
        id: string;
        title: string;
        description?: string;
    }[]): Promise<Record<string, {
        isLead: boolean;
        confidence: number;
        persona: string | null;
        alreadyTreated: boolean;
        procedure: string | null;
        summary: string;
    }>>;
    classifyCategories(items: {
        id: string;
        platform?: string;
        title?: string | null;
        body?: string | null;
    }[], examples?: {
        text: string;
        category: string;
        reason?: string;
    }[], temperature?: number): Promise<Record<string, {
        category: 'LEAD' | 'PARTNER' | 'MARKETING' | 'NEWS' | 'OTHER';
        reason: string;
        confidence: number;
    }>>;
    analyzeTranscript(input: {
        title: string;
        description?: string;
        transcript: string;
    }): Promise<{
        isLead: boolean;
        score: number;
        confidence: number;
        persona: string | null;
        alreadyTreated: boolean;
        procedure: string | null;
        originCountry: string | null;
        summary: string;
    }>;
    generateHospitalEnrichment(params: {
        name: string;
        city: string;
        country: string;
        overallRating?: number | null;
        jciAccredited?: boolean;
        reviews: {
            text: string;
            rating?: number | null;
            nationality?: string | null;
        }[];
    }): Promise<any>;
    matchHospitals(params: {
        diagnosis: string;
        treatment: string;
        country: string;
        urgency: string;
        hospitals: any[];
    }): Promise<any>;
    enrichTripTips(params: {
        hospitalName: string;
        city: string;
        treatment: string;
        country: string;
        stayNights?: number;
    }): Promise<{
        travelTips?: string[];
        insuranceAlert?: {
            type: string;
            text: string;
            recommendation: string;
        };
    }>;
    generateRecoveryPlan(params: {
        diagnosis: string;
        treatment: string;
        hospital: string;
        surgeon: string;
    }): Promise<any>;
    generateFamilyUpdates(params: {
        procedure: string;
        hospital: string;
        surgeon: string;
        stage: string;
    }): Promise<any>;
}
