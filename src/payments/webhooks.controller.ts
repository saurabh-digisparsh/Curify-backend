import { Controller, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';

// PUBLIC endpoint — authenticated by Razorpay's HMAC signature, not JWT. It reads
// the exact raw bytes (main.ts rawBody:true) so the signature check matches what
// Razorpay signed. Never trust the body before validateWebhookSignature passes.
@ApiTags('Payments')
@Controller('payments')
export class WebhooksController {
  constructor(private readonly service: PaymentsService) {}

  @ApiOperation({ summary: 'Razorpay webhook (payment.captured, refunds, disputes)' })
  @Post('webhook')
  webhook(@Req() req: any) {
    const raw: string = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body);
    return this.service.handleWebhook(
      raw,
      req.headers['x-razorpay-signature'],
      req.headers['x-razorpay-event-id'],
    );
  }
}
