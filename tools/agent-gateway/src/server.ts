import { timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { GatewayError } from './errors.ts';
import type { Gateway, Reply } from './gateway.ts';

const MAX_BODY_BYTES = 8 * 1024 * 1024;

export function gatewayServer(gateway: Gateway, key: string): Server {
  return createServer((req, res) => {
    void handle(gateway, key, req, res);
  });
}

async function handle(
  gateway: Gateway,
  key: string,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const requestId = gateway.requestId();
  const disconnected = new AbortController();

  res.on('close', () => {
    if (!res.writableFinished) {
      disconnected.abort();
    }
  });

  let reply: Reply;

  try {
    reply = await route(gateway, key, req, disconnected.signal);
  } catch (error) {
    const failure =
      error instanceof GatewayError
        ? error
        : new GatewayError(
            500,
            'api_error',
            error instanceof Error ? error.message : 'The gateway failed.',
          );

    reply = { status: failure.status, headers: {}, body: failure.body(requestId) };
  }

  res.writeHead(reply.status, {
    ...reply.headers,
    'content-type': 'application/json',
    'request-id': requestId,
  });
  res.end(JSON.stringify(reply.body));
}

async function route(
  gateway: Gateway,
  key: string,
  req: IncomingMessage,
  signal: AbortSignal,
): Promise<Reply> {
  const path = new URL(req.url ?? '/', 'http://gateway').pathname;

  if (req.method !== 'POST' || path !== '/v1/messages') {
    throw new GatewayError(
      404,
      'not_found_error',
      `${req.method ?? 'GET'} ${path} is not supported by the agent gateway. It answers POST /v1/messages only.`,
    );
  }

  if (!sameKey(req.headers['x-api-key'], key)) {
    throw new GatewayError(401, 'authentication_error', 'invalid x-api-key');
  }

  return gateway.messages(await readJson(req), signal);
}

function sameKey(given: string | string[] | undefined, key: string): boolean {
  if (typeof given !== 'string') {
    return false;
  }

  const a = Buffer.from(given);
  const b = Buffer.from(key);

  return a.length === b.length && timingSafeEqual(a, b);
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of req) {
    size += (chunk as Buffer).length;

    if (size > MAX_BODY_BYTES) {
      throw GatewayError.invalid('The request body is larger than the agent gateway accepts.');
    }

    chunks.push(chunk as Buffer);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw GatewayError.invalid('The request body is not valid JSON.');
  }
}
