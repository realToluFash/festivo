import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const rangesLine = (ranges) => {
  const dir = mkdtempSync(join(tmpdir(), 'deploy-preflight-'));
  const envFile = join(dir, '.env');
  writeFileSync(envFile, `MAIL_WEBHOOK_ALLOWED_RANGES="${ranges}"\n`, { mode: 0o600 });
  const { stdout } = spawnSync('bash', ['deploy/preflight.sh'], {
    env: { PATH: process.env.PATH, DEPLOY_ENV_FILE: envFile, DEPLOY_SECRETS_DIR: dir },
    encoding: 'utf8',
  });
  return stdout.split('\n').find((line) => line.includes('MAIL_WEBHOOK_ALLOWED_RANGES holds'));
};

describe('the pre-flight', () => {
  it.each(['10.0.0.0/8', '10.1.0.0/16', '3.4.5.0/24, 192.168.0.0/16', '172.20.1.1', '0.0.0.0/0'])(
    'refuses %s, which reaches a private range',
    (ranges) => {
      expect(rangesLine(ranges)).toMatch(/^FAIL/);
    },
  );

  it.each(['not-a-range', '10.0.0.0/33', '300.1.2.3/32', '3.4.5.0/24, 3.4.5'])(
    'refuses %s, which the API cannot read',
    (ranges) => {
      expect(rangesLine(ranges)).toMatch(/^FAIL.*not an IPv4 range/);
    },
  );

  it.each(['3.4.5.0/24', '3.4.5.0/24, 52.1.0.0/16', '172.32.0.0/16', '3.4.5.0/24,'])(
    'accepts %s, which reaches none',
    (ranges) => {
      expect(rangesLine(ranges)).toMatch(/^ok/);
    },
  );
});
