import { PaymentsService } from './payments.service';
export declare class WebhooksController {
    private readonly service;
    constructor(service: PaymentsService);
    webhook(req: any): Promise<{
        ignored: boolean;
        duplicate?: undefined;
        ok?: undefined;
    } | {
        duplicate: boolean;
        ignored?: undefined;
        ok?: undefined;
    } | {
        ok: boolean;
        ignored?: undefined;
        duplicate?: undefined;
    }>;
}
