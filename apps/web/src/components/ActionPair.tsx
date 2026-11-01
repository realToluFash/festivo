import { Fragment, type ReactNode } from 'react';

import { usePhoneWidth } from '../phoneWidth.ts';

/** Swapped in the markup, never by `column-reverse`, so Tab follows what is seen. */
export function ActionPair({ dismiss, confirm }: { dismiss: ReactNode; confirm: ReactNode }) {
  const stacked = usePhoneWidth();
  const pair = [
    <Fragment key="dismiss">{dismiss}</Fragment>,
    <Fragment key="confirm">{confirm}</Fragment>,
  ];

  return <div className="actions actions-pair">{stacked ? pair.reverse() : pair}</div>;
}
