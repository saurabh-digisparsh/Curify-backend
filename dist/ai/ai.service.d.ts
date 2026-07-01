export declare class AiService {
    private readonly primary;
    private readonly fallback;
    constructor();
    private chat;
    analyzeReport(params: {
        fileBase64?: string;
        fileType?: string;
        reportText?: string;
        description?: string;
        treatment?: string;
        country?: string;
        urgency?: string;
    }): Promise<any>;
    private mockAnalysis;
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
    }[]): Promise<Record<string, {
        category: 'LEAD' | 'PARTNER' | 'MARKETING' | 'NEWS' | 'OTHER';
        reason: string;
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
    generateTripPlan(params: {
        hospital: any;
        surgeon: any;
        diagnosis: string;
        treatment: string;
        country: string;
    }): Promise<any>;
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
