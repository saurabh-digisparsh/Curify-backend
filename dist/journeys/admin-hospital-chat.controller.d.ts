import { JourneysService } from './journeys.service';
export declare class AdminHospitalChatController {
    private service;
    constructor(service: JourneysService);
    list(): Promise<{
        journeyId: string;
        patient: any;
        hospital: string;
        treatment: string;
        messageCount: number;
        lastMessage: string;
        lastAt: string;
        awaitingReply: boolean;
    }[]>;
    one(journeyId: string): Promise<{
        messages: import("./journeys.service").ChatMsg[];
        patient: any;
        treatment: string;
    }>;
    reply(journeyId: string, body: {
        body?: string;
        kind?: any;
        amountUsd?: number;
    }): Promise<{
        messages: import("./journeys.service").ChatMsg[];
    }>;
}
