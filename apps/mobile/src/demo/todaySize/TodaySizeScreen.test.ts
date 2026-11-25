import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const screen = readFileSync(join('src', 'demo', 'todaySize', 'TodaySizeScreen.tsx'), 'utf8');

describe('the size demo on its side (sc-91291)', () => {
  it('wraps its page in the providers Today’s cover reads', () => {
    const side = /\n {2}if \(side\) \{[\s\S]*?\n {2}\}\n/u.exec(screen)?.[0] ?? '';
    expect(side).toMatch(
      /<OrgSwitcherProvider state=\{null\} tell=\{tell\}>\s+<TodayShellProvider value=\{shell\}>[\s\S]*\{page\}[\s\S]*<\/TodayShellProvider>\s+<\/OrgSwitcherProvider>/u,
    );
  });
});

describe('the size demo on the phone (sc-92247)', () => {
  it('wraps its page in the providers the pill reads', () => {
    const phone =
      /\n {2}return \(\n {4}<OrgSwitcherProvider[\s\S]*?\n {2}\);\n/u.exec(screen)?.[0] ?? '';
    expect(phone).toMatch(
      /<OrgSwitcherProvider state=\{null\} place=\{place\} tell=\{tell\}>\s+<TodayShellProvider value=\{shell\}>[\s\S]*\{page\}[\s\S]*<\/TodayShellProvider>\s+<\/OrgSwitcherProvider>/u,
    );
  });
});
