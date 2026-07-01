import { OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScrapeService } from './scrape.service';
export declare class ScrapeScheduler implements OnApplicationBootstrap {
    private prisma;
    private scrape;
    private readonly logger;
    constructor(prisma: PrismaService, scrape: ScrapeService);
    dailyRun(): Promise<void>;
    onApplicationBootstrap(): Promise<void>;
    private todays2amIST;
}
