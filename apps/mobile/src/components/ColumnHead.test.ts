import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const summary = readFileSync(join('src', 'components', 'Summary.tsx'), 'utf8');
const frame = readFileSync(join('src', 'components', 'AppFrame.tsx'), 'utf8');
const members = readFileSync(join('app', 'settings', 'members.tsx'), 'utf8');

function columnHead(): string {
  const at = summary.indexOf('export function ColumnHead(');
  if (at < 0) throw new Error('Summary.tsx has no ColumnHead.');

  return summary.slice(at, summary.indexOf('\n}\n', at));
}

describe('Members in the Settings column on an iPad on its side, where the frame draws no top (sc-39471)', () => {
  it('moves screen reader focus to the column’s title after a tapped switch', () => {
    expect(columnHead()).toMatch(
      /<AnswerHeading\s+ref=\{titleRef\}\s+answer=\{useTappedSwitch\(\)\}/u,
    );
  });

  it('shows "Now working in …" under the column’s title', () => {
    expect(columnHead()).toMatch(/<\/View>\s+<FrameSwitched \/>\s+<\/>/u);
    expect(frame).toMatch(
      /export function FrameSwitched\(\) \{\s+return useContext\(ScrolledTop\)\?\.switched \?\? null;/u,
    );
  });

  it('gives the frame the column’s title, so the switcher hands focus back to it', () => {
    expect(members).toMatch(/: alone \|\| givesWay\s+\? membersTitle/u);
  });
});
