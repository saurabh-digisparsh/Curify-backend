import { CanActivate, ExecutionContext } from '@nestjs/common';
import { SentinelService } from '../sentinel.service';
export declare class IpBlockGuard implements CanActivate {
    private sentinel;
    constructor(sentinel: SentinelService);
    canActivate(context: ExecutionContext): boolean;
}
