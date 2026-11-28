import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { type HostRow, movedHost, removedHost } from '@soirely/domain';
import { describe, expect, it } from 'vitest';

import { hostTarget } from './hostTarget.ts';

const edits = readFileSync(join('src', 'components', 'EventEdits.tsx'), 'utf8');
const rows = edits.slice(
  edits.indexOf('export function HostRows('),
  edits.indexOf('function MoveButton('),
);

const t = (key: string, values?: Record<string, unknown>) => `${key} ${JSON.stringify(values)}`;

const hosts: HostRow[] = [
  { key: 1, name: 'Funmi Adeyemi' },
  { key: 2, name: '' },
  { key: 3, name: 'Tayo Adeyemi' },
];

const targets = {
  names: new Map([1, 2, 3].map((key) => [key, `name.${key}`])),
  ups: new Map([2, 3].map((key) => [key, `up.${key}`])),
  downs: new Map([1, 2].map((key) => [key, `down.${key}`])),
  add: 'add',
};

function focusAfter(change: ReturnType<typeof movedHost>): string | null {
  if (change == null) throw new Error('refused');

  return hostTarget(change.focus, targets);
}

describe("HostRows' moves and removals go through @soirely/domain (sc-82892)", () => {
  it('moves and removes rows only through movedHost and removedHost', () => {
    expect(rows).toMatch(/onPress=\{\(\) => apply\(movedHost\(hosts, index, -1, t\)\)\}/u);
    expect(rows).toMatch(/onPress=\{\(\) => apply\(movedHost\(hosts, index, 1, t\)\)\}/u);
    expect(rows).toMatch(/onPress=\{\(\) => apply\(removedHost\(hosts, index, t\)\)\}/u);
    expect(rows).not.toMatch(/\.splice\(|hosts\.filter\(/u);
  });

  it('hands focus on once the rows have redrawn, without raising the keyboard', () => {
    expect(rows).toMatch(
      /focusNext\.current = \{ to: change\.focus, keys: false \};\s+onHosts\(change\.rows\);\s+onSaid\(change\.said\);/u,
    );
    expect(rows).toMatch(/moveScreenReaderFocus\(\s+hostTarget<ScreenReaderTarget>\(to,/u);
    expect(rows).toMatch(/ref=\{remembered\(ups, host\.key\)\}/u);
    expect(rows).toMatch(/ref=\{remembered\(downs, host\.key\)\}/u);
    expect(rows).toMatch(/ref=\{addButton\}/u);
  });

  it('leaves no second Hosted by list in the app', () => {
    expect(existsSync(join('src', 'components', 'HostsSection.tsx'))).toBe(false);
  });
});

describe('where focus goes after a move (sc-82892)', () => {
  it('stays on Move up while the row is not yet at the top', () => {
    const four = [...hosts, { key: 4, name: 'Ada' }];
    const change = movedHost(four, 3, -1, t);

    expect(change?.rows.map((row) => row.key)).toEqual([1, 2, 4, 3]);
    expect(hostTarget(change!.focus, { ...targets, ups: new Map([[4, 'up.4']]) })).toBe('up.4');
  });

  it('goes to Move down once a row reaches the top', () => {
    const change = movedHost(hosts, 1, -1, t);

    expect(change?.rows.map((row) => row.key)).toEqual([2, 1, 3]);
    expect(focusAfter(change)).toBe('down.2');
  });

  it('goes to Move up once a row reaches the bottom', () => {
    const change = movedHost(hosts, 1, 1, t);

    expect(change?.rows.map((row) => row.key)).toEqual([1, 3, 2]);
    expect(focusAfter(change)).toBe('up.2');
  });

  it('refuses the first row up and the last row down', () => {
    expect(movedHost(hosts, 0, -1, t)).toBeNull();
    expect(movedHost(hosts, 2, 1, t)).toBeNull();
  });

  it('announces the name, or the label of an empty row', () => {
    expect(movedHost(hosts, 2, -1, t)?.said).toBe(
      'eventHosts.moved {"name":"Tayo Adeyemi","position":2,"count":3}',
    );
    expect(movedHost(hosts, 1, -1, t)?.said).toBe(
      'eventHosts.moved {"name":"eventHosts.label {\\"position\\":2}","position":1,"count":3}',
    );
  });
});

describe('where focus goes after a removal (sc-82892)', () => {
  it("goes to the next row's name", () => {
    const change = removedHost(hosts, 0, t);

    expect(change?.rows.map((row) => row.key)).toEqual([2, 3]);
    expect(focusAfter(change)).toBe('name.2');
    expect(change?.said).toBe('eventHosts.removed {"name":"Funmi Adeyemi"}');
  });

  it('goes to Add a host when the removed row was the last', () => {
    const change = removedHost(hosts, 2, t);

    expect(change?.rows.map((row) => row.key)).toEqual([1, 2]);
    expect(focusAfter(change)).toBe('add');
  });

  it('calls an empty row by its label', () => {
    expect(removedHost(hosts, 1, t)?.said).toBe(
      'eventHosts.removed {"name":"eventHosts.label {\\"position\\":2}"}',
    );
  });
});
