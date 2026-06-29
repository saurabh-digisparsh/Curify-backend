import { Request } from 'express';

/**
 * Resolve the real client IP. `trust proxy` is enabled in main.ts, so Express
 * already resolves X-Forwarded-For into req.ip behind a proxy/Cloudflare. We
 * normalise IPv6-mapped IPv4 (::ffff:1.2.3.4) and loopback for clean display.
 */
export function clientIp(req: Request): string {
  let ip =
    req.ip ||
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    '';
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (ip === '::1') ip = '127.0.0.1';
  return ip;
}
