import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { LeadsService } from '../../leads/leads.service';
import { TasksService } from '../../tasks/tasks.service';
import { OpenAiProvider, type ChatMessage, type ToolDef } from '../ai/openai.provider';
import { VedaLogService } from '../veda-log.service';

export interface CommandResult {
  reply: string;
  actions: string[];
  costUsdMicro: number;
}

const STAGE_KEYS = [
  'new_enquiry', 'first_response', 'discovery_scheduled', 'discovery_completed',
  'qualified', 'application', 'offer_sent', 'payment_pending', 'confirmed', 'closed_lost',
];

const TOOLS: ToolDef[] = [
  {
    type: 'function',
    function: {
      name: 'find_person',
      description: 'Look up ANY person by name — website live-chat visitors, enquiries, and leads alike — and get everything on file: contact details (email/phone), their enquiries, whether they became a lead, and their most recent conversation. Use this for "who is X", "tell me about X", "did X message/contact us", or any question about someone who may NOT be a lead yet. For lead-pipeline lists (hot leads, leads missing a next action) use search_leads instead.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: "The person's name, or part of it" },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_leads',
      description: 'Search/list leads. Use view "hot" for hot leads, "no_next_action" for leads missing a next step, "active" for all open leads.',
      parameters: {
        type: 'object',
        properties: {
          view: { type: 'string', enum: ['active', 'hot', 'no_next_action', 'payment_pending', 'closed_lost', 'all'] },
          query: { type: 'string', description: 'Optional name to filter by' },
          limit: { type: 'number', description: 'Max results (default 5)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_dashboard_stats',
      description: 'Get current CRM counts: open enquiries needing reply, hot leads, upcoming discovery calls, open tasks.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_tasks',
      description: "List the current user's tasks. scope: today | overdue | open.",
      parameters: {
        type: 'object',
        properties: { scope: { type: 'string', enum: ['today', 'overdue', 'open'] } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Create a follow-up task for the current user. dueDate must be ISO (YYYY-MM-DD).',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          dueDate: { type: 'string', description: 'ISO date YYYY-MM-DD' },
          priority: { type: 'string', enum: ['HIGH', 'NORMAL', 'LOW'] },
          leadName: { type: 'string', description: 'Optional: link to a lead by contact name' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_lead_next_action',
      description: 'Set the next action + date for a lead, found by the contact name. nextActionDate is ISO (YYYY-MM-DD).',
      parameters: {
        type: 'object',
        properties: {
          leadName: { type: 'string' },
          nextAction: { type: 'string' },
          nextActionDate: { type: 'string', description: 'ISO date YYYY-MM-DD' },
        },
        required: ['leadName', 'nextAction', 'nextActionDate'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'move_lead_stage',
      description: `Move a lead (found by contact name) to a pipeline stage. Valid stages: ${STAGE_KEYS.join(', ')}.`,
      parameters: {
        type: 'object',
        properties: {
          leadName: { type: 'string' },
          toStageKey: { type: 'string', enum: STAGE_KEYS },
        },
        required: ['leadName', 'toStageKey'],
      },
    },
  },
];

@Injectable()
export class CommandService {
  private readonly logger = new Logger(CommandService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: OpenAiProvider,
    private readonly leads: LeadsService,
    private readonly tasks: TasksService,
    private readonly logs: VedaLogService,
  ) {}

  async run(transcript: string, userId: string): Promise<CommandResult> {
    const started = Date.now();
    const actions: string[] = [];
    let totalCost = 0;

    if (!this.ai.isConfigured()) {
      return { reply: 'Veda is not connected to OpenAI yet. Please add the API key in settings.', actions: [], costUsdMicro: 0 };
    }

    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are Veda, the AI assistant operating the Shreevan Wellness CRM by voice for a team member.
Today's date (IST) is ${today}. Convert relative dates ("tomorrow", "kal", "next Monday") to ISO YYYY-MM-DD.
Use the tools to read data or take actions. The user may speak Hindi, English, or Hinglish — ALWAYS reply in the same language they used.
Keep replies short and conversational; they will be read aloud. After taking an action, confirm it briefly. If a tool reports an error, explain it simply.`,
      },
      { role: 'user', content: transcript },
    ];

    try {
      for (let i = 0; i < 5; i++) {
        const result = await this.ai.chat({ messages, tools: TOOLS, temperature: 0.3 });
        totalCost += result.costUsdMicro;
        const msg = result.message;
        messages.push(msg);

        if (!msg.tool_calls?.length) {
          const reply = msg.content ?? 'Done.';
          await this.logs.write({
            type: 'VOICE_COMMAND', status: 'COMPLETED', entityType: 'User', entityId: userId,
            input: { transcript } as object, output: { reply, actions } as object,
            costUsdMicro: totalCost, durationMs: Date.now() - started, completedAt: new Date(),
          });
          return { reply, actions, costUsdMicro: totalCost };
        }

        for (const call of msg.tool_calls) {
          const args = safeParse(call.function.arguments);
          const { output, actionLabel } = await this.execute(call.function.name, args, userId);
          if (actionLabel) actions.push(actionLabel);
          messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(output) });
        }
      }
      const reply = 'Sorry, that took too many steps. Please try rephrasing.';
      return { reply, actions, costUsdMicro: totalCost };
    } catch (e) {
      await this.logs.write({
        type: 'VOICE_COMMAND', status: 'FAILED', entityType: 'User', entityId: userId,
        input: { transcript } as object, error: (e as Error).message, durationMs: Date.now() - started,
      });
      return { reply: 'Something went wrong while processing that. Please try again.', actions, costUsdMicro: totalCost };
    }
  }

  private async execute(
    name: string,
    args: Record<string, unknown>,
    userId: string,
  ): Promise<{ output: unknown; actionLabel?: string }> {
    switch (name) {
      case 'find_person': {
        const q = ((args.name as string) ?? '').trim();
        if (!q) return { output: { error: 'No name given.' } };
        const contacts = await this.prisma.contact.findMany({
          where: { name: { contains: q, mode: 'insensitive' } },
          take: 5,
          orderBy: { updatedAt: 'desc' },
          include: {
            identities: { select: { channel: true, handle: true } },
            enquiries: {
              orderBy: { lastMessageAt: 'desc' }, take: 3,
              select: { status: true, channel: true, programInterest: true, lastMessageAt: true },
            },
            leads: {
              orderBy: { updatedAt: 'desc' }, take: 3,
              select: { temperature: true, nextAction: true, nextActionDate: true, stage: { select: { label: true } } },
            },
            conversations: {
              orderBy: { updatedAt: 'desc' }, take: 1,
              select: {
                channel: true, handoverToHuman: true,
                messages: { orderBy: { occurredAt: 'desc' }, take: 1, select: { body: true, direction: true } },
              },
            },
          },
        });
        if (!contacts.length) return { output: { found: false, message: `No one found matching "${q}".` } };
        return {
          output: contacts.map((c) => ({
            name: c.name,
            country: c.country,
            language: c.language,
            email: c.identities.find((i) => i.channel === 'EMAIL')?.handle ?? null,
            phone: c.identities.find((i) => i.channel === 'WHATSAPP' || i.channel === 'PHONE')?.handle ?? null,
            enquiries: c.enquiries.map((e) => ({ status: e.status, channel: e.channel, programInterest: e.programInterest, lastMessageAt: e.lastMessageAt })),
            isLead: c.leads.length > 0,
            leads: c.leads.map((l) => ({ stage: l.stage.label, temperature: l.temperature, nextAction: l.nextAction, nextActionDate: l.nextActionDate })),
            lastConversation: c.conversations[0]
              ? { channel: c.conversations[0].channel, withHuman: c.conversations[0].handoverToHuman, lastMessage: c.conversations[0].messages[0]?.body ?? null, lastFrom: c.conversations[0].messages[0]?.direction ?? null }
              : null,
          })),
        };
      }
      case 'search_leads': {
        const res = await this.leads.list({
          view: (args.view as 'active') ?? 'active',
          q: args.query as string | undefined,
          page: 1,
          pageSize: Math.min((args.limit as number) ?? 5, 10),
        } as never);
        const items = (res as { data: { contact: { name: string; country?: string | null }; temperature: string; stage: { label: string }; nextAction?: string | null }[] }).data;
        return {
          output: items.map((l) => ({
            name: l.contact.name, country: l.contact.country, temperature: l.temperature,
            stage: l.stage.label, nextAction: l.nextAction ?? null,
          })),
        };
      }
      case 'get_dashboard_stats': {
        const [needsReply, hotLeads, upcomingCalls, openTasks] = await Promise.all([
          this.prisma.enquiry.count({ where: { status: 'NEEDS_REPLY' } }),
          this.prisma.lead.count({ where: { temperature: 'HOT', confirmedAt: null, closedLostAt: null } }),
          this.prisma.discoveryCall.count({ where: { status: 'SCHEDULED', scheduledAt: { gte: new Date() } } }),
          this.prisma.task.count({ where: { status: 'OPEN' } }),
        ]);
        return { output: { enquiriesNeedingReply: needsReply, hotLeads, upcomingDiscoveryCalls: upcomingCalls, openTasks } };
      }
      case 'list_tasks': {
        const all = await this.tasks.list(userId);
        const scope = (args.scope as string) ?? 'open';
        const filtered = all.filter((t) =>
          scope === 'today' ? t.bucket === 'today'
          : scope === 'overdue' ? t.bucket === 'overdue'
          : t.status === 'OPEN',
        );
        return { output: filtered.slice(0, 10).map((t) => ({ title: t.title, due: t.dueAt, related: t.relatedName, bucket: t.bucket })) };
      }
      case 'create_task': {
        const leadId = args.leadName ? (await this.findLeadByName(args.leadName as string))?.id : undefined;
        await this.tasks.create({
          title: args.title as string,
          dueAt: args.dueDate ? new Date(args.dueDate as string).toISOString() : undefined,
          priority: (args.priority as 'HIGH' | 'NORMAL' | 'LOW') ?? 'NORMAL',
          ownerId: userId,
          leadId,
        });
        return { output: { ok: true }, actionLabel: `Created task: ${args.title}` };
      }
      case 'set_lead_next_action': {
        const lead = await this.findLeadByName(args.leadName as string);
        if (!lead) return { output: { error: `No lead found for "${args.leadName as string}".` } };
        await this.leads.setNextAction(lead.id, {
          nextAction: args.nextAction as string,
          nextActionDate: new Date(args.nextActionDate as string).toISOString(),
        } as never, userId);
        return { output: { ok: true }, actionLabel: `Set next action for ${args.leadName as string}` };
      }
      case 'move_lead_stage': {
        const lead = await this.findLeadByName(args.leadName as string);
        if (!lead) return { output: { error: `No lead found for "${args.leadName as string}".` } };
        try {
          await this.leads.moveStage(lead.id, { toStageKey: args.toStageKey as string }, userId);
          return { output: { ok: true }, actionLabel: `Moved ${args.leadName as string} to ${args.toStageKey as string}` };
        } catch (e) {
          return { output: { error: (e as Error).message } };
        }
      }
      default:
        return { output: { error: `Unknown tool ${name}` } };
    }
  }

  private async findLeadByName(name: string) {
    return this.prisma.lead.findFirst({
      where: { contact: { name: { contains: name, mode: 'insensitive' } }, confirmedAt: null, closedLostAt: null },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });
  }
}

function safeParse(s: string): Record<string, unknown> {
  try { return JSON.parse(s) as Record<string, unknown>; } catch { return {}; }
}
