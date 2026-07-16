export interface MirrorEntry {
    body: 'NABH' | 'JCI';
    name: string;
    city: string;
    identifier: string;
    validUntil: string | null;
}
export declare const ACCREDITATION_MIRROR: MirrorEntry[];
