import { useEffect, useId, useRef, useState } from 'react';

import { Ask, Head, Note, RowWords, Tag, TextAction } from '../components/SettingsParts.tsx';
import { meshFor } from '../mesh.ts';
import { StatusLine, Turning } from './DataControlParts.tsx';
import type { ReaderZone } from './dataSettings.ts';
import {
  CHANGED,
  COVERED,
  type Covered,
  EMEKA,
  type Phase,
  THEIR_WORDS as W,
  type TheirStart,
  coveredLine,
  coversLine,
  eraseTitle,
  readyLine,
} from './guestRequest.ts';

const PREPARING_MS = 2000;
const ERASING_MS = 1500;

/** Their data (sc-30193): every record of theirs in Ire Events, and what a request does with it, as on the guest's details. */
export function TheirData({
  start,
  locale,
  zone,
  level = 2,
  onErasing,
  onErased,
}: {
  start: TheirStart;
  locale: string;
  zone: ReaderZone;
  level?: 2 | 3;
  onErasing: () => void;
  onErased: () => void;
}) {
  const id = useId();
  const [phase, setPhase] = useState<Phase>(start.phase);
  const [changed] = useState(start.changed);
  const [line, setLine] = useState(start.changed);
  const [asking, setAsking] = useState(start.asking);
  const [played, setPlayed] = useState(false);
  const erased = useRef(onErased);
  const records = changed ? CHANGED : COVERED;

  useEffect(() => {
    erased.current = onErased;
  });

  useEffect(() => {
    if (!played) return;
    if (phase === 'preparing') {
      const timer = setTimeout(() => setPhase('ready'), PREPARING_MS);

      return () => clearTimeout(timer);
    }
    if (phase === 'erasing') {
      const timer = setTimeout(() => {
        setPhase('erased');
        erased.current();
      }, ERASING_MS);

      return () => clearTimeout(timer);
    }
  }, [played, phase]);

  if (phase === 'erased') return null;

  const ask = () => {
    setPlayed(true);
    setLine(false);
    setPhase('preparing');
  };
  const first =
    phase === 'preparing' ? (
      <Turning words={W.preparing} />
    ) : phase === 'ready' ? (
      <div className="desk-after">
        <Note>{readyLine(locale, zone)}</Note>
        <TextAction label={W.download} onClick={() => setPhase('actions')} />
      </div>
    ) : phase === 'failed' ? (
      <div className="desk-after" role="alert">
        <Note>{W.failed}</Note>
        <TextAction label={W.tryAgain} onClick={ask} />
      </div>
    ) : (
      <div className="desk-after">
        {phase === 'linkUsed' && <Note>{W.linkUsed}</Note>}
        <TextAction label={W.export} onClick={ask} />
      </div>
    );

  return (
    <section className="desk-block dc-their" aria-labelledby={`${id}-heading`}>
      <Head level={level} title={<span id={`${id}-heading`}>{W.heading}</span>} />
      {line && !asking && (
        <StatusLine kind="refused" alert>
          {W.changed}
        </StatusLine>
      )}
      <Note>{coversLine(records)}</Note>
      <CoveredRows records={records} locale={locale} />
      <Note>{W.notTheirs}</Note>
      {phase === 'erasing' ? (
        <Turning words={W.erasing} />
      ) : (
        <div className="dc-their-actions">
          {first}
          <button type="button" className="desk-text is-red" onClick={() => setAsking(true)}>
            {W.erase}
          </button>
        </div>
      )}
      {asking && (
        <Ask
          title={eraseTitle(EMEKA.name)}
          line={W.goes}
          keep={W.keep}
          go={W.eraseVerb}
          onKeep={() => setAsking(false)}
          onGo={() => {
            setAsking(false);
            setLine(false);
            setPlayed(true);
            setPhase('erasing');
            onErasing();
          }}
        >
          <div className="dc-erase">
            <span className="dc-ac">{W.notBuilt}</span>
            <p>{W.stays}</p>
            {line && <StatusLine kind="refused">{W.changed}</StatusLine>}
            <CoveredRows records={records} locale={locale} compact />
            <p className="dc-erase-undone">{W.undone}</p>
          </div>
        </Ask>
      )}
    </section>
  );
}

function CoveredRows({
  records,
  locale,
  compact = false,
}: {
  records: readonly Covered[];
  locale: string;
  compact?: boolean;
}) {
  return (
    <ul className={compact ? 'desk-rows dc-covered is-compact' : 'desk-rows dc-covered'}>
      {records.map((one) => (
        <li key={one.id} className={one.companionOf == null ? 'desk-row' : 'desk-row dc-companion'}>
          {one.companionOf == null && (
            <span
              className={`dc-event-tile today-cover is-${meshFor(one.eventId)}`}
              aria-hidden="true"
            />
          )}
          <RowWords
            title={one.name}
            tag={one.deletedEvent && <Tag kind="ended" word={W.deletedEvent} />}
            lines={[coveredLine(one, locale)]}
          />
        </li>
      ))}
    </ul>
  );
}
