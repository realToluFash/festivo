import { titleFitsBeside } from '@soirely/domain';
import { type RefObject, useLayoutEffect, useState } from 'react';

function measureUnder(title: HTMLElement): boolean {
  const bar = title.parentElement;
  if (bar == null || bar.clientWidth === 0) return false;
  const [dismiss, , verb] = Array.from(bar.children) as HTMLElement[];
  const pen = document.createElement('canvas').getContext('2d');
  if (dismiss == null || verb == null || pen == null) return false;
  const barStyle = getComputedStyle(bar);
  const gap = parseFloat(barStyle.columnGap) || 0;
  const slot =
    bar.clientWidth -
    (parseFloat(barStyle.paddingLeft) || 0) -
    (parseFloat(barStyle.paddingRight) || 0) -
    dismiss.offsetWidth -
    verb.offsetWidth -
    2 * gap;
  const titleStyle = getComputedStyle(title);
  pen.font = `${titleStyle.fontWeight} ${titleStyle.fontSize} ${titleStyle.fontFamily}`;
  const words = (title.textContent ?? '').split(/\s+/).filter(Boolean);

  return !titleFitsBeside(
    words.map((word) => pen.measureText(word).width),
    pen.measureText(' ').width,
    slot,
  );
}

/** Whether the desk dialog's title, read from its node, takes the row under Cancel and the verb. */
export function useTitleUnder(title: RefObject<HTMLElement | null>, words: string): boolean {
  const [under, setUnder] = useState(false);

  useLayoutEffect(() => {
    const node = title.current?.parentElement;
    if (title.current == null || node == null) return undefined;
    const heading = title.current;
    const check = () => setUnder(measureUnder(heading));
    check();
    void document.fonts?.ready.then(check);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const watch = new ResizeObserver(check);
    watch.observe(node);

    return () => watch.disconnect();
  }, [title, words]);

  return under;
}
