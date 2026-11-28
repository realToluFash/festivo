import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// The stub lists its services and then thousands more, so a pipe into grep -q would
// break compose's output on every run rather than on some.
const restore = (services) => {
  const dir = mkdtempSync(join(tmpdir(), 'deploy-restore-'));
  const log = join(dir, 'docker.log');
  const docker = join(dir, 'docker');
  writeFileSync(
    docker,
    `#!/usr/bin/env bash
echo "$*" >>"${log}"
if [[ " $* " == *" config --services "* ]]; then
  printf '%s\\n' ${services.join(' ')}
  for i in $(seq 1 20000); do echo "unrelated-$i"; done
fi
exit 0
`,
  );
  chmodSync(docker, 0o755);
  const identity = join(dir, 'identity');
  writeFileSync(identity, '');
  const result = spawnSync('bash', ['deploy/restore.sh', '2026-11-23', identity], {
    env: {
      PATH: `${dir}:${process.env.PATH}`,
      RESTORE_KEY: 'key',
      RESTORE_SECRET: 'secret',
      RESTORE_PROJECT: 'rehearsal',
      RESTORE_COMPOSE_FILE: join(dir, 'compose.yaml'),
      RESTORE_IMAGE: 'soirely-backup:rehearsal',
      BACKUP_BUCKET: 'bucket',
      BACKUP_REGION: 'region',
    },
    encoding: 'utf8',
  });
  const calls = readFileSync(log, 'utf8').trim().split('\n');
  return { status: result.status, stderr: result.stderr, calls };
};

describe('the restore (sc-30204)', () => {
  it('reads the services once and stops every one that serves', () => {
    const { status, calls } = restore([
      'postgres',
      'proxy',
      'api',
      'notification-worker',
      'service-heartbeat',
      'scheduler',
      'backup',
    ]);

    expect(status).toBe(0);
    expect(calls.filter((call) => call.includes('config --services'))).toHaveLength(1);
    expect(calls.find((call) => call.includes(' stop '))).toMatch(
      / stop proxy api notification-worker service-heartbeat scheduler backup$/,
    );
  });

  it('stops only those the project has', () => {
    const { calls } = restore(['postgres', 'api', 'scheduler']);

    expect(calls.find((call) => call.includes(' stop '))).toMatch(/ stop api scheduler$/);
  });

  it('refuses before fetching anything when the project has no api', () => {
    const { status, stderr, calls } = restore(['postgres', 'proxy']);

    expect(status).not.toBe(0);
    expect(stderr).toMatch(/no api service/);
    expect(calls.some((call) => call.startsWith('run '))).toBe(false);
  });
});
