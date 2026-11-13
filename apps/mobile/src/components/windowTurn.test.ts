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
    const sheet = readFileSync(join(import.meta.dirname, 'Sheet.tsx'), 'utf8');

    expect(sheet).toContain('export const WINDOW_ARRIVES_MS = 200;');
    expect(screen).toMatch(/animationType=\{reduced \? 'none' : slides \? 'slide' : 'fade'\}/);
  });

  it('gives every Android window it opens, an ask and a menu too, a name TalkBack speaks as nothing, above every other text in it (#41817)', () => {
    expect(screen).toMatch(
      /onDismiss=\{gone\}\s*>\s*\{Platform\.OS === 'android' && <SilentWindowName \/>\}\s*\{children\}/,
    );
    expect(screen.match(/<SilentWindowName \/>/g)).toHaveLength(1);
  });

  it('takes that silent name from the sheet, above every other text in the window', () => {
    const sheet = readFileSync(join(import.meta.dirname, 'Sheet.tsx'), 'utf8');

    expect(screen).toMatch(/import \{\s*SilentWindowName,[^}]*\} from '\.\/Sheet\.tsx';/);
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

describe('a window that opens through a Modal of its own (sc-42690)', () => {
  const read = (file: string) => readFileSync(join(import.meta.dirname, file), 'utf8');

  it.each(['OrgDropDown.tsx', 'CalendarOverlays.tsx', 'CreateWalkWindow.tsx', 'ListPicker.tsx'])(
    'in %s, names its Android window by a text TalkBack speaks as nothing, above every other text in it',
    (file) => {
      const text = read(file);

      expect(text).toMatch(/import \{\s*SilentWindowName,[^}]*\} from '\.\/Sheet\.tsx';/);
      expect(text).toMatch(/\n\s*>\s*\{Platform\.OS === 'android' && <SilentWindowName \/>\}/);
      expect(text.match(/<SilentWindowName \/>/g)).toHaveLength(1);
    },
  );

  describe('a list picker’s menu', () => {
    const picker = read('ListPicker.tsx');

    it('hides on Android through the sheet’s own wait, from when its window is up until it has slid in', () => {
      expect(picker).toContain('onShow={risen}');
      expect(picker).toContain('const onScreen = windowUp && pickerShown;');
      expect(picker).toMatch(
        /useUnnamedWindow\(\s*Platform\.OS === 'android' && pickerShown,\s*onScreen,\s*null,\s*reduced \? 0 : WINDOW_ARRIVES_MS,?\s*\)/,
      );
      expect(picker).toContain(
        "importantForAccessibility={unnamed ? 'no-hide-descendants' : 'auto'}",
      );
    });

    it('slides inside a window already in place on Android, never as a window sliding (qa #42888)', () => {
      expect(picker).toContain("const SLIDES_INSIDE = Platform.OS === 'android';");
      expect(picker).toContain("animationType={SLIDES_INSIDE ? 'none' : 'slide'}");
      expect(picker).toContain('const windowShown = useModalOpen(open || windowUp);');
      expect(picker).toContain('visible={windowShown}');
      expect(picker).toContain('SLIDES_INSIDE && { transform: [{ translateY: slide }] }');
      expect(picker).toContain('const gone = setTimeout(() => setWindowUp(false), duration);');
    });

    it('moves TalkBack’s focus to its title once revealed, on Android only', () => {
      expect(picker).toMatch(
        /useFocusOnAnswer\(\s*Platform\.OS === 'android' && onScreen && !unnamed \? true : undefined,\s*heading,\s*0,?\s*\)/,
      );
      expect(picker).toMatch(/<Text\s+ref=\{heading\}[^>]*accessibilityRole="header"/);
    });

    it('hands TalkBack back to the picker however the menu closes, on Android only (sc-43908)', () => {
      expect(picker).toMatch(
        /const close = \(\) => \{\s*if \(Platform\.OS === 'android'\) setClosed\(\{\}\);\s*setOpen\(false\);\s*\};/,
      );
      expect(picker.match(/setOpen\(false\)/g)).toHaveLength(1);
      expect(picker.match(/setClosed\(\{\}\)/g)).toHaveLength(1);
      expect(picker).toContain('onRequestClose={close}');
      expect(picker).toContain('onAccessibilityEscape={close}');
      expect(picker).toMatch(/onPress=\{close\}[^>]*testID=\{`\$\{testID\}\.close`\}/);
      expect(picker).toMatch(/onChange\(item\.code\);[^}]*\bclose\(\);/);
      expect(picker).toContain('useSystemBack(open, close);');
      expect(picker).toContain('useFocusOnAnswer(windowShown ? undefined : closed, field);');
    });

    it('draws only the rows in sight until its title has taken focus, under TalkBack on Android (qa2 #43597)', () => {
      expect(picker).toMatch(
        /useListFilling\(\s*Platform\.OS === 'android' && readerOn,\s*windowShown,\s*onScreen && !unnamed,?\s*\)/,
      );
      expect(picker).toContain('windowSize={listFilling ? 1 : undefined}');
      expect(picker).toContain('const fill = setTimeout(() => setFilled(true), SETTLED_MS);');
      expect(picker).toContain('if (!up && filled) setFilled(false);');
    });
  });

  it('opens the switcher from TalkBack’s double tap without a click, on Android only (qa2 #43597)', () => {
    const pill = read('OrgPill.tsx');

    expect(pill).toContain('{...quietTap(onPress, expanded)}');
    expect(pill).toContain(
      "if (Platform.OS !== 'android' || onPress == null || expanded == null) return {};",
    );
    expect(pill).toContain("if (event.nativeEvent.actionName === 'activate') onPress();");
  });

  it('gives Today’s own opener the same quiet double tap (qa2 #44464)', () => {
    expect(read('TodayCover.tsx')).toContain('...quietTap(org.onPress, org.expanded),');
  });

  it('has Create an organisation take the keys while hidden, then TalkBack’s focus on its field (qa2 #44464)', () => {
    const walk = read('CreateWalkWindow.tsx');

    expect(walk).toContain("const talkBack = Platform.OS === 'android' && readerOn;");
    expect(walk).toContain(
      'const unnamed = useUnnamedWindow(talkBack && shown, onScreen, null, arriving);',
    );
    expect(walk).toContain('onShow={() => setOnScreen(true)}');
    expect(walk).toMatch(/const behind = walk\.asking \|\| unnamed \?/);
    expect(walk).toMatch(
      /!talkBack \|\| !onScreen \|\| !unnamed \|\| opening\.walk\.asking\) return;\s+const keys = setTimeout/,
    );
    expect(walk).toMatch(
      /!talkBack \|\| !onScreen \|\| unnamed \|\| opening\.walk\.asking\) return;\s+const input =\s+opening\.focus === 'search' \? search\.current : opening\.focus === 'name' \? field\.current : null;/,
    );
  });

  it('raises the keys again on Create an organisation’s field once TalkBack’s focus is on it (qa3 #45108)', () => {
    expect(read('CreateWalkWindow.tsx')).toMatch(
      /moveScreenReaderFocus\(input\);\s+\/\/ .*\s+const keys = setTimeout\(\(\) => raiseKeysOn\(input\), HOVER_LANDS_MS\);/,
    );
  });

  it('keeps main’s keys after the window settles with TalkBack off, on the phone and the tablet (lead, PR #2098)', () => {
    const walk = read('CreateWalkWindow.tsx');

    expect(walk).toMatch(
      /if \(talkBack \|\| !shown \|\| opening\.walk\.asking\) return;\s+const wait = setTimeout\(\(\) => \{\s+if \(opening\.focus === 'search'\) search\.current\?\.focus\(\);\s+else if \(opening\.focus === 'name'\) field\.current\?\.focus\(\);\s+else moveScreenReaderFocus\(question\.current\);\s+\}, SETTLED_MS\);/,
    );
    expect(walk).toContain(
      'const arriving = reduced ? 0 : phone ? WINDOW_ARRIVES_MS : tokens.motionBase;',
    );
  });
});
