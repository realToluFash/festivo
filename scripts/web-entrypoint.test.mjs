import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const run = (env) => {
  const root = mkdtempSync(join(tmpdir(), 'web-entrypoint-'));
  execFileSync('sh', ['apps/web/docker-entrypoint.sh'], {
    env: {
      PATH: process.env.PATH,
      SOIRELY_WEB_ROOT: root,
      SOIRELY_HEADERS_FILE: join(root, 'headers.conf'),
      SOIRELY_API_URL: 'https://api.example.test',
      ...env,
    },
    stdio: 'pipe',
  });
  return root;
};

const json = (root, file) => JSON.parse(readFileSync(join(root, file), 'utf8'));

describe('the web entrypoint', () => {
  it('writes a quote or backslash in a value into config.json as it was given', () => {
    const root = run({ SOIRELY_SCHEME: 'a"b\\c', SOIRELY_GOOGLE_CLIENT_ID: 'x"y' });

    expect(json(root, 'config.json')).toMatchObject({
      scheme: 'a"b\\c',
      google: { clientId: 'x"y' },
    });
  });

  it("names support's address, Soirely's own when none is given", () => {
    expect(json(run({}), 'config.json').supportAddress).toBe('support@soirely.com');
    expect(
      json(run({ SOIRELY_SUPPORT_EMAIL: 'help@example.test' }), 'config.json').supportAddress,
    ).toBe('help@example.test');
  });

  it('keeps every fingerprint in assetlinks.json when one holds a quote', () => {
    const root = run({ SOIRELY_ANDROID_CERT_SHA256: 'AA:BB, CC"\\,DD' });

    expect(json(root, '.well-known/assetlinks.json')[0].target.sha256_cert_fingerprints).toEqual([
      'AA:BB',
      'CC"\\',
      'DD',
    ]);
  });

  it('lets the app use the passkeys and the links of this host on Android (sc-87083)', () => {
    const [statement] = json(
      run({ SOIRELY_ANDROID_CERT_SHA256: 'AA:BB' }),
      '.well-known/assetlinks.json',
    );

    expect(statement.relation).toEqual([
      'delegate_permission/common.handle_all_urls',
      'delegate_permission/common.get_login_creds',
    ]);
    expect(statement.target.package_name).toBe('com.soirely.app');
  });

  it('names the iOS app for passkeys and door code links in apple-app-site-association (sc-87083, sc-72)', () => {
    const root = run({ SOIRELY_APPLE_APP_ID: 'TEAM123.com.soirely.app' });

    expect(json(root, '.well-known/apple-app-site-association')).toEqual({
      webcredentials: { apps: ['TEAM123.com.soirely.app'] },
      applinks: {
        details: [{ appIDs: ['TEAM123.com.soirely.app'], components: [{ '/': '/d/*' }] }],
      },
    });
  });

  it('writes neither passkey file when nothing names the app', () => {
    const root = run({});

    expect(existsSync(join(root, '.well-known/assetlinks.json'))).toBe(false);
    expect(existsSync(join(root, '.well-known/apple-app-site-association'))).toBe(false);
  });

  it('lets styles and fonts come from its own origin alone (sc-80882)', () => {
    const policy = readFileSync(join(run({}), 'headers.conf'), 'utf8');

    expect(policy).toMatch(/style-src 'self';/);
    expect(policy).toMatch(/font-src 'self';/);
  });

  it('refuses to start on a control character, naming the variable', () => {
    expect(() => run({ SOIRELY_SCHEME: 'a\tb' })).toThrow(
      /SOIRELY_SCHEME contains a control character/,
    );
  });
});
