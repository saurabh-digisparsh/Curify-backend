import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerStorage, ThrottlerLimitDetail } from '@nestjs/throttler';
import { SentinelService } from '../sentinel.service';
export declare class SentinelThrottlerGuard extends ThrottlerGuard {
    private sentinel;
    constructor(options: any, storageService: ThrottlerStorage, reflector: Reflector, sentinel: SentinelService);
    protected throwThrottlingException(context: ExecutionContext, detail: ThrottlerLimitDetail): Promise<void>;
}
