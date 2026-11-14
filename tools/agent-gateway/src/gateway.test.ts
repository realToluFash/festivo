import { afterEach, describe, expect, it } from 'vitest';
import { start, type Harness } from './testing/harness.ts';
import { calls, says, ScriptedWorker } from './testing/scriptedWorker.ts';
import { WorkerFailed, type WorkerResult, type WorkerTask } from './worker.ts';

const COUNT_REPLIES = {
  name: 'count_replies',
  description: 'Count the RSVP replies for an event.',
  input_schema: {
    type: 'object',
    properties: {
      event_id: { type: 'string' },
      answer: { type: 'string', enum: ['yes', 'no', 'maybe'] },
    },
    required: ['event_id'],
  },
};

function ask(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    system: [
      { type: 'text', text: 'You are the assistant inside Soirely.' },
      {
        type: 'text',
        text: 'Today is Wednesday.',
        cache_control: { type: 'ephemeral', ttl: '5m' },
      },
    ],
    messages: [{ role: 'user', content: 'How many guests said yes?' }],
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium' },
    ...overrides,
  };
}

let harness: Harness | null = null;

async function gateway(worker: ScriptedWorker): Promise<Harness> {
  harness = await start(worker);

  return harness;
}

afterEach(async () => {
  await harness?.close();
  harness = null;
});

describe('an answer', () => {
  it('without tools is one text block that ends the turn', async () => {
    const sent = await (await gateway(new ScriptedWorker(says('Forty-two.')))).send(ask());

    expect(sent.status).toBe(200);
    expect(sent.body['content']).toEqual([{ type: 'text', text: 'Forty-two.' }]);
    expect(sent.body['stop_reason']).toBe('end_turn');
    expect(sent.body['id']).toMatch(/^msg_/);
  });

  it('that calls a tool is one tool_use block with a toolu_ id', async () => {
    const worker = new ScriptedWorker(calls('count_replies', { event_id: 'evt_1', answer: 'yes' }));
    const sent = await (await gateway(worker)).send(ask({ tools: [COUNT_REPLIES] }));

    expect(sent.status).toBe(200);
    expect(sent.body['stop_reason']).toBe('tool_use');
    expect(sent.body['content']).toEqual([
      {
        type: 'tool_use',
        id: expect.stringMatching(/^toolu_/) as unknown,
        name: 'count_replies',
        input: { event_id: 'evt_1', answer: 'yes' },
      },
    ]);
  });

  it('continues the conversation from a tool_result sent back', async () => {
    const worker = new ScriptedWorker(says('42 said yes.'));
    const sent = await (
      await gateway(worker)
    ).send(
      ask({
        tools: [COUNT_REPLIES],
        messages: [
          { role: 'user', content: 'How many guests said yes?' },
          {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'toolu_01A',
                name: 'count_replies',
                input: { event_id: 'evt_1' },
              },
            ],
          },
          {
            role: 'user',
            content: [{ type: 'tool_result', tool_use_id: 'toolu_01A', content: '{"count":42}' }],
          },
        ],
      }),
    );

    expect(sent.status).toBe(200);
    expect(sent.body['content']).toEqual([{ type: 'text', text: '42 said yes.' }]);
    expect(worker.tasks[0]?.prompt).toContain(
      '<tool_result tool_use_id="toolu_01A">{"count":42}</tool_result>',
    );
    expect(worker.tasks[0]?.prompt).toContain('<tool_use id="toolu_01A" name="count_replies">');
  });

  it('too long for max_tokens stops at max_tokens with the text so far', async () => {
    const text = 'Dear guests, welcome. '.repeat(100);
    const worker = new ScriptedWorker(says(text, 600));
    const sent = await (await gateway(worker)).send(ask({ max_tokens: 200 }));

    expect(sent.body['stop_reason']).toBe('max_tokens');
    const [block] = sent.body['content'] as Array<{ text: string }>;
    expect(text.startsWith(block?.text ?? 'missing')).toBe(true);
    expect(block?.text.length).toBeLessThan(text.length);
    expect((sent.body['usage'] as Record<string, number>)['output_tokens']).toBe(200);
    expect(sent.headers.get('x-soirely-usage')).toBe('estimated');
  });

  it('carries the usage the worker reported, unmarked', async () => {
    const sent = await (await gateway(new ScriptedWorker(says('Forty-two.', 12)))).send(ask());

    expect(sent.body['usage']).toMatchObject({ input_tokens: 900, output_tokens: 12 });
    expect(sent.headers.get('x-soirely-usage')).toBeNull();
  });

  it('estimates usage the worker could not report, and says so', async () => {
    const worker = new ScriptedWorker({ ...says('Forty-two.'), usage: null });
    const sent = await (await gateway(worker)).send(ask());
    const usage = sent.body['usage'] as Record<string, number>;

    expect(usage['input_tokens']).toBeGreaterThan(0);
    expect(usage['output_tokens']).toBeGreaterThan(0);
    expect(sent.headers.get('x-soirely-usage')).toBe('estimated');
  });

  it('that the model declined is a refusal, as Anthropic sends it', async () => {
    const worker = new ScriptedWorker({ output: null, stopReason: 'refusal', usage: null });
    const sent = await (await gateway(worker)).send(ask());

    expect(sent.status).toBe(200);
    expect(sent.body['stop_reason']).toBe('refusal');
    expect(sent.body['content']).toEqual([]);
  });
});

