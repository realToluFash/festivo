import { formattingLocale } from '@soirely/domain';
import { type FormEvent, useEffect, useId, useMemo, useRef, useState } from 'react';

import { Glyph } from '../components/Glyph.tsx';
import { Note, type Tell } from '../components/SettingsParts.tsx';
import { PageFailed, PageLoading, SubPage } from './DataControlParts.tsx';
import { useLoad } from './useDataControl.ts';
import { zoneFor } from './dataControl.ts';
import {
  REQUEST_WORDS as W,
  answerOf,
  answerWords,
  erasedLine,
  requestStart,
  theirStart,
} from './guestRequest.ts';
import type { Viewer } from './settings.ts';
import { TheirData } from './TheirData.tsx';

/** Data and control › A guest’s request (sc-30193): find a guest by what they wrote from, then Their data. */
export function GuestRequest({
  viewer,
  state,
  tell,
}: {
  viewer: Viewer;
  state: string;
  tell: Tell;
}) {
  const locale = useMemo(() => formattingLocale('en', navigator.language), []);
  const zone = zoneFor(viewer);
  const id = useId();
  const [start] = useState(() => requestStart(state));
  const [load, retry] = useLoad(start.load);
  const [typed, setTyped] = useState(start.typed);
  const [answer, setAnswer] = useState(start.answer);
  const [erased, setErased] = useState(false);
  const [finds, setFinds] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const refused = answerWords(answer);

  useEffect(() => {
    if (load === 'loaded' && state !== 'found') input.current?.focus();
  }, [load, state]);

  if (load !== 'loaded')
    return (
      <SubPage page="guestRequest" title={W.title} viewer={viewer} tell={tell}>
        {load === 'failed' ? (
          <PageFailed words={W.failed} onRetry={retry} />
        ) : (
          <PageLoading words={W.loading} />
        )}
      </SubPage>
    );

  const find = (event: FormEvent) => {
    event.preventDefault();
    const next = answerOf(typed);

    setAnswer(next);
    setErased(false);
    setFinds((count) => count + 1);
    if (next !== 'found') input.current?.focus();
  };

  return (
    <SubPage page="guestRequest" title={W.title} viewer={viewer} tell={tell}>
      <Note>{W.line}</Note>
      <form className="desk-field" role="search" noValidate onSubmit={find}>
        <label htmlFor={id} className="desk-label">
          {W.field}
        </label>
        <div className="dc-find">
          <div className={refused == null ? 'desk-box' : 'desk-box is-wrong'}>
            <input
              ref={input}
              id={id}
              type="text"
              value={typed}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={refused != null}
              aria-describedby={refused == null ? undefined : `${id}-error`}
              onChange={(event) => {
                setTyped(event.target.value);
                if (answer !== 'found') setAnswer(null);
              }}
            />
          </div>
          <button type="submit" className="desk-text">
            {W.find}
          </button>
        </div>
        {refused != null && (
          <p id={`${id}-error`} className="desk-error" role="alert">
            <Glyph name="alert" size={15} weight={2.2} />
            {refused}
          </p>
        )}
      </form>
      {answer === 'found' &&
        (erased ? (
          <p className="desk-line is-ink" role="status">
            {erasedLine(locale, zone)}
          </p>
        ) : (
          <TheirData
            key={finds}
            start={theirStart('covered')}
            locale={locale}
            zone={zone}
            onErasing={() => undefined}
            onErased={() => setErased(true)}
          />
        ))}
    </SubPage>
  );
}
