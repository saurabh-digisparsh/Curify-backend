import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export const SCRAPE_TARGETS = ['full', 'jci', 'reviews', 'foreign-pipeline', 'surgeons', 'surgeon-reviews', 'prices'] as const;
export type ScrapeTarget = (typeof SCRAPE_TARGETS)[number];

export class TriggerScrapeDto {
  @ApiProperty({ enum: SCRAPE_TARGETS, example: 'jci' })
  @IsIn(SCRAPE_TARGETS as unknown as string[])
  target: ScrapeTarget;

  @ApiProperty({ required: false, example: 'Chennai', description: 'Filter by city/location' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ required: false, example: 'Apollo', description: 'Filter by hospital name' })
  @IsOptional()
  @IsString()
  hospitalName?: string;

  @ApiProperty({ required: false, example: 'africa', description: 'Source region for foreign reviews' })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiProperty({ required: false, example: 5, description: 'Minimum foreign reviews to collect before stopping' })
  @IsOptional()
  minReviews?: number;
}

/**
 * Body for the all-hospitals sweep: every field optional, since the routine trigger
 * posts nothing and only a link-backfill run needs to raise `minReviews`.
 */
export class ScrapeAllDto extends PartialType(TriggerScrapeDto) {}
