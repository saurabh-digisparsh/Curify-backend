import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { HospitalsService } from './hospitals.service';

// Data-heavy, scrape-prone endpoints: tighter than the global 120/min cap.
const DATA_THROTTLE = { default: { ttl: 60_000, limit: 30 } };

@ApiTags('Hospitals')
@Controller('hospitals')
export class HospitalsController {
  constructor(private hospitalsService: HospitalsService) {}

  @ApiOperation({ summary: 'Platform statistics (hospital count, reviews, patients)' })
  @Get('stats')
  getStats() {
    return this.hospitalsService.getStats();
  }

  @ApiOperation({ summary: 'Hospital metadata: available specialties and cities' })
  @Get('meta')
  getMeta() {
    return this.hospitalsService.getMeta();
  }

  @ApiOperation({ summary: 'Dispatch view: paginated hospitals with review aggregates' })
  @Throttle(DATA_THROTTLE)
  @Get('dispatch')
  getDispatch(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
  ) {
    return this.hospitalsService.getDispatch(
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
      search,
    );
  }

  @ApiOperation({ summary: 'Paginated comparison feed (city filter, sort, journey ranking)' })
  @Throttle(DATA_THROTTLE)
  @Get('comparison')
  getComparison(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('city') city?: string,
    @Query('sort') sort?: string,
    @Query('treatment') treatment?: string,
    @Query('urgency') urgency?: string,
    @Query('search') search?: string,
  ) {
    return this.hospitalsService.getComparison({
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
      city, sort, treatment, urgency, search,
    });
  }

  @ApiOperation({ summary: 'List all hospitals and surgeons' })
  @Throttle(DATA_THROTTLE)
  @Get()
  findAll() {
    return this.hospitalsService.findAll();
  }

  @ApiOperation({ summary: 'Get hospital details by ID' })
  @Throttle(DATA_THROTTLE)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.hospitalsService.findOne(id);
  }

  @ApiOperation({ summary: 'Get reviews for a hospital (paginated)' })
  @Throttle(DATA_THROTTLE)
  @Get(':id/reviews')
  getReviews(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.hospitalsService.getReviews(
      id,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 200,
    );
  }

  @ApiOperation({ summary: 'Rule-based hospital matching for a patient' })
  @Post('match')
  match(
    @Body() body: { diagnosis: string; treatment: string; country: string; urgency: string },
  ) {
    return this.hospitalsService.matchForPatient(body);
  }
}
