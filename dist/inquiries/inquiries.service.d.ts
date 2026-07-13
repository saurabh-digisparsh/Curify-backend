import { PrismaService } from '../prisma/prisma.service';
import { UpsertInquiryDto } from './dto/upsert-inquiry.dto';
export declare class InquiriesService {
    private prisma;
    constructor(prisma: PrismaService);
    upsert(dto: UpsertInquiryDto): Promise<{
        ok: boolean;
        id: any;
    }>;
    markConverted(email: string, userId: string): Promise<void>;
    private definedOnly;
}
