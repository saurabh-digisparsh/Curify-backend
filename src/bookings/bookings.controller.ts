import { Controller, Post, Body, Get, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

// Bookings link a patient to a hospital, report, surgery dates and payment —
// authenticated + ownership-scoped only.
@ApiTags('Bookings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private service: BookingsService) {}

  @ApiOperation({ summary: 'Create a new booking after payment' })
  @Post()
  create(
    @Body() body: {
      reportId?: string;
      hospitalId: string;
      plan?: string;
      totalAmount?: number;
      currency?: string;
      paymentRef?: string;
    },
    @Request() req,
  ) {
    // The booking is owned by the authenticated user; a client-supplied userId
    // is ignored so a caller cannot create bookings for someone else.
    return this.service.create({ ...body, userId: req.user.id });
  }

  @ApiOperation({ summary: 'Get booking by ID (owner or admin only)' })
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.service.findOne(id, req.user.id, req.user.role === 'ADMIN');
  }
}
