import { FamilyDashboardService } from './family-dashboard.service';
export declare class FamilyDashboardController {
    private service;
    constructor(service: FamilyDashboardService);
    getFamilyStatus(bookingId: string, req: any): Promise<{
        bookingId: string;
        hospitalName: string;
        city: string;
        currentStatus: string;
        estimatedNext: string;
        milestones: {
            id: string;
            label: string;
            done: boolean;
            active: boolean;
            sequence: number;
        }[];
        updates: {
            id: string;
            status: string;
            message: string;
            icon: string;
            time: string;
        }[];
        contacts: {
            label: string;
            value: string;
            type: string;
        }[];
        source: string;
    }>;
    getUpdates(body: {
        procedure: string;
        hospital: string;
        surgeon: string;
        stage: string;
    }): Promise<{
        bookingId: string;
        hospitalName: string;
        city: string;
        currentStatus: string;
        estimatedNext: string;
        milestones: {
            id: string;
            label: string;
            done: boolean;
            active: boolean;
            sequence: number;
        }[];
        updates: {
            id: string;
            status: string;
            message: string;
            icon: string;
            time: string;
        }[];
        contacts: {
            label: string;
            value: string;
            type: string;
        }[];
        source: string;
    }>;
}
