import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Answered, SaveAnswer } from './saveAnswer.ts';
import { Broken } from './EventPageParts.tsx';
import { Ask, TextAction } from './SettingsParts.tsx';

const SAID = {
  notSaved: 'eventEdit.notSaved',
  forbidden: 'eventEdit.forbidden',
  changedElsewhere: 'eventEdit.changedElsewhere',
} as const satisfies Record<SaveAnswer, string>;

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
  const { t } = useTranslation();
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
            <TextAction label={t('eventEdit.showLatest')} onClick={() => setLatest(true)} />
          ) : undefined
        }
      >
        {t(SAID[answer])}
      </Broken>
      {latest && answer === 'changedElsewhere' && (
        <Ask
          title={t('eventEdit.showLatestTitle')}
          line={t('eventEdit.showLatestBody')}
          keep={t('eventEdit.keepEditing')}
          go={t('eventEdit.showLatest')}
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
