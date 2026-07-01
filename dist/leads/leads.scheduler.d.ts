import { OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LeadsService } from './leads.service';
import { YouTubeService } from './youtube.service';
import { BrightDataService } from './brightdata.service';
export declare class LeadsScheduler implements OnApplicationBootstrap {
    private prisma;
    private leads;
    private yt;
    private brightData;
    private readonly logger;
    constructor(prisma: PrismaService, leads: LeadsService, yt: YouTubeService, brightData: BrightDataService);
    dailyRun(): Promise<void>;
    onApplicationBootstrap(): Promise<void>;
    runAll(trigger: string): Promise<void>;
    runAnalytics(trigger: string): Promise<void>;
    dailyAnalytics(): Promise<void>;
    private waitForLeadJobs;
    private sleep;
    private waitForNetwork;
    private todays2amIST;
    resetQuota(): Promise<void>;
}
