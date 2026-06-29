import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RecoveryService } from './recovery.service';

@ApiTags('Recovery')
@Controller('recovery')
export class RecoveryController {
  constructor(private service: RecoveryService) {}

  @ApiOperation({ summary: 'Generate a post-treatment recovery plan' })
  @Post()
  generate(
    @Body() body: { diagnosis: string; treatment: string; hospital: string; surgeon: string },
  ) {
    return this.service.generate(body);
  }
}
