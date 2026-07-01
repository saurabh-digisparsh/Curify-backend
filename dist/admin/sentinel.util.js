"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clientIp = clientIp;
function clientIp(req) {
    let ip = req.ip ||
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.socket?.remoteAddress ||
        '';
    if (ip.startsWith('::ffff:'))
        ip = ip.slice(7);
    if (ip === '::1')
        ip = '127.0.0.1';
    return ip;
}
//# sourceMappingURL=sentinel.util.js.map