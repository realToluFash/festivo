import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { start, type Harness } from './testing/harness.ts';
import { ScriptedWorker } from './testing/scriptedWorker.ts';
import { WorkerFailed, type WorkerResult } from './worker.ts';

const FIXTURES = join(import.meta.dirname, '../../../services/api/tests/Fixtures/AgentGateway');

type Recorded = { status: number; body: Record<string, unknown> };

type Pair = {
  source: string;
  request: Record<string, unknown>;
  apiKey: string | null;
  worker: WorkerResult | { fails: string } | { busy: true } | null;
  anthropic: Recorded;
  gateway: (Recorded & { headers: Record<string, string> }) | null;
};

const pairs = readdirSync(FIXTURES)
  .filter((file) => file.endsWith('.json'))
  .map((file) => ({ name: file.replace(/\.json$/, ''), path: join(FIXTURES, file) }));

let harness: Harness | null = null;

afterEach(async () => {
  await harness?.close();
  harness = null;
});

describe.each(pairs)('the recorded pair "$name"', ({ path }) => {
  const pair = JSON.parse(readFileSync(path, 'utf8')) as Pair;

  it('comes back from the gateway in the shape Anthropic answered it', async () => {
    const replayed = await replay(pair);

    expect(replayed.status).toBe(pair.anthropic.status);
    expect(Object.keys(replayed.body).sort()).toEqual(Object.keys(pair.anthropic.body).sort());

    if (pair.anthropic.body['type'] === 'error') {
      expect(errorType(replayed.body)).toBe(errorType(pair.anthropic.body));
    } else {
      expect(replayed.body['stop_reason']).toBe(pair.anthropic.body['stop_reason']);
      expect(blockTypes(replayed.body)).toEqual(blockTypes(pair.anthropic.body));
      expect(Object.keys(usage(replayed.body)).sort()).toEqual(
        Object.keys(usage(pair.anthropic.body)).sort(),
      );
    }

    if (process.env['UPDATE_GOLDEN'] === '1') {
      writeFileSync(path, `${JSON.stringify({ ...pair, gateway: replayed }, null, 2)}\n`);
    } else {
      expect(pair.gateway, 'run UPDATE_GOLDEN=1 npm test to write it').toEqual(replayed);
    }
  });
});

async function replay(pair: Pair): Promise<Recorded & { headers: Record<string, string> }> {
  const worker = pair.worker;
  let release = (): void => {};

  if (worker !== null && 'busy' in worker) {
    harness = await start(
      new ScriptedWorker(
        () =>
          new Promise<WorkerResult>((resolve) => {
            release = () => resolve({ output: null, stopReason: 'refusal', usage: null });
          }),
      ),
    );
    void harness.send(pair.request);
    await new Promise((resolve) => setTimeout(resolve, 50));
  } else if (worker !== null && 'fails' in worker) {
    harness = await start(new ScriptedWorker(new WorkerFailed(worker.fails)));
  } else {
    harness = await start(new ScriptedWorker(...(worker === null ? [] : [worker])));
  }

  const sent = await harness.send(pair.request, pair.apiKey === null ? {} : { key: pair.apiKey });
  release();

  const usageHeader = sent.headers.get('x-soirely-usage');

  return {
    status: sent.status,
    headers: usageHeader === null ? {} : { 'x-soirely-usage': usageHeader },
    body: sent.body,
  };
}

function errorType(body: Record<string, unknown>): unknown {
  return (body['error'] as Record<string, unknown>)['type'];
}

function blockTypes(body: Record<string, unknown>): string[] {
  return (body['content'] as Array<{ type: string }>)
    .map((block) => block.type)
    .filter((type) => type !== 'thinking');
}

function usage(body: Record<string, unknown>): Record<string, unknown> {
  return body['usage'] as Record<string, unknown>;
}
