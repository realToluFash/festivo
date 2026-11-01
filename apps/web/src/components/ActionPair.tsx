import { Fragment, type ReactNode } from 'react';

import { usePhoneWidth } from '../phoneWidth.ts';

/**
 * A confirm's or a form's two buttons in sc-22092's order: in a row the dismissive one leads,
 * stacked the confirming one is on top. The markup follows what is seen, so Tab does too.
 */
export function ActionPair({ dismiss, confirm }: { dismiss: ReactNode; confirm: ReactNode }) {
  const stacked = usePhoneWidth();
  const pair = [
    <Fragment key="dismiss">{dismiss}</Fragment>,
    <Fragment key="confirm">{confirm}</Fragment>,
  ];

  return <div className="actions actions-pair">{stacked ? pair.reverse() : pair}</div>;
}