describe('the worker', () => {
  it('is given the model, the effort and adaptive thinking', async () => {
    const worker = new ScriptedWorker(says('Forty-two.'));
    await (await gateway(worker)).send(ask({ output_config: { effort: 'high' } }));

    expect(worker.tasks[0]).toMatchObject({
      model: 'claude-opus-5-5',
      effort: 'high',
      thinking: { type: 'adaptive' },
    });
  });

  it("is given the request's system blocks and a schema offering each tool", async () => {
    const worker = new ScriptedWorker(says('Forty-two.'));
    await (await gateway(worker)).send(ask({ tools: [COUNT_REPLIES] }));
    const task = worker.tasks[0] as WorkerTask;

    expect(task.system).toContain('You are the assistant inside Soirely.');
    expect(task.system).toContain('Today is Wednesday.');
    expect(JSON.stringify(task.schema)).toContain('"name":{"const":"count_replies"}');
  });

  it('whose tool input breaks the schema is asked once more', async () => {
    const worker = new ScriptedWorker(
      calls('count_replies', { answer: 'yes' }),
      calls('count_replies', { event_id: 'evt_1' }),
    );
    const sent = await (await gateway(worker)).send(ask({ tools: [COUNT_REPLIES] }));

    expect(worker.tasks).toHaveLength(2);
    expect(sent.status).toBe(200);
    expect((sent.body['content'] as Array<Record<string, unknown>>)[0]?.['input']).toEqual({
      event_id: 'evt_1',
    });
  });

  it('that breaks the schema twice is a 500, and the invalid input never reaches the caller', async () => {
    const worker = new ScriptedWorker(
      calls('count_replies', { answer: 'perhaps' }),
      calls('move_guest', { guest: 'g_1' }),
    );
    const sent = await (await gateway(worker)).send(ask({ tools: [COUNT_REPLIES] }));

    expect(worker.tasks).toHaveLength(2);
    expect(sent.status).toBe(500);
    expect(sent.body['error']).toMatchObject({ type: 'api_error' });
    expect(JSON.stringify(sent.body)).not.toContain('perhaps');
  });

  it('that fails is a 500 api_error', async () => {
    const sent = await (await gateway(new ScriptedWorker(new WorkerFailed('crashed')))).send(ask());

    expect(sent.status).toBe(500);
    expect(sent.body).toMatchObject({ type: 'error', error: { type: 'api_error' } });
  });

  it('already running makes a second request a 529 overloaded_error', async () => {
    let finish = (_: WorkerResult): void => {};
    const held = new Promise<WorkerResult>((resolve) => (finish = resolve));
    const g = await gateway(new ScriptedWorker(() => held, says('Second.')));

    const first = g.send(ask());
    await new Promise((resolve) => setTimeout(resolve, 50));
    const second = await g.send(ask());
    finish(says('First.'));

    expect(second.status).toBe(529);
    expect(second.body['error']).toMatchObject({ type: 'overloaded_error' });
    expect((await first).status).toBe(200);
    expect((await g.send(ask())).status).toBe(200);
  });

  it('is cancelled when the caller hangs up', async () => {
    let cancelled = false;
    const worker = new ScriptedWorker();
    worker.run = (task) =>
      new Promise<WorkerResult>((_, reject) => {
        task.signal.addEventListener('abort', () => {
          cancelled = true;
          reject(new Error('aborted'));
        });
      });
    const caller = new AbortController();
    const sent = (await gateway(worker)).send(ask(), { signal: caller.signal }).catch(() => null);

    await new Promise((resolve) => setTimeout(resolve, 50));
    caller.abort();
    await sent;
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(cancelled).toBe(true);
  });

  it('is not asked again once the caller has hung up', async () => {
    const caller = new AbortController();
    const worker = new ScriptedWorker(
      async () => {
        caller.abort();
        await new Promise((resolve) => setTimeout(resolve, 50));

        return calls('count_replies', { answer: 'yes' });
      },
      calls('count_replies', { event_id: 'evt_1' }),
    );

    const g = await gateway(worker);

    await g.send(ask({ tools: [COUNT_REPLIES] }), { signal: caller.signal }).catch(() => null);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(worker.tasks).toHaveLength(1);
  });
});

