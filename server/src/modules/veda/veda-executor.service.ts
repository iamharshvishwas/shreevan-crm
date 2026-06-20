import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Channel } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { EmailProvider } from './ai/email.provider';
import { WhatsAppProvider } from './channels/whatsapp.provider';
import { VoiceProvider } from './channels/voice.provider';
import { VedaConfigService } from './veda-config.service';
import { VedaLogService } from './veda-log.service';

const MAX_ATTEMPTS = 3;
const WINDOW_MS = 24 * 3600_000;

interface EmailPayload { to: string; subject: string; body: string }
interface WaPayload { to: string; contactId?: string; body: string; slots?: { iso: string; label: string }[] }
interface VoicePayload { to: string; leadName: string; programInterest?: string | null; language?: string | null; discoveryCallId: string }

/**
 * Executes APPROVED Veda actions (email + WhatsApp). Cron-driven, single-worker.
 * Dedup via VedaActionLog: an approval with a COMPLETED execution log is skipped;
 * FAILED logs are retried up to MAX_ATTEMPTS.
 */
@Injectable()
export class VedaExecutorService {
  private readonly logger = new Logger(VedaExecutorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly email: EmailProvider,
    private readonly wa: WhatsAppProvider,
    private readonly voice: VoiceProvider,
    private readonly vedaConfig: VedaConfigService,
    private readonly logs: VedaLogService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async run(): Promise<void> {
    if (!(await this.vedaConfig.isGloballyEnabled())) return;

    const approved = await this.prisma.vedaApproval.findMany({
      where: { status: 'APPROVED', type: { in: ['SEND_EMAIL', 'SEND_WHATSAPP', 'VOICE_CALL'] } },
      orderBy: { reviewedAt: 'asc' },
      take: 10,
    });

    const LOG_TYPE: Record<string, string> = { SEND_EMAIL: 'EMAIL_SENT', SEND_WHATSAPP: 'WHATSAPP_SENT', VOICE_CALL: 'VOICE_PLACED' };

    for (const approval of approved) {
      const logType = LOG_TYPE[approval.type];
      const prior = await this.prisma.vedaActionLog.findMany({ where: { approvalId: approval.id, type: logType } });
      if (prior.some((p) => p.status === 'COMPLETED')) continue;
      if (prior.length >= MAX_ATTEMPTS) continue;

      if (approval.type === 'SEND_EMAIL') {
        await this.sendEmail(approval.id, approval.payload as unknown as EmailPayload, approval.entityType, approval.entityId);
      } else if (approval.type === 'SEND_WHATSAPP') {
        await this.sendWhatsApp(approval.id, approval.payload as unknown as WaPayload, approval.entityType, approval.entityId);
      } else {
        await this.placeVoiceCall(approval.id, approval.payload as unknown as VoicePayload, approval.entityType, approval.entityId);
      }
    }
  }

  private async placeVoiceCall(approvalId: string, payload: VoicePayload, entityType: string, entityId: string): Promise<void> {
    const started = Date.now();
    try {
      const result = await this.voice.placeCall(payload);
      if (result.externalCallId) {
        await this.prisma.discoveryCall.update({
          where: { id: payload.discoveryCallId },
          data: { externalCallId: result.externalCallId },
        }).catch(() => undefined);
      }
      await this.logs.write({
        type: 'VOICE_PLACED', status: 'COMPLETED', entityType, entityId, approvalId,
        output: { simulated: result.simulated, externalCallId: result.externalCallId, detail: result.detail } as object,
        durationMs: Date.now() - started, completedAt: new Date(),
      });
      await this.prisma.vedaApproval.update({ where: { id: approvalId }, data: { status: 'AUTO_SENT' } });
    } catch (e) {
      await this.fail('VOICE_PLACED', approvalId, entityType, entityId, e, started);
    }
  }

  private async sendEmail(approvalId: string, payload: EmailPayload, entityType: string, entityId: string): Promise<void> {
    const started = Date.now();
    try {
      const result = await this.email.send(payload);
      await this.logs.write({
        type: 'EMAIL_SENT', status: 'COMPLETED', entityType, entityId, approvalId,
        output: { simulated: result.simulated, detail: result.detail, providerId: result.providerId } as object,
        durationMs: Date.now() - started, completedAt: new Date(),
      });
      await this.prisma.vedaApproval.update({ where: { id: approvalId }, data: { status: 'AUTO_SENT' } });
      await this.logActivity(entityType, entityId, result.simulated ? 'Veda drafted an email (simulated send)' : 'Veda sent an email', payload.subject);
    } catch (e) {
      await this.fail('EMAIL_SENT', approvalId, entityType, entityId, e, started);
    }
  }

  private async sendWhatsApp(approvalId: string, payload: WaPayload, entityType: string, entityId: string): Promise<void> {
    const started = Date.now();
    try {
      const inWindow = await this.withinWindow(payload.contactId);
      let detail: string;
      let simulated = false;

      if (inWindow) {
        // Inside the 24h window → free-form text, then tappable slot buttons.
        const r1 = await this.wa.sendText(payload.to, payload.body);
        simulated = r1.simulated;
        if (payload.slots?.length) {
          await this.wa.sendButtons(
            payload.to,
            'Please choose a time that suits you:',
            payload.slots.map((s) => ({ id: `book|${s.iso}`, title: s.label })),
          );
        }
        detail = inWindowDetail(r1.simulated);
      } else {
        // First contact / outside window → pre-approved template (no dynamic buttons).
        const lang = await this.langFor(payload.contactId);
        const firstName = payload.to;
        const tmpl = this.config.get<string>('WHATSAPP_GREETING_TEMPLATE')!;
        const r = await this.wa.sendTemplate(payload.to, tmpl, lang, [firstName]);
        simulated = r.simulated;
        detail = `Template "${tmpl}" sent${r.simulated ? ' (simulated)' : ''}.`;
      }

      await this.logs.write({
        type: 'WHATSAPP_SENT', status: 'COMPLETED', entityType, entityId, approvalId,
        output: { inWindow, simulated, detail } as object,
        durationMs: Date.now() - started, completedAt: new Date(),
      });
      await this.prisma.vedaApproval.update({ where: { id: approvalId }, data: { status: 'AUTO_SENT' } });
      await this.logActivity(entityType, entityId, simulated ? 'Veda drafted a WhatsApp (simulated send)' : 'Veda sent a WhatsApp', payload.body.slice(0, 80));
    } catch (e) {
      await this.fail('WHATSAPP_SENT', approvalId, entityType, entityId, e, started);
    }
  }

  /** True if the contact messaged us on WhatsApp within the last 24h. */
  private async withinWindow(contactId?: string): Promise<boolean> {
    if (!contactId) return false;
    const last = await this.prisma.message.findFirst({
      where: { conversation: { contactId }, channel: Channel.WHATSAPP, direction: 'INBOUND' },
      orderBy: { occurredAt: 'desc' },
    });
    return !!last && Date.now() - new Date(last.occurredAt).getTime() < WINDOW_MS;
  }

  private async langFor(contactId?: string): Promise<string> {
    if (!contactId) return 'en';
    const contact = await this.prisma.contact.findUnique({ where: { id: contactId } });
    return contact?.language?.toLowerCase().startsWith('hi') ? 'hi' : 'en';
  }

  private async logActivity(entityType: string, entityId: string, title: string, body: string): Promise<void> {
    if (entityType !== 'Lead') return;
    await this.prisma.leadActivity.create({ data: { leadId: entityId, type: 'VEDA', title, body } }).catch(() => undefined);
  }

  private async fail(type: string, approvalId: string, entityType: string, entityId: string, e: unknown, started: number): Promise<void> {
    await this.logs.write({
      type, status: 'FAILED', entityType, entityId, approvalId,
      error: (e as Error).message, durationMs: Date.now() - started,
    });
    this.logger.warn(`${type} failed for approval ${approvalId}: ${(e as Error).message}`);
  }
}

function inWindowDetail(simulated: boolean): string {
  return `Free-form message + slot buttons sent${simulated ? ' (simulated)' : ''}.`;
}
