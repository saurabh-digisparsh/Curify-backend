import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ThrottlerGuard,
  ThrottlerStorage,
  ThrottlerLimitDetail,
  InjectThrottlerOptions,
  InjectThrottlerStorage,
} from '@nestjs/throttler';
import { Request } from 'express';
import { SentinelService } from '../sentinel.service';
import { clientIp } from '../sentinel.util';

/**
 * Drop-in replacement for ThrottlerGuard that records every rate-limit trip into
 * the Sentinel watch list before returning the usual 429. This is what surfaces
 * "noisy" IPs (likely scrapers) on the admin screen.
 */
@Injectable()
export class SentinelThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: any,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    private sentinel: SentinelService,
  ) {
    super(options, storageService, reflector);
  }

  protected async throwThrottlingException(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    const req = context.switchToHttp().getRequest<Request>();
    const ip = clientIp(req);
    if (ip) {
      void this.sentinel.record('RATE_LIMIT', {
        ip,
        path: req.originalUrl,
        method: req.method,
        userAgent: req.headers['user-agent'] as string,
      });
    }
    return super.throwThrottlingException(context, detail);
  }
}
