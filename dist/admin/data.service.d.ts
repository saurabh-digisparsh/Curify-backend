import { PrismaService } from '../prisma/prisma.service';
export declare class DataService {
    private prisma;
    constructor(prisma: PrismaService);
    resources(): {
        slug: string;
        label: string;
        group: string;
    }[];
    private model;
    list(resource: string, opts: {
        q?: string;
        skip?: number;
        take?: number;
    }): Promise<{
        items: any;
        total: any;
        skip: number;
        take: number;
    }>;
    getOne(resource: string, id: string): Promise<any>;
    create(resource: string, body: Record<string, any>): Promise<any>;
    update(resource: string, id: string, body: Record<string, any>): Promise<any>;
    remove(resource: string, id: string): Promise<{
        deleted: boolean;
        resource: string;
        id: string;
    }>;
}
