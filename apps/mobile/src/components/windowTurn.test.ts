import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// A window that goes as another comes must take its turn, or an iPad shows the second over nothing (sc-23267).
const HANDED_OVER = ['Sheet.tsx'];

function modals(file: string): string[] {
  const text = readFileSync(join(import.meta.dirname, file), 'utf8');

  return [...text.matchAll(/<Modal\b[\s\S]*?\n\s*>/g)].map(([tag]) => tag);
}

describe('the switcher and every sheet take turns for the window', () => {
  it.each(HANDED_OVER)(
    'in %s, a Modal is up only on its turn and says when it has gone',
    (file) => {
      const tags = modals(file);

      expect(tags).not.toHaveLength(0);
      for (const tag of tags) {
        expect(tag).toContain('visible={shown}');
        expect(tag).toContain('onDismiss={gone}');
      }
    },
  );

  it.each(HANDED_OVER)('in %s, the turn comes from the app’s one registry', (file) => {
    const text = readFileSync(join(import.meta.dirname, file), 'utf8');

    expect(text).toMatch(/const \{ shown, gone \} = useWindowTurn\(/);
  });
});

describe('a sheet’s entry, on a cold first open', () => {
  const sheet = readFileSync(join(import.meta.dirname, 'Sheet.tsx'), 'utf8');

  it('starts once the window’s views are laid out, not when the sheet is asked for', () => {
    expect(sheet).toMatch(/onLayout=\{\(event\) => \{[\s\S]*?setLaidOut\(true\);/);
    expect(sheet).toContain('if (!laidOut) return;');
  });

  it('waits again on the next open, once its window has gone', () => {
    expect(sheet).toMatch(
      /if \(!shown && \(onScreen \|\| laidOut\)\) \{[\s\S]*?setLaidOut\(false\);/,
    );
  });

  it('ends on the values it set out to reach', () => {
    expect(sheet).toMatch(/if \(!finished\) return;[\s\S]*?fade\.setValue\(1\);/);
  });
});

describe('a sheet whose heading takes focus as it opens (sc-11032)', () => {
  const sheet = readFileSync(join(import.meta.dirname, 'Sheet.tsx'), 'utf8');
  const twoFactor = readFileSync(join(import.meta.dirname, 'TwoFactorCard.tsx'), 'utf8');

  it('opens on Android with nothing in it for TalkBack to name the window by', () => {
    expect(sheet).toMatch(
      /useUnnamedWindow\(\s*Platform\.OS === 'android' && headingTakesFocus && shown,\s*onScreen,?\s*\)/,
    );
    expect(sheet).toContain("importantForAccessibility={unnamed ? 'no-hide-descendants' : 'auto'}");
  });

  it('counts the hidden time from when Android has put the window up, not from the render', () => {
    expect(sheet).toContain('onShow={() => setOnScreen(true)}');
    expect(sheet).toContain('if (!hides || !onScreen) return;');
  });

  it('stays hidden for a share of the settle time, long enough for TalkBack to name the window', () => {
    const [, delay] = sheet.match(/setTimeout\(\(\) => setAnnounced\(true\), ([^)]+)\)/) ?? [];

    expect(delay).toMatch(/^SETTLED_MS( \/ [1-9]\d*)?$/);
  });

  it('takes focus to its heading only once the content is revealed', () => {
    expect(twoFactor).toContain('answer={revealed ? answer : undefined}');
  });

  it('is how Save your recovery codes opens', () => {
    expect(twoFactor).toMatch(/headingTakesFocus\s+testID="twoFactor\.codesSheet"/);
  });
});
