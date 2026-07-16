import { IsIn, IsOptional, IsString } from 'class-validator';

// The client never sends an amount — the server prices the plan (see PLAN_PRICES
// in payments.service). It only names what it wants to buy and how it wants to pay.
export class CreateOrderDto {
  @IsString()
  @IsIn(['ESSENTIAL', 'COMFORT', 'PREMIUM'])
  plan!: string;

  @IsString()
  hospitalId!: string;

  @IsOptional()
  @IsString()
  reportId?: string;

  // Which method group to expose in Checkout (international patients, USD):
  //   'tabby' = Gulf BNPL, 'card' = international cards + wallets, 'all' = everything enabled.
  @IsOptional()
  @IsIn(['tabby', 'card', 'all'])
  methodGroup?: 'tabby' | 'card' | 'all';
}