describe('a request the gateway refuses', () => {
  it.each([
    ['without max_tokens', { max_tokens: undefined }, 'max_tokens'],
    ['without messages', { messages: [] }, 'messages'],
    ['with a field the API does not know', { temperature_k: 1 }, 'temperature_k'],
    ['that streams', { stream: true }, 'stream'],
    [
      'with an image',
      { messages: [{ role: 'user', content: [{ type: 'image', source: {} }] }] },
      'image',
    ],
    [
      'with a server tool',
      { tools: [{ type: 'web_search_20250305', name: 'web_search' }] },
      'web_search',
    ],
    ['that forces a tool', { tools: [COUNT_REPLIES], tool_choice: { type: 'any' } }, 'tool_choice'],
    ['with stop sequences', { stop_sequences: ['END'] }, 'stop_sequences'],
    [
      'with a tool schema Ajv cannot compile',
      { tools: [{ ...COUNT_REPLIES, input_schema: { type: 'object', properties: [] } }] },
      'tools.0.input_schema',
    ],
  ])('%s is a 400 naming it', async (_, overrides, named) => {
    const sent = await (await gateway(new ScriptedWorker())).send(ask(overrides));

    expect(sent.status).toBe(400);
    expect(sent.body['error']).toMatchObject({ type: 'invalid_request_error' });
    expect(JSON.stringify(sent.body['error'])).toContain(named);
  });

  it('that is not JSON is a 400', async () => {
    const sent = await (await gateway(new ScriptedWorker())).send('{not json');

    expect(sent.status).toBe(400);
    expect(sent.body['error']).toMatchObject({ type: 'invalid_request_error' });
  });

  it.each([
    ['a wrong key', 'not-the-key'],
    ['no key', null],
  ])('with %s is a 401 authentication_error', async (_, key) => {
    const sent = await (await gateway(new ScriptedWorker())).send(ask(), { key });

    expect(sent.status).toBe(401);
    expect(sent.body).toMatchObject({ type: 'error', error: { type: 'authentication_error' } });
  });

  it.each([
    ['GET', '/v1/models'],
    ['POST', '/v1/messages/count_tokens'],
    ['POST', '/v1/complete'],
    ['GET', '/v1/messages'],
  ])('to %s %s is a 404 naming it', async (method, path) => {
    const sent = await (await gateway(new ScriptedWorker())).send(ask(), { method, path });

    expect(sent.status).toBe(404);
    expect(sent.body['error']).toMatchObject({ type: 'not_found_error' });
    expect(JSON.stringify(sent.body['error'])).toContain(`${method} ${path}`);
  });
});
