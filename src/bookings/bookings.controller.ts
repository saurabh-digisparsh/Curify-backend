import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { BookingsService } from './bookings.service';

@ApiTags('Bookings')
@Controller('bookings')
export class BookingsController {
  constructor(private service: BookingsService) {}

  @ApiOperation({ summary: 'Create a new booking after payment' })
  @Post()
  create(@Body() body: {
    userId?: string;
    reportId?: string;
    hospitalId: string;
    plan?: string;
    totalAmount?: number;
    currency?: string;
    paymentRef?: string;
  }) {
    return this.service.create(body);
  }

  @ApiOperation({ summary: 'Get booking by ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }
}
