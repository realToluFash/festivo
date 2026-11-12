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
  const language = readFileSync(join(import.meta.dirname, 'LanguageChoice.tsx'), 'utf8');

  it('opens on Android with nothing in it for TalkBack to name the window by', () => {
    expect(sheet).toMatch(
      /useUnnamedWindow\(\s*Platform\.OS === 'android' && headingTakesFocus && shown,\s*onScreen,?\s*\)/,
    );
    expect(sheet).toContain("importantForAccessibility={unnamed ? 'no-hide-descendants' : 'auto'}");
  });

  it('names its Android window by a text TalkBack speaks as nothing, as a task screen does (#41817)', () => {
    expect(sheet).toMatch(
      /onDismiss=\{gone\}\s*>\s*\{Platform\.OS === 'android' && headingTakesFocus && <SilentWindowName \/>\}/,
    );
  });

  it('counts the hidden time from when Android has put the window up, not from the render', () => {
    expect(sheet).toContain('onShow={() => setOnScreen(true)}');
    expect(sheet).toContain('if (!hides || !onScreen || !waiting) return;');
  });

  it('stays hidden for a share of the settle time, long enough for TalkBack to name the window', () => {
    const [, delay] = sheet.match(/const wait = \(opening \? arriving : 0\) \+ ([^;]+);/) ?? [];

    expect(delay).toMatch(/^SETTLED_MS( \/ [1-9]\d*)?$/);
    expect(sheet).toContain('setTimeout(() => setAnnounced({ step }), wait)');
  });

  it('is how the language choice opens', () => {
    expect(language).toMatch(/headingTakesFocus\s+testID="language\.sheet"/);
  });
});

describe('a focused screen whose title takes focus with each new step (sc-11032)', () => {
  const screen = readFileSync(join(import.meta.dirname, 'SummaryOverlays.tsx'), 'utf8');

  it('hides on Android through the sheet’s own wait, restarted by each new title', () => {
    expect(screen).toMatch(
      /useUnnamedWindow\(\s*Platform\.OS === 'android',\s*onScreen,\s*title,\s*reduced \? 0 : WINDOW_ARRIVES_MS,?\s*\)/,
    );
  });

  it('stays hidden as it opens until its slide or fade has ended, so TalkBack has no title to name it by (#40692)', () => {
    expect(screen).toContain('const WINDOW_ARRIVES_MS = 200;');
    expect(screen).toMatch(/animationType=\{reduced \? 'none' : slides \? 'slide' : 'fade'\}/);
  });

  it('gives TalkBack an Android window name it speaks as nothing, above every other text in the window (#41817)', () => {
    expect(screen).toMatch(
      /onShow=\{\(\) => setOnScreen\(true\)\}\s*>\s*\{Platform\.OS === 'android' && <SilentWindowName \/>\}/,
    );
  });

  it('takes that silent name from the sheet, above every other text in the window', () => {
    const sheet = readFileSync(join(import.meta.dirname, 'Sheet.tsx'), 'utf8');

    expect(screen).toMatch(/import \{ SilentWindowName,[^}]*\} from '\.\/Sheet\.tsx';/);
    expect(sheet).toContain("const SILENT = '\\u200b';");
    expect(sheet).toMatch(/windowName: \{ position: 'absolute', top: -1,/);
  });

  it('moves focus the way an answer does, through useFocusOnAnswer', () => {
    expect(screen).toMatch(/useFocusOnAnswer\(step, target[,)]/);
  });

  it('moves focus on Android as the title is revealed, leaving TalkBack no gap to read it first', () => {
    expect(screen).toContain(
      "useFocusOnAnswer(step, target, Platform.OS === 'android' ? 0 : SETTLED_MS)",
    );
  });

  it('lets Turn on two-factor’s failure take focus as one item, not read out as well', () => {
    const summary = readFileSync(join(import.meta.dirname, 'Summary.tsx'), 'utf8');
    const twoFactor = readFileSync(join(import.meta.dirname, 'SecurityTwoFactor.tsx'), 'utf8');

    expect(summary).toContain('quietAtMount: focused');
    expect(summary).toContain('accessible={focused || undefined}');
    expect(twoFactor).toMatch(/<SectionFailed[^>]*takesFocus/);
  });
});

describe('Create an organisation on Android, where a native animation’s end can be lost (qa3, #39178)', () => {
  const walk = readFileSync(join(import.meta.dirname, 'CreateWalkWindow.tsx'), 'utf8');
  const switcher = readFileSync(join(import.meta.dirname, 'OrgDropDown.tsx'), 'utf8');
  const motion = readFileSync(join(import.meta.dirname, '..', 'motion.ts'), 'utf8');

  it('keys each step by its turn, so the step leaving and the one arriving never share a key', () => {
    expect(walk).toContain('key={live ? turn : turn - 1}');
  });

  it('starts the arriving step’s glide once its views are laid out', () => {
    expect(walk).toContain('onLayout={live ? () => play(turn) : undefined}');
  });

  it('settles the turn on a timer when the glide’s end never comes', () => {
    expect(walk).toContain('settling.current = setTimeout(settle, turnMs + SETTLED_MS);');
  });

  it.each([
    ['the walk', walk],
    ['the switcher', switcher],
  ])('lets %s’s window go through fadeAway, its timer cancelled on cleanup', (_, text) => {
    expect(text).toContain('return fadeAway(fade, SETTLED_MS, () => setPresent(false));');
  });

  it('has fadeAway end the window on its timer as well as on the fade’s end', () => {
    expect(motion).toContain('const lost = setTimeout(end, tokens.motionFast + grace);');
    expect(motion).toContain('}).start(end);');
  });

  it('has fadeAway call gone at most once, and never after its cancel', () => {
    expect(motion).toContain('if (done) return;');
    expect(motion).toMatch(/return \(\) => \{\s+done = true;\s+clearTimeout\(lost\);/);
  });
});
