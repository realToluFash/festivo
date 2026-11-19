import { type WhatIf } from '@soirely/api-client';
import { useEffect, useState } from 'react';

import { api } from '../../../api.ts';

export type Asked = { kind: 'none' } | { kind: 'updating' } | { kind: 'answer'; answer: WhatIf };

/** What adding `heads` guests would cost (sc-86), asked again whenever the count changes; an answer for an earlier count is let go. */
export function useWhatAddingCosts(eventId: string, heads: number, asks: boolean): Asked {
  const [got, setGot] = useState<{ heads: number; answer: WhatIf | null } | null>(null);

  useEffect(() => {
    if (!asks) return undefined;
    const controller = new AbortController();
    const settle = (answer: WhatIf | null) => {
      if (!controller.signal.aborted) setGot({ heads, answer });
    };

    api
      .whatIf(eventId, [{ change: 'guests', by: heads }], { signal: controller.signal })
      .then(settle, () => settle(null));

    return () => controller.abort();
  }, [eventId, heads, asks]);

  if (!asks) return { kind: 'none' };
  if (got?.heads !== heads) return { kind: 'updating' };

  return got.answer == null ? { kind: 'none' } : { kind: 'answer', answer: got.answer };
}
