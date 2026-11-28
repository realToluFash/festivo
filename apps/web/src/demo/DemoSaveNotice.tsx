import { useLayoutEffect, useRef } from 'react';

import { Broken } from '../components/EventPageParts.tsx';
import { SaveNotice } from '../components/SaveNotice.tsx';
import { EVENT_WORDS as W } from './events.ts';
import type { DemoAnswered } from './saveAnswer.ts';

/** The product's SaveNotice, and the event no longer available in its box and place (sc-75689). */
export function DemoSaveNotice({
  answered,
  onLatest,
}: {
  answered: DemoAnswered;
  onLatest?: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const { answer, times } = answered;

  useLayoutEffect(() => {
    const notice = box.current;

    if (notice == null || times === 0) return;
    notice.nextElementSibling?.scrollIntoView({ block: 'nearest' });
    notice.scrollIntoView({ block: 'nearest' });
  }, [answer, times]);

  if (answer !== 'eventGone') {
    return (
      <SaveNotice answered={{ ...answered, answer }} {...(onLatest == null ? {} : { onLatest })} />
    );
  }

  return (
    <div className="ev-save-said" ref={box}>
      <Broken>{W.eventGone}</Broken>
    </div>
  );
}
