import { JourneysService } from './journeys.service';
export declare class PublicTrackingController {
    private service;
    constructor(service: JourneysService);
    track(id: string): Promise<{
        treatment: string;
        procedure: any;
        homeCountry: string;
        departureCity: any;
        travelDate: any;
        hospitalName: string;
        hospitalCity: any;
        hospitalPhone: string;
        hospitalEmail: string;
        step: string;
        status: string;
    }>;
}
