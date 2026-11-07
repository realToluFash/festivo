import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
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

  it('keeps every fingerprint in assetlinks.json when one holds a quote', () => {
    const root = run({ SOIRELY_ANDROID_CERT_SHA256: 'AA:BB, CC"\\,DD' });

    expect(json(root, '.well-known/assetlinks.json')[0].target.sha256_cert_fingerprints).toEqual([
      'AA:BB',
      'CC"\\',
      'DD',
    ]);
  });

  it('refuses to start on a control character, naming the variable', () => {
    expect(() => run({ SOIRELY_SCHEME: 'a\tb' })).toThrow(
      /SOIRELY_SCHEME contains a control character/,
    );
  });
});
