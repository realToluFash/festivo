import type { AddressInfo } from 'node:net';
import { Gateway, type IdSource } from '../gateway.ts';
import { gatewayServer } from '../server.ts';
import type { Worker } from '../worker.ts';

export const KEY = 'test-gateway-key';

export type Sent = { status: number; headers: Headers; body: Record<string, unknown> };

export type Harness = {
  send(
    body: unknown,
    init?: { key?: string | null; path?: string; method?: string; signal?: AbortSignal },
  ): Promise<Sent>;
  close(): Promise<void>;
};

export function countingIds(): IdSource {
  const counts = new Map<string, number>();

  return (prefix) => {
    const n = (counts.get(prefix) ?? 0) + 1;
    counts.set(prefix, n);

    return `${prefix}_01Gateway${String(n).padStart(13, '0')}`;
  };
}

export async function start(worker: Worker, ids: IdSource = countingIds()): Promise<Harness> {
  const server = gatewayServer(new Gateway(worker, ids), KEY);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    async send(body, init = {}) {
      const key = init.key === undefined ? KEY : init.key;
      const response = await fetch(`http://127.0.0.1:${port}${init.path ?? '/v1/messages'}`, {
        method: init.method ?? 'POST',
        headers: {
          'content-type': 'application/json',
          'anthropic-version': '2023-06-01',
          ...(key === null ? {} : { 'x-api-key': key }),
        },
        ...(init.method === 'GET'
          ? {}
          : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
        ...(init.signal === undefined ? {} : { signal: init.signal }),
      });

      return {
        status: response.status,
        headers: response.headers,
        body: (await response.json()) as Record<string, unknown>,
      };
    },
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
