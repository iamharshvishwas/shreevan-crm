import { Channel, DeliveryState } from '@prisma/client';
import { NormalizedInboundEvent } from '../modules/enquiries/dto/inbound-event.dto';

/**
 * Every provider integration implements this contract. `parseWebhook` must
 * verify the provider signature before returning a normalized event. In this
 * build only the simulation adapter exists; live adapters are awaiting
 * credentials/approval (see README → Integrations).
 */
export interface ChannelAdapter {
  readonly channel: Channel;
  isLive(): boolean;
  parseWebhook(raw: unknown, headers: Record<string, string | string[] | undefined>): NormalizedInboundEvent | null;
  sendReply(input: { to: string; text: string }): Promise<{ delivery: DeliveryState; detail: string }>;
}

/** Default adapter for channels with no live credentials yet. */
export class SimulationAdapter implements ChannelAdapter {
  constructor(readonly channel: Channel) {}
  isLive(): boolean {
    return false;
  }
  parseWebhook(): NormalizedInboundEvent | null {
    // Real signature verification + payload parsing happens once credentials land.
    return null;
  }
  async sendReply(): Promise<{ delivery: DeliveryState; detail: string }> {
    return { delivery: DeliveryState.LOGGED, detail: 'Recorded locally — live delivery requires a connected provider.' };
  }
}
