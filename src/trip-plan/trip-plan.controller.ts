import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TripPlanService } from './trip-plan.service';

@ApiTags('Trip Plan')
@Controller('trip-plan')
export class TripPlanController {
  constructor(private service: TripPlanService) {}

  @ApiOperation({ summary: 'Get trip plan template for procedure + destination' })
  @Get('template')
  getTemplate(
    @Query('procedure') procedure: string,
    @Query('destination') destination: string,
  ) {
    return this.service.getTemplate(procedure ?? '', destination ?? '');
  }

  @ApiOperation({ summary: 'Get flight options for a route' })
  @Get('flights')
  getFlights(
    @Query('origin') origin: string,
    @Query('destination') destination: string,
  ) {
    return this.service.getFlights(origin ?? '', destination ?? '');
  }

  @ApiOperation({ summary: 'Get all insurance plans' })
  @Get('insurance')
  getInsurance() {
    return this.service.getInsurance();
  }

  @ApiOperation({ summary: 'Generate a personalized medical trip plan' })
  @Post()
  generate(
    @Body() body: {
      hospitalId: string; diagnosis: string; treatment: string; country: string;
      departureCity?: string; travelDate?: string; travelers?: number; stayNights?: number;
      passport?: string; visaHelp?: string; accommodation?: string; notes?: string;
    },
  ) {
    return this.service.generate(body);
  }
}
