import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';

/**
 * 100ms (HMS) integration. Two kinds of signed tokens:
 *  - management token → calls the 100ms REST API (create rooms)
 *  - app/auth token   → handed to a client so it can join a room with a role
 * Both are HS256 JWTs signed with the App Secret. Needs HMS_ACCESS_KEY,
 * HMS_SECRET and HMS_TEMPLATE_ID; until those are set, isConfigured() is false
 * and join falls back gracefully (chat + polls still work, video disabled).
 */
@Injectable()
export class HmsService {
  private readonly logger = new Logger(HmsService.name);
  private readonly api = 'https://api.100ms.live/v2';

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private get accessKey(): string | undefined { return this.config.get<string>('HMS_ACCESS_KEY'); }
  private get secret(): string | undefined { return this.config.get<string>('HMS_SECRET'); }
  private get templateId(): string | undefined { return this.config.get<string>('HMS_TEMPLATE_ID'); }

  isConfigured(): boolean {
    return !!(this.accessKey && this.secret && this.templateId);
  }

  private async managementToken(): Promise<string> {
    return this.jwt.signAsync(
      { access_key: this.accessKey, type: 'management', version: 2, jti: randomUUID() },
      { secret: this.secret as string, algorithm: 'HS256', expiresIn: '5m' },
    );
  }

  /** Create a 100ms room from the configured template. Returns the room id. */
  async createRoom(name: string): Promise<string> {
    if (!this.isConfigured()) throw new ServiceUnavailableException('Video (100ms) is not configured yet.');
    const token = await this.managementToken();
    const res = await fetch(`${this.api}/rooms`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `${name}-${Date.now()}`, template_id: this.templateId }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      this.logger.error(`100ms createRoom failed (${res.status}): ${detail}`);
      throw new ServiceUnavailableException('Could not create the video room.');
    }
    const data = (await res.json()) as { id: string };
    return data.id;
  }

  /**
   * Auth token a client uses to join `roomId` as `role` ('host' | 'guest').
   * userId ties chat/polls/recordings to the person.
   */
  async authToken(roomId: string, userId: string, role: 'host' | 'guest'): Promise<string> {
    if (!this.isConfigured()) throw new ServiceUnavailableException('Video (100ms) is not configured yet.');
    return this.jwt.signAsync(
      { access_key: this.accessKey, room_id: roomId, user_id: userId, role, type: 'app', version: 2, jti: randomUUID() },
      { secret: this.secret as string, algorithm: 'HS256', expiresIn: '24h', notBefore: '0s' },
    );
  }
}
