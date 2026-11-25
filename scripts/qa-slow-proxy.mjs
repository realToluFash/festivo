#!/usr/bin/env node
import { request as httpRequest, createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { request as httpsRequest } from 'node:https';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

export function holds(method, url, pattern, held = 'GET', query) {
  if (method !== held) return false;
  const { pathname, search } = new URL(url, 'http://proxy');
  return pattern.test(pathname) && (query === undefined || query.test(search.slice(1)));
}

export function startProxy({
  target,
  delay,
  pattern,
  query,
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

    if (holds(req.method, req.url, pattern, method, query)) {
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

const usage =
  'usage: node scripts/qa-slow-proxy.mjs --target <api url> [--delay ms] [--status code] [--body file.json] [--method GET|POST|…] [--path regex] [--query regex] [--port n] [--host addr]';

export class UsageError extends Error {}

export function proxyConfig(values, read = (file) => readFileSync(file, 'utf8')) {
  if (!values.target) throw new UsageError(usage);
  const answers = values.status !== undefined || values.body !== undefined;
  const delay = Number(values.delay ?? (answers ? 0 : 5000));
  let status;
  if (values.status !== undefined) {
    status = Number(values.status);
    if (!/^\d{3}$/.test(values.status) || status < 100 || status > 599) {
      throw new UsageError(`qa-slow-proxy: --status ${values.status} is not 100–599\n${usage}`);
    }
  }
  let body;
  if (values.body !== undefined) {
    body = read(values.body);
    try {
      JSON.parse(body);
    } catch (error) {
      throw new UsageError(`qa-slow-proxy: ${values.body} is not JSON: ${error.message}`);
    }
  }
  return { answers, delay, status, body };
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
      query: { type: 'string' },
      port: { type: 'string', default: '0' },
      host: { type: 'string', default: '127.0.0.1' },
    },
  });
  let config;
  try {
    config = proxyConfig(values);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    console.error(error.message);
    process.exit(2);
  }
  const { answers, delay, status, body } = config;
  const server = await startProxy({
    target: values.target,
    delay,
    status,
    body,
    pattern: new RegExp(values.path),
    query: values.query === undefined ? undefined : new RegExp(values.query),
    method: values.method.toUpperCase(),
    port: Number(values.port),
    host: values.host,
  });
  const { port } = server.address();
  const outcome = answers
    ? `answered ${status ?? 200}${values.body ? ` with ${values.body}` : ''}`
    : 'forwarded';
  console.log(
    `qa-slow-proxy: http://${values.host}:${port} → ${values.target}, ${values.method.toUpperCase()} ${values.path}${values.query === undefined ? '' : ` ?${values.query}`} held ${delay} ms, then ${outcome}`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
