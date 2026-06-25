import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { LeadsModule } from '../leads/leads.module';
import { TasksModule } from '../tasks/tasks.module';
import { EnquiriesModule } from '../enquiries/enquiries.module';
import { VedaConfigService } from './veda-config.service';
import { VedaApprovalService } from './veda-approval.service';
import { VedaLogService } from './veda-log.service';
import { VedaController } from './veda.controller';
import { OpenAiProvider } from './ai/openai.provider';
import { EmailProvider } from './ai/email.provider';
import { RedactionService } from './ai/redaction.service';
import { WhatsAppProvider } from './channels/whatsapp.provider';
import { WhatsAppService } from './channels/whatsapp.service';
import { VoiceProvider } from './channels/voice.provider';
import { VoiceService } from './channels/voice.service';
import { EmailInboundService } from './channels/email-inbound.service';
import { GmailClient } from './channels/gmail.client';
import { GmailInboundService } from './channels/gmail-inbound.service';
import { LeadIntakeService } from './channels/lead-intake.service';
import { ElevenLabsProvider } from './channels/eleven-labs.provider';
import { MetaWebhookController } from './channels/meta-webhook.controller';
import { LeadIntakeController } from './channels/lead-intake.controller';
import { VapiWebhookController } from './channels/vapi-webhook.controller';
import { ChatController } from './channels/chat.controller';
import { EmailInboundController } from './channels/email-inbound.controller';
import { LeadQualifierService } from './agents/lead-qualifier.service';
import { EmailDrafterService } from './agents/email-drafter.service';
import { WhatsAppDrafterService } from './agents/whatsapp-drafter.service';
import { VedaChatService } from './agents/veda-chat.service';
import { VedaLearningService } from './agents/veda-learning.service';
import { VedaLearningScheduler } from './agents/veda-learning.scheduler';
import { VedaLearningController } from './agents/veda-learning.controller';
import { CommandService } from './agents/command.service';
import { VedaSchedulerService } from './veda-scheduler.service';
import { VedaExecutorService } from './veda-executor.service';
import { VedaVoiceSchedulerService } from './veda-voice-scheduler.service';
import { KnowledgeService } from './knowledge/knowledge.service';
import { KnowledgeController } from './knowledge/knowledge.controller';
import { NurtureService } from './nurture/nurture.service';
import { NurtureScheduler } from './nurture/nurture.scheduler';

@Module({
  imports: [PrismaModule, LeadsModule, TasksModule, EnquiriesModule],
  controllers: [VedaController, MetaWebhookController, VapiWebhookController, ChatController, EmailInboundController, KnowledgeController, LeadIntakeController, VedaLearningController],
  providers: [
    VedaConfigService,
    VedaApprovalService,
    VedaLogService,
    OpenAiProvider,
    EmailProvider,
    RedactionService,
    WhatsAppProvider,
    WhatsAppService,
    VoiceProvider,
    VoiceService,
    EmailInboundService,
    GmailClient,
    GmailInboundService,
    LeadIntakeService,
    ElevenLabsProvider,
    LeadQualifierService,
    EmailDrafterService,
    WhatsAppDrafterService,
    VedaChatService,
    VedaLearningService,
    VedaLearningScheduler,
    CommandService,
    VedaSchedulerService,
    VedaExecutorService,
    VedaVoiceSchedulerService,
    KnowledgeService,
    NurtureService,
    NurtureScheduler,
  ],
  exports: [VedaConfigService, VedaApprovalService, VedaLogService],
})
export class VedaModule {}
