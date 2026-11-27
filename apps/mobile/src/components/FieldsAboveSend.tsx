import {
  type ComponentProps,
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
  useRef,
} from 'react';
import { View, type ViewInstance } from 'react-native';

import { focusedField, watchFocusedField } from './focusedField.ts';
import { keyboardTopNow, settledLift, watchKeyboardTop } from './keyboardWatch.ts';
import { fieldUnderToast, landingToastTop, watchLandingToastTop } from './landingToastTop.ts';
import { ScreenScroll, type ScreenScrollView } from './Screen.tsx';
import { type LiftFromTop, shownEnd } from '../kit/keyboard.ts';
import { tokens } from '../theme/tokens.ts';
import { type EventField, offsetAboveSend, type Placed } from '../kit/fieldsAboveSend.ts';

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
  fieldUnderToast(focus == null ? null : { top: frame.top, height: focus.height });
  // The landing toast over a step covers what is under it as the keys do (sc-37983).
  const shown = Math.min(
    shownEnd(keys, { y: frame.top, height: frame.height }),
    landingToastTop() ?? Infinity,
  );
  const room = shown - frame.top;
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

/** `useAboveKeyboard` (`Screen.tsx`) with a different kept rule, for the door code's event step: with the keys up, Your name and the number row both above Send code whenever they fit, a showing refusal with them, else the focused field (sc-97734). Send code stays docked: the group never tells the step it needs more room than the focused field, so sc-7099's fallback is untouched. */
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
    const unwatchToast = watchLandingToastTop(lift);
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
      unwatchToast();
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
