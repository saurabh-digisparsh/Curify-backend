import { IsInt, IsOptional, IsString, Min } from 'class-validator';

// Returned by Razorpay Checkout's success handler, plus the booking context we
// need to confirm. The amount is NOT here — it was fixed server-side at order time.
export class VerifyPaymentDto {
  @IsString() razorpay_order_id!: string;
  @IsString() razorpay_payment_id!: string;
  @IsString() razorpay_signature!: string;

  // Optional: the server re-reads the real context from the Payment's own notes
  // (set at order time), so this is only ever a hint. Teleconsult top-ups have no
  // hospital at all, hence not required.
  @IsOptional() @IsString() hospitalId?: string;

  @IsOptional() @IsString() reportId?: string;

  // BNPL instalment context, if the provider/plan split the amount.
  @IsOptional() @IsInt() @Min(0) downPayment?: number;
  @IsOptional() @IsInt() @Min(1) installments?: number;
}
