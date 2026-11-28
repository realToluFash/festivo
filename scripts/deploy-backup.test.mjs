import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const schedule = (crontab) =>
  crontab
    .split('\n')
    .filter((line) => /^\d/.test(line))
    .map((line) => {
      const [minute, hour, , , , ...command] = line.split(/\s+/);
      return { minute: Number(minute), hour: Number(hour), command: command.join(' ') };
    });

describe('the nightly backup (sc-30204)', () => {
  const backups = schedule(read('deploy/backup/crontab'));
  const backup = backups.find(({ command }) => command.endsWith('/backup.sh'));
  const check = backups.find(({ command }) => command.endsWith('/check.sh'));

  it('is taken at 04:00 UTC and checked for at 06:00 UTC', () => {
    expect(backup).toMatchObject({ hour: 4, minute: 0 });
    expect(check).toMatchObject({ hour: 6, minute: 0 });
  });

  it("is taken after every one of the API's nightly jobs, so it never holds what a prune removed", () => {
    const nightly = schedule(read('services/api/config/crontab')).filter(
      ({ hour }) => !Number.isNaN(hour),
    );

    expect(nightly.filter(({ command }) => command.includes('app:prune-')).length).toBeGreaterThan(
      0,
    );
    for (const job of nightly) {
      expect(job.hour * 60 + job.minute, job.command).toBeLessThan(
        backup.hour * 60 + backup.minute,
      );
    }
  });

  it('is deleted by the bucket after 35 days, with no old version or part left behind', () => {
    const [rule, ...others] = JSON.parse(read('deploy/backup/lifecycle.json')).Rules;

    expect(others).toEqual([]);
    expect(rule).toMatchObject({
      Status: 'Enabled',
      Filter: { Prefix: '' },
      Expiration: { Days: 35 },
      NoncurrentVersionExpiration: { NoncurrentDays: 1 },
      AbortIncompleteMultipartUpload: { DaysAfterInitiation: 1 },
    });
  });

  it("gives the bucket's credentials to the backup container alone", () => {
    const compose = read('deploy/compose.yaml');
    const envFiles = [...compose.matchAll(/env_file: (.+)/g)].map(([, file]) => file);

    expect(envFiles.filter((file) => file.includes('backup.env'))).toHaveLength(1);
    expect(read('deploy/env.example')).not.toMatch(/^(BACKUP_|AWS_)/m);
    expect(read('deploy/.gitignore').split('\n')).toContain('backup.env');
  });
});
