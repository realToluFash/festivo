import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Alert, Lead } from '../components/EventPageParts.tsx';
import { Switch } from '../components/GeneralParts.tsx';
import { RowWords } from '../components/SettingsParts.tsx';
import { offButton } from '../offButton.ts';
import { EVENT_WORDS as W } from './events.ts';
import { WRITE_MS, writePressed, writeSettled, writeSwitchOf } from './guestsWrite.ts';
import './guestsWrite.css';

/** The Overview's Guests' page, under its preview (sc-3978): one row, Mute's own, saved at once. */
export function GuestsCanWrite({ state }: { state: string | null }) {
  const { t } = useTranslation();
  const id = useId();
  const [write, setWrite] = useState(() => writeSwitchOf(state));
  const timer = useRef<number | null>(null);
  const words = { on: t('notificationSettings.on'), off: t('notificationSettings.off') };
  const note = write.canChange ? null : W.guestsCanWriteReadOnly;
  const told = [`${id}-line`, note == null ? null : `${id}-note`].filter(Boolean).join(' ');

  useEffect(
    () => () => {
      if (timer.current != null) window.clearTimeout(timer.current);
    },
    [],
  );

  function press(next: boolean): void {
    if (write.busy || !write.canChange) return;
    setWrite((now) => writePressed(now, next));
    timer.current = window.setTimeout(() => setWrite((now) => writeSettled(now, true)), WRITE_MS);
  }

  return (
    <>
      <div className="desk-row">
        <Lead name="messages" />
        <RowWords title={W.guestsCanWrite} lines={[W.guestsCanWriteLine]} />
        {write.canChange ? (
          <Switch
            on={write.shown}
            label={W.guestsCanWrite}
            words={words}
            told={told}
            busy={write.busy}
            onChange={press}
          />
        ) : (
          <button
            type="button"
            role="switch"
            className="general-switch gcw-fixed"
            aria-checked={write.shown}
            aria-label={W.guestsCanWrite}
            aria-describedby={told}
            {...offButton(true, { dim: false })}
          >
            <span className="general-track" aria-hidden="true">
              <span className="general-knob" />
            </span>
            <span className="general-word" aria-hidden="true">
              {write.shown ? words.on : words.off}
            </span>
          </button>
        )}
      </div>
      <span id={`${id}-line`} className="desk-unseen">
        {W.guestsCanWriteLine}
      </span>
      {note != null && (
        <p id={`${id}-note`} className="desk-line">
          {note}
        </p>
      )}
      {write.failed && <Alert>{t('notifications.muteNotSaved')}</Alert>}
    </>
  );
}
