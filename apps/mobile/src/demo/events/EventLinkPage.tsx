import { useEffect, useLayoutEffect, useState } from 'react';

import { useCurrentPlace, useLinkMove } from '../OrgSwitcher.tsx';
import { EventGone } from './EventGone.tsx';
import { type LinkState, type Load, LOAD_MS, answerOf, eventOrgOf, moveOf } from './EventLink.ts';
import { EventScreen } from './EventPage.tsx';

/** /demo/events/[id]?link=: the event opened from its link while working in Ire Events; the account moves only once it has loaded (sc-80863). */
export function EventLinkPage({ id, state }: { id: string | undefined; state: LinkState }) {
  const { start, move } = useLinkMove();
  const current = useCurrentPlace();
  const [attempt, setAttempt] = useState(0);
  const [load, setLoad] = useState<Load>('loading');

  useLayoutEffect(() => start(), [start]);

  useEffect(() => {
    if (load !== 'loading') return undefined;
    const later = setTimeout(() => setLoad(answerOf(state, attempt)), LOAD_MS);

    return () => clearTimeout(later);
  }, [load, state, attempt]);

  const to = moveOf(load, eventOrgOf(state), current?.id ?? null);

  useEffect(() => {
    if (to != null) move(to);
  }, [to, move]);

  if (load === 'unavailable') return <EventGone />;

  if (load === 'failed')
    return (
      <EventScreen
        key="failed"
        id={id}
        state={null}
        area={null}
        failed={() => {
          setAttempt((count) => count + 1);
          setLoad('loading');
        }}
      />
    );

  return (
    <EventScreen
      key={load}
      id={id}
      state={load === 'loading' ? 'loading' : null}
      area={null}
      linked={load === 'loaded'}
    />
  );
}
