import { RecoveryService } from './recovery.service';
export declare class RecoveryController {
    private service;
    constructor(service: RecoveryService);
    generate(body: {
        diagnosis: string;
        treatment: string;
        hospital: string;
        surgeon: string;
    }): Promise<any>;
}
