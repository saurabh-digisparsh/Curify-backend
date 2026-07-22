import { Body, Controller, Param, Post, Request, UseGuards } from '@nestjs/common';
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

  @ApiOperation({ summary: 'Create a Razorpay order for a held (beyond-free-allowance) consult' })
  @Post('teleconsult/:teleconsultId/order')
  createTeleconsultOrder(@Param('teleconsultId') teleconsultId: string, @Request() req) {
    // No body: the fee is the admin-set TELECONSULT_FEE and ownership is checked
    // against the consult itself, so there is nothing for the client to supply.
    return this.service.createTeleconsultOrder(req.user.id, teleconsultId);
  }

  @ApiOperation({ summary: 'Verify payment signature and confirm the booking' })
  @Post('verify')
  verify(@Body() dto: VerifyPaymentDto, @Request() req) {
    return this.service.verify(req.user.id, dto);
  }
}
