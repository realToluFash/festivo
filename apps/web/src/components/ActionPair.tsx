import { Fragment, useLayoutEffect, useRef, type ReactNode } from 'react';

import { usePhoneWidth } from '../phoneWidth.ts';

/** Swapped in the markup, never by `column-reverse`, so Tab follows what is seen. */
export function ActionPair({
  dismiss,
  confirm,
  className,
}: {
  dismiss: ReactNode;
  confirm: ReactNode;
  className?: string;
}) {
  const stacked = usePhoneWidth();
  const box = useRef<HTMLDivElement>(null);
  const held = useRef<HTMLElement | null>(null);

  // A browser drops focus from a node React moves, so the swap gives it back to the button that had it.
  useLayoutEffect(() => {
    const button = held.current;

    if (button?.isConnected === true && document.activeElement === document.body) {
      button.focus();
    }
  }, [stacked]);

  const pair = [
    <Fragment key="dismiss">{dismiss}</Fragment>,
    <Fragment key="confirm">{confirm}</Fragment>,
  ];

  return (
    <div
      ref={box}
      className={['actions', 'actions-pair', className].filter(Boolean).join(' ')}
      onFocus={(event) => {
        held.current = event.target;
      }}
      onBlur={(event) => {
        const next = event.relatedTarget;

        if (next instanceof Node && box.current?.contains(next) !== true) {
          held.current = null;
        }
      }}
    >
      {stacked ? pair.reverse() : pair}
    </div>
  );
}
