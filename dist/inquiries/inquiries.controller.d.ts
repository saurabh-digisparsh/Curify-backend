import { InquiriesService } from './inquiries.service';
import { UpsertInquiryDto } from './dto/upsert-inquiry.dto';
export declare class InquiriesController {
    private svc;
    constructor(svc: InquiriesService);
    upsert(dto: UpsertInquiryDto): Promise<{
        ok: boolean;
        id: any;
    }>;
}
