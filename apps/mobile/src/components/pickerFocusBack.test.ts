import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PickerFocusBack } from './pickerFocusBack.ts';

type Opener = Parameters<PickerFocusBack['opening']>[0];

const device = vi.hoisted(() => ({
  os: 'android',
  readerOn: true,
  focused: null as object | null,
  blurred: [] as object[],
  asked: [] as { answer: unknown; target: { current: unknown } }[],
}));

vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return device.os;
    },
  },
  TextInput: { State: { currentlyFocusedInput: () => device.focused } },
}));
vi.mock('./keyboardWatch.ts', () => ({
  blurNatively: (field: object) => device.blurred.push(field),
}));
vi.mock('./screenReaderFocus.ts', () => ({ useScreenReaderOn: () => device.readerOn }));
vi.mock('./Screen.tsx', () => ({
  useFocusOnAnswer: (answer: unknown, target: { current: unknown }) => {
    device.asked.push({ answer, target });
  },
}));

// Just enough of React for one hook: state and refs keep their slot from render to render.
const hook = vi.hoisted(() => ({ slots: [] as unknown[], at: 0 }));
vi.mock('react', () => {
  const slot = <T>(first: () => T): T => (hook.slots[hook.at++] ??= first()) as T;
  return {
    useRef: (value: unknown) => slot(() => ({ current: value })),
    useState: (first: unknown) => {
      const state = slot(() => ({ value: typeof first === 'function' ? first() : first }));
      return [state.value, (next: unknown) => (state.value = next)];
    },
  };
});

const { usePickerFocusBack: hooked } = await import('./pickerFocusBack.ts');

function render(away: boolean) {
  hook.at = 0;
  const back = hooked(away);
  const asked = device.asked.at(-1);
  if (asked == null) throw new Error('useFocusOnAnswer was not called');

  return { back, asked };
}

const picker = { current: { name: 'Type' } } as unknown as Opener;
const typedIn = { name: 'Event name' };

describe('a picker hands TalkBack back to whatever opened it (sc-43908, sc-103322)', () => {
  beforeEach(() => {
    hook.slots = [];
    Object.assign(device, { os: 'android', readerOn: true, focused: null, blurred: [], asked: [] });
  });

  it('asks for the move to the picker that was tapped once it is closed and gone, not before', () => {
    render(true).back.opening(picker);
    render(false).back.closing();

    expect(render(false).asked.answer).toBeUndefined();
    const { asked } = render(true);
    expect(asked.answer).toBeTypeOf('object');
    expect(asked.target.current).toBe(picker.current);
  });

  it('asks again for each close, and not for an open', () => {
    render(true).back.opening(picker);
    render(false).back.closing();
    const first = render(true).asked.answer;

    render(true).back.opening(picker);
    expect(render(false).asked.answer).toBeUndefined();
    render(false).back.closing();
    const second = render(true).asked.answer;

    expect(second).toBeTypeOf('object');
    expect(second).not.toBe(first);
  });

  it('goes to the picker last tapped, where one sheet serves several', () => {
    const currency = { current: { name: 'Currency' } } as unknown as Opener;
    render(true).back.opening(picker);
    render(false).back.closing();
    render(true).back.opening(currency);
    render(false).back.closing();

    expect(render(true).asked.target.current).toBe(currency.current);
  });

  it('blurs, at the close, the field holding input focus at the tap, under TalkBack', () => {
    device.focused = typedIn;
    const { back } = render(true);
    back.opening(picker);
    expect(device.blurred).toEqual([]);

    device.focused = { name: 'the menu’s search' };
    render(false).back.closing();
    expect(device.blurred).toEqual([typedIn]);
  });

  it('blurs nothing with TalkBack off', () => {
    device.readerOn = false;
    device.focused = typedIn;
    render(true).back.opening(picker);
    render(false).back.closing();

    expect(device.blurred).toEqual([]);
  });

  it('gives the opener a new key at each close under TalkBack, since TalkBack takes a hover only once on a view (qa4 #104048)', () => {
    const keys = [render(true).back.openerKey];
    for (let close = 0; close < 3; close++) {
      render(true).back.opening(picker);
      render(false).back.closing();
      keys.push(render(true).back.openerKey);
    }

    expect(new Set(keys).size).toBe(4);
  });

  it('keeps the opener’s key with TalkBack off', () => {
    device.readerOn = false;
    const before = render(true).back.openerKey;
    render(true).back.opening(picker);
    render(false).back.closing();

    expect(render(true).back.openerKey).toBe(before);
  });

  it('changes nothing on iOS', () => {
    device.os = 'ios';
    device.focused = typedIn;
    render(true).back.opening(picker);
    render(false).back.closing();

    expect(render(true).asked.answer).toBeUndefined();
    expect(device.blurred).toEqual([]);
    expect(render(true).back.openerKey).toBe(0);
  });
});

describe('New event’s Type, Time zone and Currency sheet (sc-103322)', () => {
  const screen = readFileSync(join(import.meta.dirname, 'NewEvent.tsx'), 'utf8');

  it('hands TalkBack back to the picker once the sheet is gone, through every close', () => {
    expect(screen).toContain('const listFocusBack = usePickerFocusBack(list == null);');
    expect(screen).toMatch(
      /const closeList = \(\) => \{\s*listFocusBack\.closing\(\);\s*setList\(null\);\s*\};/,
    );
    expect(screen.match(/setList\(null\)/g)).toHaveLength(1);
    expect(screen).toMatch(
      /const openList = \([^)]*\) => \{\s*listFocusBack\.opening\(opener\);\s*takeBack\(\);\s*setList\(which\);/,
    );
  });

  it.each([
    ['type', 'pickers.type'],
    ['zone', 'pickers.timeZone'],
    ['currency', 'pickers.currency'],
  ])('opens %s from the picker TalkBack goes back to', (which, ref) => {
    const start = screen.lastIndexOf('<', screen.indexOf(`ref={${ref}}`));
    const box = screen.slice(start, screen.indexOf('/>', start));

    expect(box).toContain(`openList('${which}', ${ref})`);
    expect(box).toContain('key={listFocusBack.openerKey}');
  });
});

describe('Code and Country, the ListPicker (sc-43908)', () => {
  const picker = readFileSync(join(import.meta.dirname, 'ListPicker.tsx'), 'utf8');

  it('keys its opener, so every close hands TalkBack back to it', () => {
    const start = picker.lastIndexOf('<Pressable', picker.indexOf('ref={field}'));
    const opener = picker.slice(start, picker.indexOf('>', picker.indexOf('ref={field}')));

    expect(opener).toContain('key={focusBack.openerKey}');
  });
});
