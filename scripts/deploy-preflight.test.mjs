import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const rangesLines = (ranges) => {
  const dir = mkdtempSync(join(tmpdir(), 'deploy-preflight-'));
  const envFile = join(dir, '.env');
  writeFileSync(envFile, `MAIL_WEBHOOK_ALLOWED_RANGES="${ranges}"\n`, { mode: 0o600 });
  const { stdout } = spawnSync('bash', ['deploy/preflight.sh'], {
    env: { PATH: process.env.PATH, DEPLOY_ENV_FILE: envFile, DEPLOY_SECRETS_DIR: dir },
    encoding: 'utf8',
  });
  return stdout.split('\n').filter((line) => line.includes('MAIL_WEBHOOK_ALLOWED_RANGES holds'));
};

describe('the pre-flight', () => {
  it.each([
    'not-a-range',
    '10.0.0.0/33',
    '300.1.2.3/32',
    '3.4.5.0/',
    '3.4.5.0/24/8',
    '2600:1f18::/129',
    '2600:zz::/32',
  ])('refuses %s, which it cannot read', (range) => {
    const lines = rangesLines(range);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^FAIL/);
    expect(lines[0]).toContain(range);
  });

  it.each([
    '169.254.0.0/16',
    '100.64.1.0/24',
    '198.51.100.0/24',
    '224.0.0.1',
    '0.0.0.0/0',
    '8.0.0.0/4',
    '10.1.0.0/16',
    '172.20.1.1',
    '192.168.0.0/16',
    '::1',
    '::/0',
    'fd00::/8',
    'fe80::/10',
    'ff02::1',
    '::ffff:3.4.5.6',
    '2001:db8::/32',
  ])('refuses %s, which reaches addresses no internet caller comes from', (range) => {
    const lines = rangesLines(`3.4.5.0/24, ${range}`);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^FAIL/);
    expect(lines[0]).toContain(range);
    expect(lines[0]).not.toContain('3.4.5.0/24');
  });

  it('names every refused item in one line', () => {
    const lines = rangesLines('not-a-range, 3.4.5.0/24, fd00::/8, 10.1.0.0/16');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^FAIL .*not-a-range fd00::\/8 10\.1\.0\.0\/16/);
  });

  it.each([',', ', ,'])('refuses %j, which holds no item', (ranges) => {
    expect(rangesLines(ranges)).toEqual([expect.stringMatching(/^FAIL/)]);
  });

  it.each([
    '3.4.5.0/24',
    '3.4.5.6',
    '3.4.5.6/24',
    '3.4.5.0/24, 52.1.0.0/16',
    '172.32.0.0/16',
    '2600:1f18::/32',
    '2a00:1450::/32',
    ' 3.4.5.0/24 , 2600:1f18::/32 ',
    '3.4.5.0/24,',
  ])('accepts %j', (ranges) => {
    expect(rangesLines(ranges)).toEqual([expect.stringMatching(/^ok/)]);
  });
});
