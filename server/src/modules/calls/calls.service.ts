import { Injectable, Logger } from '@nestjs/common';
import { CallStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { DomainError, NotFoundError } from '../../common/errors/domain.errors';

export interface RecordingFile {
  buffer: Buffer;
  contentType: string;
}

@Injectable()
export class CallsService {
  private readonly logger = new Logger(CallsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async list() {
    const calls = await this.prisma.discoveryCall.findMany({
      include: {
        contact: { select: { name: true, country: true, timezone: true } },
        owner: { select: { name: true } },
        lead: { select: { id: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });
    const now = Date.now();
    const upcoming = calls.filter((c) => c.status === CallStatus.SCHEDULED && new Date(c.scheduledAt).getTime() >= now);
    const completed = calls.filter((c) => c.status === CallStatus.COMPLETED);
    return { upcoming, completed };
  }

  async complete(id: string, outcome?: string) {
    await this.ensure(id);
    return this.prisma.discoveryCall.update({ where: { id }, data: { status: CallStatus.COMPLETED, outcome } });
  }

  async reschedule(id: string, scheduledAt: string) {
    await this.ensure(id);
    return this.prisma.discoveryCall.update({ where: { id }, data: { scheduledAt: new Date(scheduledAt), status: CallStatus.SCHEDULED } });
  }

  async cancel(id: string) {
    await this.ensure(id);
    return this.prisma.discoveryCall.update({ where: { id }, data: { status: CallStatus.CANCELLED } });
  }

  private async ensure(id: string) {
    if (!(await this.prisma.discoveryCall.count({ where: { id } }))) throw new NotFoundError('Discovery call', id);
  }

  /**
   * Fetch the call recording from Vapi on the caller's behalf. Vapi now requires
   * an authenticated request (Authorization: Bearer <API key>) to download a
   * recording — the raw recordingUrl we stored from the webhook no longer works
   * unauthenticated, so we proxy it through here rather than link to it directly.
   */
  async getRecording(id: string): Promise<RecordingFile> {
    const call = await this.prisma.discoveryCall.findUnique({ where: { id }, select: { externalCallId: true } });
    if (!call) throw new NotFoundError('Discovery call', id);
    if (!call.externalCallId) throw new NotFoundError('Recording for this call');

    const apiKey = this.config.get<string>('VAPI_API_KEY');
    if (!apiKey) throw new DomainError('VAPI_NOT_CONFIGURED', 'Voice calling is not configured.', 422);

    const res = await fetch(`https://api.vapi.ai/call/${call.externalCallId}/mono-recording`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      this.logger.error(`Vapi recording fetch failed (${res.status}) for call ${call.externalCallId}: ${detail.slice(0, 200)}`);
      throw new NotFoundError('Recording for this call');
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get('content-type') ?? 'audio/mpeg';
    return { buffer, contentType };
  }
}
