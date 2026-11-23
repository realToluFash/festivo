import { createServer } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';

import { holds, proxyConfig, startProxy, UsageError } from './qa-slow-proxy.mjs';

const guests = /^\/api\/events\/[^/]+\/guests$/;

describe('which requests the proxy holds', () => {
  it('holds a GET of the guest list, with or without a query', () => {
    expect(holds('GET', '/api/events/ev1/guests', guests)).toBe(true);
    expect(holds('GET', '/api/events/ev1/guests?page=2', guests)).toBe(true);
  });

  it('lets other methods and other paths straight through', () => {
    expect(holds('POST', '/api/events/ev1/guests', guests)).toBe(false);
    expect(holds('GET', '/api/events/ev1/guests/export', guests)).toBe(false);
    expect(holds('GET', '/api/events/ev1', guests)).toBe(false);
  });

  it('holds the method it was given instead of GET', () => {
    expect(holds('POST', '/api/events/ev1/guests', guests, 'POST')).toBe(true);
    expect(holds('GET', '/api/events/ev1/guests', guests, 'POST')).toBe(false);
  });
});

describe('what the options ask the proxy to do', () => {
  const target = 'http://127.0.0.1:8080';
  const read = (files) => (file) => files[file];

  it('holds for five seconds and forwards when it is only holding', () => {
    expect(proxyConfig({ target })).toEqual({
      answers: false,
      delay: 5000,
      status: undefined,
      body: undefined,
    });
  });

  it('answers at once when given a status or a body without a delay', () => {
    expect(proxyConfig({ target, status: '503' })).toMatchObject({
      answers: true,
      delay: 0,
      status: 503,
    });
    expect(
      proxyConfig({ target, body: 'a.json' }, read({ 'a.json': '{"guests":[]}' })),
    ).toMatchObject({
      answers: true,
      delay: 0,
      body: '{"guests":[]}',
    });
  });

  it('waits as long as --delay says when answering', () => {
    expect(proxyConfig({ target, status: '500', delay: '2000' }).delay).toBe(2000);
  });

  it('refuses a status that is not a three-digit code from 100 to 599', () => {
    for (const status of ['abc', '5OO', '99', '600', '2000', '']) {
      expect(() => proxyConfig({ target, status })).toThrow(UsageError);
    }
  });

  it('refuses a body that is not JSON, naming the file', () => {
    expect(() =>
      proxyConfig({ target, body: 'edit.json' }, read({ 'edit.json': '{"guests":[1,]}' })),
    ).toThrow(/edit\.json is not JSON/);
  });

  it('refuses to start without a target', () => {
    expect(() => proxyConfig({})).toThrow(UsageError);
  });
});

describe('forwarding through the proxy', () => {
  const servers = [];
  afterEach(async () => {
    await Promise.all(servers.splice(0).map((s) => new Promise((done) => s.close(done))));
  });

  async function stack(delay, method, answer = {}) {
    const api = createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        res.writeHead(201, { 'x-api': 'yes' });
        res.end(`${req.method} ${req.url} ${body}`);
      });
    });
    await new Promise((done) => api.listen(0, '127.0.0.1', done));
    servers.push(api);
    const proxy = await startProxy({
      target: `http://127.0.0.1:${api.address().port}`,
      delay,
      pattern: guests,
      method,
      ...answer,
    });
    servers.push(proxy);
    return `http://127.0.0.1:${proxy.address().port}`;
  }

  it('answers a held GET only after the delay, with the API’s status, headers and body', async () => {
    const base = await stack(300);
    const started = Date.now();
    const answer = await fetch(`${base}/api/events/ev1/guests?page=2`);
    expect(Date.now() - started).toBeGreaterThanOrEqual(290);
    expect(answer.status).toBe(201);
    expect(answer.headers.get('x-api')).toBe('yes');
    expect(await answer.text()).toBe('GET /api/events/ev1/guests?page=2 ');
  });

  it('forwards anything else at once, body included', async () => {
    const base = await stack(5000);
    const started = Date.now();
    const answer = await fetch(`${base}/api/events/ev1/guests`, { method: 'POST', body: 'x=1' });
    expect(Date.now() - started).toBeLessThan(2000);
    expect(await answer.text()).toBe('POST /api/events/ev1/guests x=1');
  });

  it('holds a POST, body included, when told to hold POST', async () => {
    const base = await stack(300, 'POST');
    const started = Date.now();
    const answer = await fetch(`${base}/api/events/ev1/guests`, { method: 'POST', body: 'x=1' });
    expect(Date.now() - started).toBeGreaterThanOrEqual(290);
    expect(await answer.text()).toBe('POST /api/events/ev1/guests x=1');
  });

  it('answers a matched request with the status it was given, without asking the API', async () => {
    const base = await stack(0, 'GET', { status: 500 });
    const answer = await fetch(`${base}/api/events/ev1/guests`);
    expect(answer.status).toBe(500);
    expect(answer.headers.get('x-api')).toBeNull();
    const other = await fetch(`${base}/api/events/ev1`);
    expect(other.status).toBe(201);
  });

  it('answers a matched request with the body it was given, 200 unless told otherwise', async () => {
    const base = await stack(0, 'GET', { body: '{"paused":["org1"]}' });
    const answer = await fetch(`${base}/api/events/ev1/guests`);
    expect(answer.status).toBe(200);
    expect(answer.headers.get('content-type')).toBe('application/json');
    expect(await answer.json()).toEqual({ paused: ['org1'] });
  });

  it('holds an answer of its own for the delay too', async () => {
    const base = await stack(300, 'GET', { status: 503 });
    const started = Date.now();
    const answer = await fetch(`${base}/api/events/ev1/guests`);
    expect(Date.now() - started).toBeGreaterThanOrEqual(290);
    expect(answer.status).toBe(503);
  });

  it('answers 502 when the API is not there', async () => {
    const proxy = await startProxy({ target: 'http://127.0.0.1:1', delay: 0, pattern: guests });
    servers.push(proxy);
    const answer = await fetch(`http://127.0.0.1:${proxy.address().port}/api/health`);
    expect(answer.status).toBe(502);
  });
});
