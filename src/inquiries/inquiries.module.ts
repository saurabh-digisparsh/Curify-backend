import { Module } from '@nestjs/common';
import { InquiriesController } from './inquiries.controller';
import { InquiriesService } from './inquiries.service';

@Module({
  controllers: [InquiriesController],
  providers: [InquiriesService],
  exports: [InquiriesService], // AuthModule uses markConverted() on signup
})
export class InquiriesModule {}
