import { AccreditationBody } from '@prisma/client';
export interface AccreditationHit {
    body: AccreditationBody;
    identifier: string;
    validUntil: Date | null;
    matchedName: string;
}
export declare class AccreditationService {
    lookup(name: string, city?: string): AccreditationHit[];
    verify(body: AccreditationBody, identifier?: string): {
        validUntil: Date;
    } | null;
}
