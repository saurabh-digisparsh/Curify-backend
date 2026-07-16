import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaymentsService } from './payments.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';

// Checkout endpoints. Both are authenticated + implicitly ownership-scoped: the
// order is stamped with req.user.id and verify only accepts orders owned by the caller.
@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @ApiOperation({ summary: 'Create a Razorpay order for a plan (server-priced)' })
  @Post('order')
  createOrder(@Body() dto: CreateOrderDto, @Request() req) {
    return this.service.createOrder(req.user.id, dto);
  }

  @ApiOperation({ summary: 'Verify payment signature and confirm the booking' })
  @Post('verify')
  verify(@Body() dto: VerifyPaymentDto, @Request() req) {
    return this.service.verify(req.user.id, dto);
  }
}
