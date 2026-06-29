import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { StayOrGoService } from './stay-or-go.service';

@ApiTags('Stay or Go')
@Controller('stay-or-go')
export class StayOrGoController {
  constructor(private service: StayOrGoService) {}

  @ApiOperation({ summary: 'AI analysis: treat at home vs travel to India' })
  @Post()
  analyze(
    @Body() body: { diagnosis: string; country: string; treatment: string; urgency: string },
  ) {
    return this.service.analyze({
      diagnosis: body.diagnosis || '',
      country: body.country || 'Nigeria',
      treatment: body.treatment || '',
      urgency: body.urgency || 'flexible',
    });
  }
}
