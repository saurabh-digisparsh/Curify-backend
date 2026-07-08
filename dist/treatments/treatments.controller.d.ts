import { TreatmentsService } from './treatments.service';
import { ClassifyTreatmentDto } from './dto/classify-treatment.dto';
export declare class TreatmentsController {
    private svc;
    constructor(svc: TreatmentsService);
    list(): import(".prisma/client").Prisma.PrismaPromise<{
        slug: string;
        label: string;
        specialty: string;
    }[]>;
    classify(dto: ClassifyTreatmentDto): Promise<{
        matched: boolean;
        created: boolean;
        slug: string;
        label: string;
        specialty: string;
    }>;
}
