import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
export declare class FamilyDashboardService {
    private prisma;
    private ai;
    constructor(prisma: PrismaService, ai: AiService);
    getFamilyStatus(bookingId: string): Promise<{
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
    private getDemoState;
    getUpdates(params: {
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
