import { TreatmentsService } from './treatments.service';
import { ClassifyTreatmentDto } from './dto/classify-treatment.dto';
export declare class TreatmentsController {
    private svc;
    constructor(svc: TreatmentsService);
    list(): import(".prisma/client").Prisma.PrismaPromise<{
        specialty: string;
        slug: string;
        label: string;
    }[]>;
    classify(dto: ClassifyTreatmentDto): Promise<{
        matched: boolean;
        created: boolean;
        specialty: string;
        slug: string;
        label: string;
    }>;
}
