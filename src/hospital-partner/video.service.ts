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

// Values that mean "not filled in yet" — treated as INVALID, same as missing. A
// consult booked against a placeholder secret would fail to connect at join time.
const PLACEHOLDER = /^(changeme|change[_-]?me|your[_-]?(app[_-]?)?secret|your[_-]?secret[_-]?here|replace[_-]?me|secret|todo|none|xxx+)$/i;

/**
 * Is the Jitsi stack usably configured (domain + app id + a real app secret)?
 *
 * When this is false the whole video-consult SCHEDULING flow is skipped — we do
 * not advertise bookable doctors, hand out slots, take bookings, or gate go-live
 * on teleconsult availability. Better to hide the feature than let a patient book
 * a call that can never connect.
 */
export async function isVideoConfigured(settings: SettingsService): Promise<boolean> {
  const [domain, appId, appSecret] = await Promise.all([
    settings.get('JITSI_DOMAIN'),
    settings.get('JITSI_APP_ID'),
    settings.get('JITSI_APP_SECRET'),
  ]);
  const ok = (v?: string) => !!v && v.trim().length > 0 && !PLACEHOLDER.test(v.trim());
  return ok(domain) && ok(appId) && ok(appSecret);
}

@Injectable()
export class VideoService {
  constructor(private jwt: JwtService, private settings: SettingsService) {}

  /** Whether video consults are available at all (see isVideoConfigured). */
  enabled(): Promise<boolean> {
    return isVideoConfigured(this.settings);
  }

  /**
   * Mint a short-lived Jitsi JWT for one participant of one room. Signed HS256
   * with JITSI_APP_SECRET — must match the Jitsi server's JWT_APP_SECRET.
   *
   * Fails loudly (503) if the provider isn't configured. This is the fail-fast
   * for the secret: we never sign with an empty/placeholder secret (PHI), and we
   * don't block the whole app's boot for an unconfigured optional feature.
   */
  async mintJitsi(roomName: string, user: VideoUser, isModerator: boolean): Promise<VideoToken> {
    if (!(await this.enabled())) {
      throw new ServiceUnavailableException('Video consultations are not configured yet.');
    }
    const [domain, appId, appSecret] = await Promise.all([
      this.settings.get('JITSI_DOMAIN'),
      this.settings.get('JITSI_APP_ID'),
      this.settings.get('JITSI_APP_SECRET'),
    ]);
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
