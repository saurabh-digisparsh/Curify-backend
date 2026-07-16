import { PaymentsService } from './payments.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
export declare class PaymentsController {
    private readonly service;
    constructor(service: PaymentsService);
    createOrder(dto: CreateOrderDto, req: any): Promise<{
        orderId: string;
        amount: number;
        currency: string;
        keyId: string;
        method: Record<string, boolean>;
    }>;
    verify(dto: VerifyPaymentDto, req: any): Promise<{
        status: string;
        bookingId: string;
    }>;
}
