// MEASUREMENT ONLY, never merged: the numbers QA reads on tolu-mac for sc-67886 (pm, #87961; lead, #87960).
import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  Keyboard,
  type KeyboardEvent,
  type KeyboardEventName,
  StyleSheet,
  TextInput,
  View,
  type ViewInstance,
} from 'react-native';

import type { ScreenScrollView } from '../components/Screen.tsx';
import { Text } from '../components/Text.tsx';
import { SETTLED_MS } from '../components/intoView.ts';

type Measurable = Pick<ViewInstance, 'measure' | 'measureInWindow'>;

const targets = new Map<string, RefObject<Measurable | null>>();

export function measureTarget(name: string): RefObject<ViewInstance | null> {
  const ref: RefObject<ViewInstance | null> = { current: null };
  targets.set(name, ref);
  return ref;
}

export interface Context {
  screenScroll: ScreenScrollView;
  page: RefObject<ViewInstance | null>;
  foot: RefObject<ViewInstance | null>;
  cover: number;
  origin: number;
  sheetTop: number;
  insetsTop: number;
  keysTop: () => number | null;
}

const EVENTS: KeyboardEventName[] = [
  'keyboardWillShow',
  'keyboardDidShow',
  'keyboardWillHide',
  'keyboardDidHide',
  'keyboardWillChangeFrame',
  'keyboardDidChangeFrame',
];

const started = Date.now();
const ms = () => Date.now() - started;
const round = (n: number) => Math.round(n * 10) / 10;

function box(target: Measurable | null | undefined): Promise<string> {
  if (target == null) return Promise.resolve('none');
  return new Promise((resolve) => {
    target.measureInWindow((x, y, width, height) =>
      target.measure((_x, _y, _w, _h, pageX, pageY) =>
        resolve(
          `win[x${round(x)} y${round(y)} w${round(width)} h${round(height)} foot${round(y + height)}] page[x${round(pageX)} y${round(pageY)}]`,
        ),
      ),
    );
  });
}

export function useSheetMeasure(on: boolean, context: Context): string[] {
  const latest = useRef(context);
  const [lines, setLines] = useState<string[]>([]);
  const events = useRef<string[]>([]);

  useEffect(() => {
    latest.current = context;
  });

  useEffect(() => {
    if (!on) return undefined;
    let alive = true;
    const probe = async (why: string) => {
      const now = latest.current;
      const metrics = Keyboard.metrics();
      const [page, scroll, focused, forgot, submit] = await Promise.all([
        box(now.page.current),
        box(now.screenScroll.ref.current),
        box(TextInput.State.currentlyFocusedInput()),
        box(targets.get('forgot')?.current),
        box(now.foot.current),
      ]);
      if (!alive) return;
      const snapshot = [
        `t${ms()} ${why}`,
        `offsetY ${round(now.screenScroll.offset.current)} cover ${round(now.cover)} keysTop ${now.keysTop() ?? 'down'}`,
        `origin ${now.origin} sheetTop ${now.sheetTop} insetsTop ${now.insetsTop} visible ${Keyboard.isVisible()} metrics ${metrics == null ? 'none' : `y${round(metrics.screenY)} h${round(metrics.height)}`}`,
        `page ${page}`,
        `scroll ${scroll}`,
        `focused ${focused}`,
        `forgot ${forgot}`,
        `submitFoot ${submit}`,
      ];
      // eslint-disable-next-line no-console
      console.log(`[sc67886] ${snapshot.join(' | ')}`);
      setLines([...snapshot, 'events:', ...events.current.slice(-10)]);
    };
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (why: string) => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        void probe(why);
      }, SETTLED_MS);
      timers.add(timer);
    };
    const listeners = EVENTS.map((name) =>
      Keyboard.addListener(name, (event: KeyboardEvent) => {
        const line = `t${ms()} ${name} screenY${round(event.endCoordinates.screenY)} h${round(event.endCoordinates.height)} dur${event.duration}`;
        events.current.push(line);
        // eslint-disable-next-line no-console
        console.log(`[sc67886] ${line}`);
        void probe(`at ${name}`);
        later(`${SETTLED_MS}ms after ${name}`);
      }),
    );
    let scrolled: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      clearTimeout(scrolled);
      scrolled = setTimeout(() => void probe('scroll stopped'), 300);
    };
    const { screenScroll } = latest.current;
    screenScroll.scrolled.add(onScroll);
    const tick = setInterval(() => void probe('tick'), 1000);
    void probe('mounted');

    return () => {
      alive = false;
      listeners.forEach((listener) => listener.remove());
      timers.forEach(clearTimeout);
      clearTimeout(scrolled);
      clearInterval(tick);
      screenScroll.scrolled.delete(onScroll);
    };
  }, [on]);

  return lines;
}

export function SheetReadout({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null;

  return (
    <View pointerEvents="none" style={styles.readout}>
      <Text
        allowFontScaling={false}
        size={8}
        style={styles.text}
        testID="sc67886.readout"
        accessibilityLabel={lines.join(' | ')}
      >
        {lines.join('\n')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: {
    position: 'absolute',
    top: 0,
    right: 0,
    maxWidth: '55%',
    backgroundColor: 'rgba(255,255,200,0.85)',
    padding: 2,
  },
  text: { lineHeight: 9, color: '#000' },
});
