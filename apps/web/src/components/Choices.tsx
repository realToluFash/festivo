import { Children, type ReactNode } from 'react';

import { usePhoneWidth } from '../phoneWidth.ts';

/** Given dismissive first; stacked, the markup turns over too, so Tab meets them as seen. */
export function Choices({ children }: { children: ReactNode }) {
  const stacked = usePhoneWidth();
  const choices = Children.toArray(children);

  return (
    <div className={stacked ? 'actions actions-stacked' : 'actions'}>
      {stacked ? choices.reverse() : choices}
    </div>
  );
}
