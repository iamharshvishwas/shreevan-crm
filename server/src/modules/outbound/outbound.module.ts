import { Module } from '@nestjs/common';
import { EmailProvider } from '../veda/ai/email.provider';
import { WhatsAppProvider } from '../veda/channels/whatsapp.provider';

/**
 * Shared outbound senders. Both Veda (its executor/agents) and the Enquiries
 * module (human replies in the inbox) need to actually deliver to the customer.
 * These providers depend only on ConfigService, so sharing them here avoids a
 * circular import between EnquiriesModule and VedaModule.
 */
@Module({
  providers: [EmailProvider, WhatsAppProvider],
  exports: [EmailProvider, WhatsAppProvider],
})
export class OutboundModule {}
