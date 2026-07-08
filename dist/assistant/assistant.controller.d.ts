import { AiService } from '../ai/ai.service';
export declare class AssistantController {
    private ai;
    constructor(ai: AiService);
    chat(body: {
        messages?: {
            role: 'user' | 'assistant';
            content: string;
        }[];
        language?: string;
    }): Promise<any>;
    analyze(body: {
        description?: string;
        treatment?: string;
        country?: string;
        urgency?: string;
    }): Promise<any>;
    parseDate(body: {
        text?: string;
    }): Promise<{
        date: string;
        urgent: boolean;
    }>;
    translateUi(body: {
        language?: string;
        strings?: Record<string, string>;
    }): Promise<Record<string, string>>;
}
