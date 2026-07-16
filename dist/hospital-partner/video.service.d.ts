import { JwtService } from '@nestjs/jwt';
import { SettingsService } from '../admin/settings/settings.service';
export interface VideoUser {
    id: string;
    name: string;
}
export interface VideoToken {
    provider: 'jitsi';
    domain: string;
    roomName: string;
    jwt: string;
    displayName: string;
}
export declare class VideoService {
    private jwt;
    private settings;
    constructor(jwt: JwtService, settings: SettingsService);
    mintJitsi(roomName: string, user: VideoUser, isModerator: boolean): Promise<VideoToken>;
}
