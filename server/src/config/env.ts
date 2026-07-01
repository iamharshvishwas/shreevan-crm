import { z } from 'zod';

/** Environment schema — validated at startup so the app fails fast on misconfig. */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(8),
  JWT_REFRESH_SECRET: z.string().min(8),
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL: z.coerce.number().int().positive().default(2_592_000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  // Public base URL of this API — used so external providers (Vapi) can call our webhooks.
  PUBLIC_API_URL: z.string().default('https://api.shreevanwellness.com'),
  // Marketing website origin(s) allowed to call the public chat endpoint (comma-separated).
  PUBLIC_SITE_ORIGIN: z.string().default('https://shreevanwellness.com,https://www.shreevanwellness.com'),
  ENABLE_SIMULATION: z
    .preprocess((v) => (typeof v === 'string' ? v === 'true' : v), z.boolean())
    .default(false),

  // --- Veda AI agent (all optional; features no-op until configured) ---
  // OpenAI API key from platform.openai.com (NOT a ChatGPT subscription).
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  // Outbound email. Two options (SMTP takes priority over Resend):
  //  - SMTP (e.g. Gmail with an App Password) — lets Veda send from a Gmail address.
  //  - Resend API — needs a verified domain.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  // Gmail API (OAuth) — HTTPS, works on Railway where SMTP ports are blocked.
  GMAIL_CLIENT_ID: z.string().optional(),
  GMAIL_CLIENT_SECRET: z.string().optional(),
  GMAIL_REFRESH_TOKEN: z.string().optional(),
  // Inbound: Veda ONLY reads unread mail under this Gmail label. Unset = inbound OFF
  // (prevents processing a whole personal inbox). Use 'INBOX' for a dedicated mailbox.
  GMAIL_INBOUND_LABEL: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  VEDA_FROM_EMAIL: z.string().default('Veda · Shreevan Wellness <veda@shreevanwellness.com>'),
  // Shared secret for the inbound-email webhook (Postmark/Mailgun/SendGrid → /webhooks/email).
  EMAIL_WEBHOOK_SECRET: z.string().optional(),

  // --- ElevenLabs text-to-speech for the website live-chat widget (optional) ---
  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_VOICE_ID: z.string().default('21m00Tcm4TlvDq8ikWAM'), // pick a multilingual voice in ElevenLabs
  ELEVENLABS_MODEL: z.string().default('eleven_turbo_v2_5'),        // low-latency, multilingual (Hindi+English)

  // --- WhatsApp Cloud API + Meta webhooks (Phase 2; all optional) ---
  WHATSAPP_TOKEN: z.string().optional(),            // Graph API access token
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),  // sender phone-number id
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),     // webhook GET verification token
  META_APP_SECRET: z.string().optional(),           // verifies X-Hub-Signature-256
  META_PAGE_TOKEN: z.string().optional(),           // Page token for Lead Ads fetch
  WHATSAPP_GREETING_TEMPLATE: z.string().default('veda_greeting'),
  META_GRAPH_VERSION: z.string().default('v21.0'),

  // --- Other lead sources (Phase: multi-source intake; all optional) ---
  GOOGLE_ADS_KEY: z.string().optional(),       // matches the "key" set in Google Lead Form webhook
  LEAD_WEBHOOK_SECRET: z.string().optional(),  // shared secret for generic + LinkedIn intake

  // --- Vapi AI voice calls (Phase 3; all optional) ---
  VAPI_API_KEY: z.string().optional(),            // Vapi private key
  VAPI_PHONE_NUMBER_ID: z.string().optional(),    // outbound caller id (Vapi)
  VAPI_ASSISTANT_ID: z.string().optional(),       // optional pre-built assistant; else inline
  VAPI_WEBHOOK_SECRET: z.string().optional(),     // verifies X-Vapi-Signature header
  VAPI_VOICE_ID: z.string().default('elliot'),    // default voice
  // Comma-separated brand/program words to boost in the STT transcriber and as
  // pronunciation hints in the assistant prompt. Lets you tune for new programs
  // without redeploying. Example: "Shreevan,Shreevan Wellness,Sattva".
  VOICE_VOCAB_BOOST: z.string().default('Shreevan,Shreevan Wellness,Sattva,Veda,Ayurveda,sattvic,namaste,pranayama'),

  // --- Live Classes video (100ms / HMS; all optional — video no-ops until set) ---
  HMS_ACCESS_KEY: z.string().optional(),   // 100ms App Access Key
  HMS_SECRET: z.string().optional(),       // 100ms App Secret (signs room/auth tokens)
  HMS_TEMPLATE_ID: z.string().optional(),  // 100ms template rooms are created from
  // Role names MUST match the roles defined in the 100ms template. Defaults suit
  // the "Video Conferencing" template; a "Virtual Classroom" template often uses
  // teacher/student (or similar) — set these to match, no code change needed.
  HMS_HOST_ROLE: z.string().default('host'),   // teacher — publishes video/audio
  HMS_GUEST_ROLE: z.string().default('guest'), // student default — view-only at scale
  HMS_STAGE_ROLE: z.string().default('guest'), // role a raised-hand student is promoted to (can publish)
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  // Production guard: simulation must never be on in production.
  if (parsed.data.NODE_ENV === 'production' && parsed.data.ENABLE_SIMULATION) {
    throw new Error('ENABLE_SIMULATION must be false in production.');
  }
  return parsed.data;
}
