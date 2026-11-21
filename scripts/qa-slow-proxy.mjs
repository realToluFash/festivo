#!/usr/bin/env node
import { request as httpRequest, createServer } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

export function holds(method, url, pattern) {
  if (method !== 'GET') return false;
  const path = new URL(url, 'http://proxy').pathname;
  return pattern.test(path);
}

export function startProxy({ target, delay, pattern, port = 0, host = '127.0.0.1' }) {
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

    if (holds(req.method, req.url, pattern)) {
      req.pause();
      const held = setTimeout(() => {
        req.resume();
        forward();
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
      delay: { type: 'string', default: '5000' },
      path: { type: 'string', default: '^/api/events/[^/]+/guests$' },
      port: { type: 'string', default: '0' },
      host: { type: 'string', default: '127.0.0.1' },
    },
  });
  if (!values.target) {
    console.error(
      'usage: node scripts/qa-slow-proxy.mjs --target <api url> [--delay ms] [--path regex] [--port n] [--host addr]',
    );
    process.exit(2);
  }
  const server = await startProxy({
    target: values.target,
    delay: Number(values.delay),
    pattern: new RegExp(values.path),
    port: Number(values.port),
    host: values.host,
  });
  const { port } = server.address();
  console.log(
    `qa-slow-proxy: http://${values.host}:${port} → ${values.target}, GET ${values.path} held ${values.delay} ms`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
