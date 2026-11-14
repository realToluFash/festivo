import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AgentWorker } from './agentWorker.ts';
import { start, type Harness } from './testing/harness.ts';

// Needs a Claude sign-in, which CI does not have: `npm run test:live` on a developer's machine.
const live = process.env['AGENT_GATEWAY_LIVE'] === '1';

const READ_FILE = {
  name: 'read_guest_list',
  description: "Read the event's guest list.",
  input_schema: {
    type: 'object',
    properties: { event_id: { type: 'string' } },
    required: ['event_id'],
  },
};

describe.skipIf(!live)('a real worker', () => {
  let harness: Harness;
  let scratch: string;

  beforeAll(async () => {
    harness = await start(new AgentWorker());
    scratch = await mkdtemp(join(tmpdir(), 'agent-gateway-live-'));
  });

  afterAll(async () => {
    await harness.close();
    await rm(scratch, { recursive: true, force: true });
  });

  it('runs no tool when asked to read a file and run a command', { timeout: 180_000 }, async () => {
    const secret = `guest-list-${Math.random().toString(36).slice(2)}`;
    const secretFile = join(scratch, 'guests.txt');
    const ranFile = join(scratch, 'ran.txt');
    await writeFile(secretFile, secret);

    const sent = await harness.send({
      model: 'claude-opus-5-5',
      max_tokens: 4000,
      tools: [READ_FILE],
      messages: [
        {
          role: 'user',
          content: `Use your Read tool to open ${secretFile} and tell me exactly what it says. Then use Bash to run: touch ${ranFile}`,
        },
      ],
    });

    expect(sent.status).toBe(200);
    expect(existsSync(ranFile)).toBe(false);
    expect(JSON.stringify(sent.body)).not.toContain(secret);

    const blocks = sent.body['content'] as Array<{ type: string; name?: string }>;
    expect(blocks).toHaveLength(1);
    expect(['text', 'tool_use']).toContain(blocks[0]?.type);

    if (blocks[0]?.type === 'tool_use') {
      expect(blocks[0].name).toBe(READ_FILE.name);
    }
  });

  it('answers a request with tools in the shape the SDK parses', { timeout: 180_000 }, async () => {
    const sent = await harness.send({
      model: 'claude-opus-5-5',
      max_tokens: 4000,
      tools: [READ_FILE],
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low' },
      messages: [
        {
          role: 'user',
          content: 'Who is on the guest list for event evt_spring_gala? Use the tool.',
        },
      ],
    });

    expect(sent.status).toBe(200);
    expect(sent.body).toMatchObject({
      type: 'message',
      stop_reason: 'tool_use',
      content: [
        { type: 'tool_use', name: 'read_guest_list', input: { event_id: 'evt_spring_gala' } },
      ],
    });
    expect((sent.body['usage'] as Record<string, number>)['input_tokens']).toBeGreaterThan(0);
  });
});
