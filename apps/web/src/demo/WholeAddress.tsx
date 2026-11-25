import { Fragment, useLayoutEffect, useRef, useState } from 'react';

import { addressSides } from './wholeAddress.ts';

/** An address whole, breaking after its @ first and then before a dot, with nothing put into its text: `<wbr>` copies and reads as nothing (sc-91529). */
export function WholeAddress({ text }: { text: string }) {
  const sides = addressSides(text);
  const domain = useRef<HTMLSpanElement>(null);
  const natural = useRef(0);
  const [wide, setWide] = useState(false);

  useLayoutEffect(() => {
    const box = domain.current?.parentElement?.parentElement;
    if (domain.current == null || box == null) return;
    if (!domain.current.classList.contains('is-wide')) {
      natural.current = domain.current.getBoundingClientRect().width;
    }
    const measure = () => setWide(natural.current > box.clientWidth);
    measure();
    const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    watch?.observe(box);

    return () => watch?.disconnect();
  }, [text]);

  if (sides == null) return text;

  return (
    <span className="whole-address">
      {pieces(sides.local.slice(0, -1))}
      {sides.local.length > 1 && <wbr />}
      {lastBeforeAt(sides.local.at(-1) ?? '')}
      <wbr />
      <span ref={domain} className={wide ? 'whole-address-domain is-wide' : 'whole-address-domain'}>
        {pieces(sides.domain)}
      </span>
    </span>
  );
}

/** The @ ends its line with the character before it, so a cut at the line's end never leaves it to start the next. */
function lastBeforeAt(part: string) {
  return (
    <>
      {part.slice(0, -2)}
      <span className="whole-address-at">{part.slice(-2)}</span>
    </>
  );
}

function pieces(parts: readonly string[]) {
  return parts.map((part, index) => (
    <Fragment key={index}>
      {index > 0 && <wbr />}
      {part}
    </Fragment>
  ));
}
