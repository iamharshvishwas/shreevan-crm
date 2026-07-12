import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { type VedaConfig, type VedaStepKey, VEDA_STEP_KEYS, type UpdateVedaConfigDto } from './dto/veda.dto';

const CONFIG_KEY = 'veda:config';

const DEFAULT_CONFIG: VedaConfig = {
  globalEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  quietHoursTimezone: 'Asia/Kolkata',
  dailyMessageLimit: 50,
  steps: {
    QUALIFY_LEAD:  { enabled: true,  autoApprove: false },
    SEND_EMAIL:    { enabled: true,  autoApprove: false },
    SEND_WHATSAPP: { enabled: false, autoApprove: false },
    VOICE_CALL:    { enabled: false, autoApprove: false },
    CHAT_REPLY:    { enabled: false, autoApprove: true  }, // chat is real-time; "auto" = replies instantly
    NURTURE:       { enabled: false, autoApprove: false }, // multi-touch follow-up cadence for cold leads
    SELF_LEARN:    { enabled: true,  autoApprove: true  }, // learn from gaps; auto-apply safe entries, gate sensitive ones
  },
};

@Injectable()
export class VedaConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<VedaConfig> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key: CONFIG_KEY } });
    if (!row) return { ...DEFAULT_CONFIG };
    const saved = row.valueJson as Partial<VedaConfig>;
    // Deep-merge steps so newly-added steps (e.g. SELF_LEARN) keep their defaults
    // even when an older config was saved before they existed.
    return {
      ...DEFAULT_CONFIG,
      ...saved,
      steps: { ...DEFAULT_CONFIG.steps, ...(saved.steps ?? {}) },
    };
  }

  async update(dto: UpdateVedaConfigDto): Promise<VedaConfig> {
    const current = await this.get();
    const next: VedaConfig = {
      globalEnabled:      dto.globalEnabled      ?? current.globalEnabled,
      quietHoursStart:    dto.quietHoursStart    ?? current.quietHoursStart,
      quietHoursEnd:      dto.quietHoursEnd      ?? current.quietHoursEnd,
      quietHoursTimezone: dto.quietHoursTimezone ?? current.quietHoursTimezone,
      dailyMessageLimit:  dto.dailyMessageLimit  ?? current.dailyMessageLimit,
      steps: { ...current.steps },
    };
    for (const key of VEDA_STEP_KEYS) {
      const patch = dto[key as keyof UpdateVedaConfigDto] as { enabled?: boolean; autoApprove?: boolean } | undefined;
      if (patch) {
        next.steps[key] = {
          enabled:     patch.enabled     ?? current.steps[key].enabled,
          autoApprove: patch.autoApprove ?? current.steps[key].autoApprove,
        };
      }
    }
    await this.prisma.systemSetting.upsert({
      where:  { key: CONFIG_KEY },
      create: { key: CONFIG_KEY, valueJson: next as object },
      update: { valueJson: next as object },
    });
    return next;
  }

  async isGloballyEnabled(): Promise<boolean> {
    return (await this.get()).globalEnabled;
  }

  async isStepEnabled(step: VedaStepKey): Promise<boolean> {
    const cfg = await this.get();
    return cfg.globalEnabled && cfg.steps[step].enabled;
  }
}
