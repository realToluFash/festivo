import {
  type ComponentProps,
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
  useRef,
} from 'react';
import { View, type ViewInstance } from 'react-native';

import { focusedField, watchFocusedField } from '../../components/focusedField.ts';
import { keyboardTopNow, settledLift, watchKeyboardTop } from '../../components/keyboardWatch.ts';
import { ScreenScroll, type ScreenScrollView } from '../../components/Screen.tsx';
import { type LiftFromTop, shownEnd } from '../../kit/keyboard.ts';
import { tokens } from '../../theme/tokens.ts';
import { type EventField, offsetAboveSend, type Placed } from './KeysUpModel.ts';

export interface EventFieldRefs {
  refusal: RefObject<ViewInstance | null>;
  name: RefObject<ViewInstance | null>;
  number: RefObject<ViewInstance | null>;
}

function placed(view: ViewInstance | null, content: ViewInstance): Promise<Placed | null> {
  return new Promise((resolve) => {
    if (view == null) {
      resolve(null);
      return;
    }
    view.measureLayout(
      content,
      (_x, contentY, _w, height) => resolve({ contentY, height }),
      () => resolve(null),
    );
  });
}

function scrollFrame(host: ViewInstance): Promise<{ top: number; height: number }> {
  return new Promise((resolve) => {
    host.measureInWindow((_x, top, _w, height) => resolve({ top, height }));
  });
}

/** The offset the event step's fields ask for with the keys up, as if the scroll sat at `from`. */
async function measure(
  scroll: ScreenScrollView,
  refs: EventFieldRefs,
  last: RefObject<EventField>,
  from: number,
): Promise<LiftFromTop> {
  const view = scroll.ref.current;
  const content = view?.getInnerViewRef();
  const host = view?.getNativeScrollRef();
  const keys = keyboardTopNow(scroll.origin.current);
  if (content == null || host == null || keys == null || scroll.answeringNow()) return null;

  const [refusal, name, number, focus, frame] = await Promise.all([
    placed(refs.refusal.current, content),
    placed(refs.name.current, content),
    placed(refs.number.current, content),
    placed(focusedField(), content),
    scrollFrame(host),
  ]);
  if (name == null || number == null) return null;
  // The Country code list takes no input focus: coming back from it, the row it sits in keeps it.
  if (focus != null) last.current = focus.contentY >= number.contentY ? 'number' : 'name';
  const room = shownEnd(keys, { y: frame.top, height: frame.height }) - frame.top;
  const y = offsetAboveSend({
    refusal,
    name,
    number,
    focus: last.current,
    room,
    offset: from,
    margin: tokens.spaceLg,
  });

  return y ?? 'stays';
}

/** Stands in for `useAboveKeyboard` (`src/components/Screen.tsx`) with a different kept rule: with the keys up, Your name and the number row both above Send code whenever they fit, a showing refusal with them, else the focused field (sc-97734). Built into the product, it is a `kept` option on `measureLift`, not a second lift group: that keeps the landing toast's cover (sc-37983), which no step of this demo shows, and `liftUnderFocus` (sc-35488), which never bites here as every kept tier holds the focused field. Send code stays docked: the group never tells the step it needs more room than the focused field. */
function useFieldsAboveSend(refs: EventFieldRefs): () => void {
  const scroll = useContext(ScreenScroll);
  const last = useRef<EventField>('name');
  const again = useRef<() => void>(() => undefined);

  useEffect(() => {
    if (scroll == null) return undefined;
    const { lift, cancel } = settledLift(() => {
      void measure(scroll, refs, last, scroll.offset.current).then((y) => {
        if (typeof y === 'number') scroll.ref.current?.scrollTo({ y, animated: true });
      });
    });
    const unwatchKeys = watchKeyboardTop(() => scroll.origin.current, lift);
    const unwatchFocus = watchFocusedField(lift);
    const fromTop = (done: (lift: LiftFromTop) => void) => {
      void measure(scroll, refs, last, 0).then(done);
    };
    again.current = lift;
    scroll.resized.add(lift);
    scroll.lifts.add(fromTop);

    return () => {
      cancel();
      unwatchKeys();
      unwatchFocus();
      scroll.resized.delete(lift);
      scroll.lifts.delete(fromTop);
    };
  }, [scroll, refs]);

  return () => again.current();
}

/** The event step's refusal and fields, inside the step's scroll, lifted again as a line under a field comes or goes. */
export function FieldsAboveSend({
  refs,
  style,
  children,
}: {
  refs: EventFieldRefs;
  style: ComponentProps<typeof View>['style'];
  children: ReactNode;
}) {
  const lift = useFieldsAboveSend(refs);

  return (
    <View style={style} onLayout={lift}>
      {children}
    </View>
  );
}
