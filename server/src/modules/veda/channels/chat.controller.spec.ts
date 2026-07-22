import { ChatController } from './chat.controller';

/** Minimal stubs — only the members chat/message touches. */
function makeController(overrides: {
  ingest?: () => unknown;
  respond?: () => unknown;
  handover?: boolean;
} = {}) {
  const messageCreate = jest.fn().mockResolvedValue({});
  const conversationUpdate = jest.fn().mockResolvedValue({});
  const prisma = {
    channelConnection: { findFirst: jest.fn().mockResolvedValue({ id: 'conn1' }) },
    conversation: {
      findUnique: jest.fn().mockResolvedValue({ handoverToHuman: overrides.handover ?? false }),
      update: conversationUpdate,
    },
    message: { create: messageCreate },
  };
  const ingestion = { ingest: jest.fn().mockImplementation(overrides.ingest ?? (() => ({ status: 'processed', conversationId: 'c1' }))) };
  const chat = { respond: jest.fn().mockImplementation(overrides.respond ?? (() => ({ reply: 'hi there' }))) };
  const tts = {};
  const learning = {};
  const controller = new ChatController(prisma as never, ingestion as never, chat as never, tts as never, learning as never);
  return { controller, messageCreate, conversationUpdate };
}

const DTO = { sessionId: 's1', message: 'send me details on WhatsApp', name: 'Rekha' } as never;

describe('ChatController.message — never 500s at a visitor', () => {
  it('returns Veda reply on the happy path', async () => {
    const { controller } = makeController();
    const res = await controller.message(DTO);
    expect(res.reply).toBe('hi there');
    expect(res.conversationId).toBe('c1');
  });

  it('degrades to the fallback when respond() THROWS (was a raw 500)', async () => {
    const { controller, messageCreate, conversationUpdate } = makeController({
      respond: () => { throw new Error('OpenAI request failed (500).'); },
    });
    const res = await controller.message(DTO); // must not throw
    expect(res.reply).toMatch(/Thank you for reaching out/);
    expect(res.conversationId).toBe('c1');
    // fallback persisted + flagged for staff
    expect(messageCreate).toHaveBeenCalledTimes(1);
    expect(conversationUpdate).toHaveBeenCalledTimes(1);
  });

  it('degrades to the fallback when ingestion itself throws (no conversation yet)', async () => {
    const { controller, messageCreate } = makeController({
      ingest: () => { throw new Error('DB unavailable'); },
    });
    const res = await controller.message(DTO); // must not throw
    expect(res.reply).toMatch(/Thank you for reaching out/);
    expect(res.conversationId).toBeUndefined();
    expect(messageCreate).not.toHaveBeenCalled(); // nothing to attach it to
  });

  it('persists the fallback when Veda returns null (unchanged existing path)', async () => {
    const { controller, messageCreate, conversationUpdate } = makeController({
      respond: () => ({ reply: null }),
    });
    const res = await controller.message(DTO);
    expect(res.reply).toMatch(/Thank you for reaching out/);
    expect(messageCreate).toHaveBeenCalledTimes(1);
    expect(conversationUpdate).toHaveBeenCalledTimes(1);
  });
});
