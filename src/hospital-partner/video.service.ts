import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SettingsService } from '../admin/settings/settings.service';

export interface VideoUser {
  id: string;
  name: string;
}

// Normalized token shape returned to both roles. OpenVidu (Phase 2) will add a
// second variant behind the same `provider` discriminator — the frontend already
// switches on it, so adding the fallback is a drop-in, not a rewrite.
export interface VideoToken {
  provider: 'jitsi';
  domain: string;
  roomName: string;
  jwt: string;
  displayName: string;
}

@Injectable()
export class VideoService {
  constructor(private jwt: JwtService, private settings: SettingsService) {}

  /**
   * Mint a short-lived Jitsi JWT for one participant of one room. Signed HS256
   * with JITSI_APP_SECRET — must match the Jitsi server's JWT_APP_SECRET.
   *
   * Fails loudly (503) if the provider isn't configured. This is the fail-fast
   * for the secret: we never sign with an empty/placeholder secret (PHI), and we
   * don't block the whole app's boot for an unconfigured optional feature.
   */
  async mintJitsi(roomName: string, user: VideoUser, isModerator: boolean): Promise<VideoToken> {
    const [domain, appId, appSecret] = await Promise.all([
      this.settings.get('JITSI_DOMAIN'),
      this.settings.get('JITSI_APP_ID'),
      this.settings.get('JITSI_APP_SECRET'),
    ]);
    if (!domain || !appId || !appSecret) {
      throw new ServiceUnavailableException('Video consultations are not configured yet.');
    }
    const displayName = user.name || (isModerator ? 'Doctor' : 'Patient');
    const jwt = await this.jwt.signAsync(
      {
        aud: 'jitsi',
        iss: appId,
        // sub '*' = any tenant; the specific `room` claim is what scopes access,
        // so the token still only unlocks this one room (docker-jitsi-meet token auth).
        sub: '*',
        room: roomName,
        // docker-jitsi-meet reads moderator + display name from context.user.
        context: { user: { id: user.id, name: displayName, moderator: isModerator } },
      },
      { secret: appSecret, algorithm: 'HS256', expiresIn: '2h' },
    );
    return { provider: 'jitsi', domain, roomName, jwt, displayName };
  }
}
