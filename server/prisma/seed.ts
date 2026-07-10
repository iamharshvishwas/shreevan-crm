/* Idempotent seed: structural lookups via upsert; sample data guarded by count.
 * Dev fixtures only — no real customers, credentials, or health data. */
import { Channel, ConnectionStatus, PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { normalizeHandle } from '../src/modules/contacts/identity.util';

const prisma = new PrismaClient();

const STAGES = [
  { key: 'new_enquiry', label: 'New enquiry', order: 1 },
  { key: 'first_response', label: 'First response sent', order: 2 },
  { key: 'discovery_scheduled', label: 'Discovery call scheduled', order: 3 },
  { key: 'discovery_completed', label: 'Discovery call completed', order: 4 },
  { key: 'qualified', label: 'Qualified opportunity', order: 5 },
  { key: 'application', label: 'Application submitted', order: 6 },
  { key: 'offer_sent', label: 'Program offer sent', order: 7 },
  { key: 'payment_pending', label: 'Payment pending', order: 8 },
  { key: 'confirmed', label: 'Booking confirmed', order: 9, isTerminalWon: true },
  { key: 'closed_lost', label: 'Closed lost', order: 10, isTerminalLost: true },
];

const SLA = [
  { key: 'wa_hot', label: 'Hot WhatsApp enquiry', firstResponseMins: 15, appliesTo: 'WhatsApp · High priority' },
  { key: 'ig', label: 'Instagram programme enquiry', firstResponseMins: 30, appliesTo: 'Instagram / Facebook' },
  { key: 'web', label: 'Website enquiry', firstResponseMins: 60, appliesTo: 'Website form & chat' },
  { key: 'email', label: 'General email enquiry', firstResponseMins: 240, appliesTo: 'Email' },
  { key: 'customer', label: 'Existing-customer request', firstResponseMins: 120, appliesTo: 'Any · linked customer' },
];

const PROGRAMS = [
  { key: 'personal_reset', name: '28-Day Personal Reset', durationDays: 28, priceUsdAmount: 420000, priceInrAmount: 29500000 },
  { key: 'foundations_14', name: '14-Day Foundations Program', durationDays: 14, priceUsdAmount: 240000, priceInrAmount: 14500000 },
  { key: 'practice_immersion', name: '28-Day Practice Immersion', durationDays: 28, priceUsdAmount: 460000, priceInrAmount: 32000000 },
  { key: 'clarity_retreat', name: '28-Day Clarity Retreat', durationDays: 28, priceUsdAmount: 440000, priceInrAmount: 31000000 },
  { key: 'masterclass_60', name: '60-Day Integration Masterclass', durationDays: 60, priceUsdAmount: 890000, priceInrAmount: 62000000 },
];

const LOST_REASONS = [
  { key: 'timing', label: 'Timing / leave not approved' },
  { key: 'no_response', label: 'No response after follow-ups' },
  { key: 'budget', label: 'Budget' },
  { key: 'other_retreat', label: 'Chose another retreat' },
];

async function main(): Promise<void> {
  // --- Users ---
  // Only the admin is seeded. Real employees are invited from the CRM admin UI
  // (Settings → Team), where the admin assigns each their own role and per-user
  // screen access (allowedScreens). We deliberately do NOT pre-create staff
  // accounts with fixed roles here.
  const HARSH = 'harsh@shreevanwellness.com';
  const password = await argon2.hash('changeme123');
  const admin = await prisma.user.upsert({
    where: { email: HARSH },
    update: { name: 'Harsh Vishwas', role: Role.ADMIN, allowedScreens: [] },
    create: { email: HARSH, name: 'Harsh Vishwas', role: Role.ADMIN, allowedScreens: [], passwordHash: password },
  });
  // The sample business data below (routing rules, enquiries, pipeline leads)
  // needs an owner. Until real staff exist, everything is owned by the admin —
  // these aliases keep the demo owner references resolving to Harsh.
  const ISHA = HARSH;
  const TUSHAR = HARSH;
  const users: Record<string, string> = { [HARSH]: admin.id };

  // --- Lookups ---
  for (const s of STAGES) {
    await prisma.pipelineStage.upsert({ where: { key: s.key }, update: { label: s.label, order: s.order }, create: s });
  }
  for (const s of SLA) {
    await prisma.slaPolicy.upsert({ where: { key: s.key }, update: s, create: s });
  }
  for (const p of PROGRAMS) {
    await prisma.program.upsert({ where: { key: p.key }, update: p, create: p });
  }
  for (const r of LOST_REASONS) {
    await prisma.leadLostReason.upsert({ where: { key: r.key }, update: r, create: r });
  }

  // --- Routing rules (guarded) ---
  if ((await prisma.routingRule.count()) === 0) {
    await prisma.routingRule.createMany({
      data: [
        { label: 'India enquiries → Isha', whenCountry: 'India', assignToUserId: users[ISHA], priorityOrder: 1 },
        { label: 'WhatsApp → Isha', whenChannel: Channel.WHATSAPP, assignToUserId: users[ISHA], priorityOrder: 2 },
        { label: 'Email → Tushar', whenChannel: Channel.EMAIL, assignToUserId: users[TUSHAR], priorityOrder: 3 },
      ],
    });
  }

  // --- Channel connections (guarded) ---
  if ((await prisma.channelConnection.count()) === 0) {
    await prisma.channelConnection.createMany({
      data: [
        { channel: Channel.WEBSITE_FORM, label: 'shreevanwellness.com forms', status: ConnectionStatus.CONNECTED, inboundEnabled: true, outboundEnabled: false },
        { channel: Channel.PHONE, label: 'Phone & walk-in (manual)', status: ConnectionStatus.CONNECTED, inboundEnabled: true, outboundEnabled: true },
        { channel: Channel.WHATSAPP, label: 'WhatsApp Business', status: ConnectionStatus.TOKEN_EXPIRING, inboundEnabled: true, outboundEnabled: false },
        { channel: Channel.INSTAGRAM, label: '@shreevan.wellness', status: ConnectionStatus.SIMULATED, inboundEnabled: true, outboundEnabled: false },
        { channel: Channel.EMAIL, label: 'hello@shreevanwellness.com', status: ConnectionStatus.SIMULATED, inboundEnabled: true, outboundEnabled: false },
        { channel: Channel.FACEBOOK, label: 'Facebook page inbox', status: ConnectionStatus.NOT_CONFIGURED, inboundEnabled: false, outboundEnabled: false },
      ],
    });
  }

  // --- Sample contacts + enquiries (guarded) ---
  if ((await prisma.contact.count()) === 0) {
    const waConn = await prisma.channelConnection.findFirst({ where: { channel: Channel.WHATSAPP } });

    const meera = await prisma.contact.create({
      data: {
        name: 'Meera Nair', country: 'India', timezone: 'Asia/Kolkata', firstTouchSource: Channel.WHATSAPP,
        identities: { create: { channel: Channel.WHATSAPP, handle: '+919847012233', normalizedHandle: normalizeHandle(Channel.WHATSAPP, '+919847012233'), verified: true } },
      },
    });
    const enquiry = await prisma.enquiry.create({
      data: {
        contactId: meera.id, status: 'NEEDS_REPLY', channel: Channel.WHATSAPP, firstTouchSource: Channel.WHATSAPP,
        ownerId: users[ISHA], priority: 'HIGH', programInterest: '28-Day Personal Reset',
        lastInboundAt: new Date(Date.now() - 40 * 60_000), lastMessageAt: new Date(Date.now() - 40 * 60_000),
        slaPolicyId: (await prisma.slaPolicy.findUnique({ where: { key: 'wa_hot' } }))!.id,
      },
    });
    await prisma.conversation.create({
      data: {
        connectionId: waConn?.id, channel: Channel.WHATSAPP, contactId: meera.id, enquiryId: enquiry.id,
        externalConversationId: 'seed_meera', subject: 'August 28-day reset availability',
        messages: { create: { externalMessageId: 'seed_wa_1', direction: 'INBOUND', channel: Channel.WHATSAPP, authorName: 'Meera Nair', body: 'Hi! Is the 28-day reset open for August? Booking for myself.', occurredAt: new Date(Date.now() - 40 * 60_000) } },
      },
    });

    // Two "Maya Kapoor" contacts → a never-auto-merged suggestion.
    const mayaEmail = await prisma.contact.create({
      data: { name: 'Maya Kapoor', country: 'USA', timezone: 'America/Los_Angeles', firstTouchSource: Channel.EMAIL,
        identities: { create: { channel: Channel.EMAIL, handle: 'maya.kapoor@stanfordalumni.org', normalizedHandle: normalizeHandle(Channel.EMAIL, 'maya.kapoor@stanfordalumni.org'), verified: true } } },
    });
    const mayaIg = await prisma.contact.create({
      data: { name: 'Maya Kapoor', country: 'USA', timezone: 'America/Los_Angeles', firstTouchSource: Channel.INSTAGRAM,
        identities: { create: { channel: Channel.INSTAGRAM, handle: '@maya.reset', normalizedHandle: normalizeHandle(Channel.INSTAGRAM, '@maya.reset'), verified: true } } },
    });
    await prisma.contactMergeSuggestion.create({
      data: { contactAId: mayaEmail.id, contactBId: mayaIg.id, confidence: 0.75, evidence: ['Identical name', 'Both in USA'] },
    });
  }

  // --- Sample leads across the pipeline (guarded) ---
  if ((await prisma.lead.count()) === 0) {
    const stageByKey = Object.fromEntries((await prisma.pipelineStage.findMany()).map((s) => [s.key, s.id]));
    const day = (n: number) => new Date(Date.now() + n * 86_400_000);
    type Seed = {
      name: string; country: string; tz: string; channel: Channel; handle: string;
      stage: string; temperature: 'HOT' | 'WARM' | 'COLD'; owner: string; program: string;
      amount: number; currency: 'USD' | 'INR'; source: Channel; nextAction: string; nextDays: number;
    };
    const seeds: Seed[] = [
      { name: 'Sarah Williams', country: 'United Kingdom', tz: 'Europe/London', channel: Channel.EMAIL, handle: 'sarah.w@belgravia-consulting.co.uk', stage: 'offer_sent', temperature: 'HOT', owner: ISHA, program: '28-Day Personal Reset', amount: 420000, currency: 'USD', source: Channel.WEBSITE_FORM, nextAction: 'Follow up on program offer', nextDays: 1 },
      { name: 'Daniel Brooks', country: 'Canada', tz: 'America/Toronto', channel: Channel.EMAIL, handle: 'dbrooks@torontolaw.ca', stage: 'qualified', temperature: 'WARM', owner: TUSHAR, program: '28-Day Clarity Retreat', amount: 440000, currency: 'USD', source: Channel.WEBSITE_FORM, nextAction: 'Send program offer', nextDays: 2 },
      { name: 'Emma Thompson', country: 'Australia', tz: 'Australia/Sydney', channel: Channel.EMAIL, handle: 'emma.t@yogacollective.com.au', stage: 'payment_pending', temperature: 'HOT', owner: ISHA, program: '28-Day Practice Immersion', amount: 460000, currency: 'USD', source: Channel.REFERRAL, nextAction: 'Send payment reminder', nextDays: 0 },
      { name: 'Nikhil Bhatia', country: 'India', tz: 'Asia/Kolkata', channel: Channel.WHATSAPP, handle: '+919810067234', stage: 'offer_sent', temperature: 'WARM', owner: TUSHAR, program: '28-Day Clarity Retreat', amount: 31000000, currency: 'INR', source: Channel.REFERRAL, nextAction: 'Follow up on offer', nextDays: 1 },
    ];
    for (const s of seeds) {
      const contact = await prisma.contact.create({
        data: {
          name: s.name, country: s.country, timezone: s.tz, firstTouchSource: s.source,
          identities: { create: { channel: s.channel, handle: s.handle, normalizedHandle: normalizeHandle(s.channel, s.handle), verified: true } },
        },
      });
      const lead = await prisma.lead.create({
        data: {
          contactId: contact.id, stageId: stageByKey[s.stage], temperature: s.temperature, ownerId: users[s.owner],
          programInterest: s.program, expectedValueAmount: s.amount, expectedValueCurrency: s.currency,
          firstTouchSource: s.source, nextAction: s.nextAction, nextActionDate: day(s.nextDays),
          healthScreening: 'REQUIRED', eligibility: 'PENDING',
        },
      });
      await prisma.leadStageHistory.create({ data: { leadId: lead.id, toStageId: stageByKey[s.stage] } });
      await prisma.leadActivity.create({ data: { leadId: lead.id, type: 'CREATED', title: 'Lead created (seed)' } });
    }
  }

  // eslint-disable-next-line no-console
  console.log('Seed complete. Admin login: harsh@shreevanwellness.com / changeme123');
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
