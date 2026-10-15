import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { requireSameSiteApi } from './sameSite.ts';

describe('the API has to be the same site as the page', () => {
  it('allows the API on a sibling subdomain, which is the arrangement we deploy', () => {
    expect(() =>
      requireSameSiteApi('https://app.soirely.com', 'https://api.soirely.com'),
    ).not.toThrow();
  });

  it('allows the API on the page’s own domain', () => {
    expect(() =>
      requireSameSiteApi('https://soirely.com', 'https://api.soirely.com'),
    ).not.toThrow();
  });

  it('allows the development pair, which differ only by port', () => {
    expect(() =>
      requireSameSiteApi('http://localhost:5173', 'http://localhost:8080'),
    ).not.toThrow();
  });

  it('allows a relative base URL, since a reverse proxy makes it same-origin', () => {
    expect(() => requireSameSiteApi('https://soirely.com', '/api')).not.toThrow();
  });

  it('refuses an unrelated registrable domain, naming both', () => {
    expect(() => requireSameSiteApi('https://soirely.com', 'https://soirely-api.com')).toThrow(
      /soirely-api\.com is not the same site as this page at https:\/\/soirely\.com/,
    );
  });

  it('refuses 127.0.0.1 against a page on localhost', () => {
    expect(() => requireSameSiteApi('http://localhost:5173', 'http://127.0.0.1:8080')).toThrow(
      /not the same site/,
    );
  });

  it('refuses an https API served to an http page', () => {
    expect(() => requireSameSiteApi('http://soirely.com', 'https://api.soirely.com')).toThrow(
      /not the same site/,
    );
  });

  it('allows the committed development configuration', () => {
    const raw = readFileSync(join(import.meta.dirname, '../public/config.json'), 'utf8');
    const { apiBaseUrl } = JSON.parse(raw) as { apiBaseUrl: string };

    expect(() => requireSameSiteApi('http://localhost:5173', apiBaseUrl)).not.toThrow();
  });

  it('says what to do about it', () => {
    expect(() => requireSameSiteApi('https://soirely.com', 'https://elsewhere.net')).toThrow(
      /serve it through this container at \/api/,
    );
  });
});
