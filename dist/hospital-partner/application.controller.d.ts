import type { Request } from 'express';
import { PartnerService } from './partner.service';
import { ApplyDto, ContactDto, VerifyOtpDto, AccreditationDto, UploadDocDto, AgreementDto } from './dto/partner.dto';
export declare class ApplicationController {
    private readonly svc;
    constructor(svc: PartnerService);
    apply(dto: ApplyDto): Promise<{
        id: string;
        sessionToken: string;
        status: import(".prisma/client").$Enums.OnboardingStatus;
    }>;
    get(id: string, token: string): Promise<any>;
    contact(id: string, token: string, dto: ContactDto): Promise<{
        sent: boolean;
    }>;
    resend(id: string, token: string): Promise<{
        sent: boolean;
    }>;
    verify(id: string, token: string, dto: VerifyOtpDto): Promise<{
        emailVerified: boolean;
        whatsappVerified: boolean;
        bothVerified: boolean;
    }>;
    lookupAccreditation(id: string, token: string): Promise<any>;
    accreditation(id: string, token: string, dto: AccreditationDto): Promise<any>;
    notAccredited(id: string, token: string): Promise<any>;
    upload(id: string, token: string, file: Express.Multer.File, dto: UploadDocDto): Promise<any>;
    removeDoc(id: string, docId: string, token: string): Promise<any>;
    agreement(id: string, token: string, dto: AgreementDto, req: Request): Promise<any>;
    provision(id: string, token: string): Promise<{
        provisioned: boolean;
        loginId: string;
    }>;
}
