import { StatsService } from './stats.service';
export declare class AdminStatsController {
    private readonly stats;
    constructor(stats: StatsService);
    overview(): Promise<{
        users: {
            total: number;
            byRole: Record<string, number>;
        };
        bookings: {
            total: number;
            byStatus: Record<string, number>;
        };
        catalog: {
            hospitals: number;
            surgeons: number;
            reviews: number;
            reports: number;
        };
        revenueUsd: number;
        recent: {
            bookings: {
                user: {
                    name: string;
                    email: string;
                };
                hospital: {
                    name: string;
                };
                id: string;
                createdAt: Date;
                status: import(".prisma/client").$Enums.BookingStatus;
                totalAmount: number;
                currency: string;
            }[];
            users: {
                id: string;
                name: string;
                email: string;
                role: import(".prisma/client").$Enums.Role;
                createdAt: Date;
            }[];
            scrapes: {
                id: string;
                createdAt: Date;
                status: import(".prisma/client").$Enums.ScrapeStatus;
                target: string;
                created: number;
                updated: number;
            }[];
        };
    }>;
    inserts(granularity?: string): Promise<{
        granularity: string;
        series: {
            bucket: string;
            label: string;
            hospitals: number;
            surgeons: number;
            reviews: number;
        }[];
    }>;
}
