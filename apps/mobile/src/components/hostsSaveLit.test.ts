import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { hostsChanged, newEventHosts } from '@soirely/domain';
import { describe, expect, it } from 'vitest';

const parts = readFileSync(join('src', 'components', 'EventPartEdits.tsx'), 'utf8');
const hostsEdit = parts.slice(
  parts.indexOf('function HostsEdit('),
  parts.indexOf('\n}\n', parts.indexOf('function HostsEdit(')),
);
const rows = (...names: string[]) => names.map((name, key) => ({ key, name }));
const lit = (saved: string[], typed: string[]) =>
  hostsChanged(
    saved,
    newEventHosts(rows(...typed)).map((host) => host.name),
  );

describe('Hosted by lights Save as the demo does (sc-15497)', () => {
  it('keeps Save greyed on a hostless draft while Add a host’s row is still empty', () => {
    expect(lit([], [''])).toBe(false);
    expect(lit([], ['  '])).toBe(false);
  });

  it('lights Save once that row has a name, or a saved host is cleared or added to', () => {
    expect(lit([], ['Funmi'])).toBe(true);
    expect(lit(['Funmi'], [''])).toBe(true);
    expect(lit(['Funmi'], ['Funmi', ''])).toBe(true);
    expect(lit([], ['', ''])).toBe(true);
  });

  it('is what the part edit hands its shell', () => {
    expect(hostsEdit).toMatch(
      /changed=\{hostsChanged\(\s+event\.hosts,\s+newEventHosts\(hosts\)\.map\(\(host\) => host\.name\),\s+\)\}/u,
    );
  });
});
