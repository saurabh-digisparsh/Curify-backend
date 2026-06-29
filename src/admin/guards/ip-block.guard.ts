import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { SentinelService } from '../sentinel.service';
import { clientIp } from '../sentinel.util';

/**
 * First line of defence: reject any request whose source IP an admin has blocked
 * via the Sentinel screen. Runs before the throttler so blocked IPs never even
 * consume the rate-limit budget. Each rejected attempt is recorded so the admin
 * can see a blocked scraper still hammering the door.
 */
@Injectable()
export class IpBlockGuard implements CanActivate {
  constructor(private sentinel: SentinelService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();

    // Never IP-block the admin or auth surfaces — those are gated by JWT + ADMIN
    // role anyway, and exempting them stops an admin from locking themselves out
    // (e.g. after blocking their own IP) with no way back in to unblock.
    const path = req.originalUrl || req.url || '';
    if (path.startsWith('/api/admin') || path.startsWith('/api/auth')) return true;

    const ip = clientIp(req);
    if (ip && this.sentinel.isBlocked(ip)) {
      // Fire-and-forget; never let logging failures break the rejection.
      void this.sentinel.record('BLOCKED', {
        ip,
        path: req.originalUrl,
        method: req.method,
        userAgent: req.headers['user-agent'] as string,
      });
      throw new ForbiddenException('Access denied');
    }
    return true;
  }
}
