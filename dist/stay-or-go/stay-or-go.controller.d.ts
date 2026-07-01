import { StayOrGoService } from './stay-or-go.service';
export declare class StayOrGoController {
    private service;
    constructor(service: StayOrGoService);
    analyze(body: {
        diagnosis: string;
        country: string;
        treatment: string;
        urgency: string;
    }): Promise<any>;
}
