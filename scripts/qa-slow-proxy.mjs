#!/usr/bin/env node
import { request as httpRequest, createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { request as httpsRequest } from 'node:https';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

export function holds(method, url, pattern, held = 'GET') {
  if (method !== held) return false;
  const path = new URL(url, 'http://proxy').pathname;
  return pattern.test(path);
}

export function startProxy({
  target,
  delay,
  pattern,
  method = 'GET',
  status,
  body,
  port = 0,
  host = '127.0.0.1',
}) {
  const upstream = new URL(target);
  const send = upstream.protocol === 'https:' ? httpsRequest : httpRequest;

  const server = createServer((req, res) => {
    const forward = () => {
      const out = send(
        {
          protocol: upstream.protocol,
          hostname: upstream.hostname,
          port: upstream.port,
          method: req.method,
          path: req.url,
          headers: { ...req.headers, host: upstream.host },
        },
        (answer) => {
          res.writeHead(answer.statusCode ?? 502, answer.headers);
          answer.pipe(res);
        },
      );
      out.on('error', (error) => {
        if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain' });
        res.end(`qa-slow-proxy: ${error.message}\n`);
      });
      req.pipe(out);
    };

    const answer = () => {
      req.resume();
      res.writeHead(status ?? 200, { 'content-type': 'application/json' });
      res.end(body ?? '');
    };

    if (holds(req.method, req.url, pattern, method)) {
      req.pause();
      const held = setTimeout(() => {
        if (status === undefined && body === undefined) {
          req.resume();
          forward();
        } else {
          answer();
        }
      }, delay);
      res.on('close', () => clearTimeout(held));
    } else {
      forward();
    }
  });

  return new Promise((resolve) => {
    server.listen(port, host, () => resolve(server));
  });
}

async function main() {
  const { values } = parseArgs({
    options: {
      target: { type: 'string' },
      delay: { type: 'string' },
      status: { type: 'string' },
      body: { type: 'string' },
      method: { type: 'string', default: 'GET' },
      path: { type: 'string', default: '^/api/events/[^/]+/guests$' },
      port: { type: 'string', default: '0' },
      host: { type: 'string', default: '127.0.0.1' },
    },
  });
  if (!values.target) {
    console.error(
      'usage: node scripts/qa-slow-proxy.mjs --target <api url> [--delay ms] [--status code] [--body file.json] [--method GET|POST|…] [--path regex] [--port n] [--host addr]',
    );
    process.exit(2);
  }
  const answers = values.status !== undefined || values.body !== undefined;
  const delay = Number(values.delay ?? (answers ? 0 : 5000));
  const status = values.status === undefined ? undefined : Number(values.status);
  const body = values.body === undefined ? undefined : readFileSync(values.body, 'utf8');
  const server = await startProxy({
    target: values.target,
    delay,
    status,
    body,
    pattern: new RegExp(values.path),
    method: values.method.toUpperCase(),
    port: Number(values.port),
    host: values.host,
  });
  const { port } = server.address();
  const outcome = answers
    ? `answered ${status ?? 200}${values.body ? ` with ${values.body}` : ''}`
    : 'forwarded';
  console.log(
    `qa-slow-proxy: http://${values.host}:${port} → ${values.target}, ${values.method.toUpperCase()} ${values.path} held ${delay} ms, then ${outcome}`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
