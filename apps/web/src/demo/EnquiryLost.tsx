import { useEffect, useId, useRef, useState } from 'react';

import { EditText } from '../components/EventPageParts.tsx';
import { Glyph } from '../components/Glyph.tsx';
import { Ask, RowWords, TextAction } from '../components/SettingsParts.tsx';
import { LOST_REASONS, type LostReason } from './enquiries.ts';
import { lostLineProblem, lostOf } from './enquiryPage.ts';
import { LOST_WORDS, PAGE_WORDS as P } from './enquiryWords.ts';

/** Docked beside the page at a desk; at 40rem and under it is the web's confirm, which stacks its two buttons. */
export function CloseAsLost({
  docked,
  start,
  onKeep,
  onClose,
}: {
  docked: boolean;
  start: { reason: LostReason; line: string; pressed: boolean } | null;
  onKeep: () => void;
  onClose: (reason: LostReason, line: string | null) => void;
}) {
  const id = useId();
  const [reason, setReason] = useState<LostReason | null>(start?.reason ?? null);
  const [line, setLine] = useState(start?.line ?? '');
  const [tried, setTried] = useState(start?.pressed ?? false);
  const heading = useRef<HTMLHeadingElement>(null);
  const firstRadio = useRef<HTMLInputElement>(null);
  const lineField = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLElement>(null);
  const keep = useRef(onKeep);
  const reasonError = tried && reason == null ? P.chooseWhy : null;
  const lineError = tried && lostLineProblem(line) ? P.anythingLong : null;

  useEffect(() => {
    if (!docked) return;
    if (start?.pressed === true) lineField.current?.focus();
    else heading.current?.focus();
  }, [docked, start]);

  useEffect(() => {
    keep.current = onKeep;
  });

  useEffect(() => {
    const around = panel.current;
    if (around == null) return undefined;
    const keys = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      keep.current();
    };
    around.addEventListener('keydown', keys);

    return () => around.removeEventListener('keydown', keys);
  }, [docked]);

  function confirm(): void {
    setTried(true);
    if (reason == null) {
      firstRadio.current?.focus();
      return;
    }
    if (lostLineProblem(line)) {
      lineField.current?.focus();
      return;
    }
    onClose(reason, lostOf(reason, line).line);
  }

  const fields = (
    <>
      <fieldset
        className="enq-why"
        aria-describedby={reasonError == null ? undefined : `${id}-why-error`}
      >
        <legend className="desk-label">{P.why}</legend>
        {reasonError != null && (
          <p id={`${id}-why-error`} className="desk-error">
            <Glyph name="alert" size={15} weight={2.2} />
            {reasonError}
          </p>
        )}
        <ul className="desk-rows">
          {LOST_REASONS.map((one, at) => (
            <li key={one}>
              <label
                className={one === reason ? 'desk-row ev-choice is-picked' : 'desk-row ev-choice'}
              >
                <RowWords title={LOST_WORDS[one]} />
                <input
                  ref={at === 0 ? firstRadio : undefined}
                  type="radio"
                  className="desk-radio"
                  name={`${id}-why`}
                  checked={one === reason}
                  onChange={() => setReason(one)}
                />
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <EditText
        id={`${id}-line`}
        label={P.anything}
        optional
        value={line}
        error={lineError}
        inputRef={lineField}
        onChange={setLine}
      />
    </>
  );

  if (!docked)
    return (
      <Ask
        title={P.panelTitle}
        line={P.panelLine}
        keep={P.keepOpen}
        go={P.confirm}
        onKeep={onKeep}
        onGo={confirm}
      >
        {fields}
      </Ask>
    );

  return (
    <aside ref={panel} className="enq-panel" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} ref={heading} className="enq-panel-title" tabIndex={-1}>
        {P.panelTitle}
      </h2>
      <p className="desk-line">{P.panelLine}</p>
      {fields}
      <div className="enq-panel-actions">
        <TextAction label={P.keepOpen} onClick={onKeep} />
        <button type="button" className="button enq-lose" onClick={confirm}>
          {P.confirm}
        </button>
      </div>
    </aside>
  );
}
