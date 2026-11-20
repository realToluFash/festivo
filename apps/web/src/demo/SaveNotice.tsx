import { useLayoutEffect, useRef, useState } from 'react';

import { EVENT_WORDS as W } from './events.ts';
import { type Answered, SAVE_WORDS } from './saveAnswer.ts';
import { Broken } from '../components/EventPageParts.tsx';
import { Ask, TextAction } from '../components/SettingsParts.tsx';

/** The last child of an `Opened`, so nothing sits between it and Cancel and Save. */
export function SaveNotice({
  answered,
  asking = false,
  onLatest,
}: {
  answered: Answered;
  asking?: boolean;
  onLatest?: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [latest, setLatest] = useState(asking);
  const { answer, times } = answered;

  useLayoutEffect(() => {
    const notice = box.current;

    if (notice == null || times === 0) return;
    notice.nextElementSibling?.scrollIntoView({ block: 'nearest' });
    notice.scrollIntoView({ block: 'nearest' });
  }, [answer, times]);

  if (answer == null) return null;

  return (
    <div className="ev-save-said" ref={box}>
      <Broken
        action={
          answer === 'changedElsewhere' ? (
            <TextAction label={W.showLatest} onClick={() => setLatest(true)} />
          ) : undefined
        }
      >
        {SAVE_WORDS[answer]}
      </Broken>
      {latest && answer === 'changedElsewhere' && (
        <Ask
          title={W.showLatestTitle}
          line={W.showLatestBody}
          keep={W.keepEditing}
          go={W.showLatest}
          onKeep={() => setLatest(false)}
          onGo={() => {
            setLatest(false);
            answered.clear();
            onLatest?.();
          }}
        />
      )}
    </div>
  );
}
