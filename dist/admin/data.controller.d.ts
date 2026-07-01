import { DataService } from './data.service';
export declare class AdminDataController {
    private readonly data;
    constructor(data: DataService);
    resources(): {
        slug: string;
        label: string;
        group: string;
    }[];
    list(resource: string, q?: string, skip?: string, take?: string): Promise<{
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
