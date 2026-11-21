import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { Brand } from '../components/Brand.tsx';
import { Glyph } from '../components/Glyph.tsx';
import {
  type Card,
  type ClockState,
  EVENT,
  JOB,
  KW,
  LEAD,
  SEND_MS,
  SHIFT,
  VENUE,
  cardOf,
  clock,
  clockStateOf,
  lineWords,
  outLimit,
  tapped,
  tappedAgain,
  timeWords,
} from './shiftClock.ts';
import './redeem.css';
import './shiftClock.css';

/** /demo/shift-clock (sc-234): the clock card on a person's own shift, opened from their staff link in a browser. */
export function ShiftClockPage() {
  const [params] = useSearchParams();
  const state = clockStateOf(params.get('state'));

  return <ShiftClock key={state} state={state} />;
}

function ShiftClock({ state }: { state: ClockState }) {
  const [c, setCard] = useState<Card>(() => cardOf(state));
  const [busy, setBusy] = useState(false);
  const ended = c.past && c.phase === 'off';

  function press() {
    setBusy(true);
    setTimeout(() => {
      setCard(tapped(c));
      setBusy(false);
    }, SEND_MS);
  }

  return (
    <main id="content" className="rd sk">
      <div className="rd-column">
        <div className="rd-brand">
          <Brand />
        </div>
        {ended ? (
          <Ended c={c} />
        ) : (
          <>
            <header className="sk-head">
              {!c.past && <p className="sk-eyebrow">{KW.yourShift}</p>}
              <h1 className="sk-title">{EVENT}</h1>
              {!c.past && <p className="sk-sub">{VENUE}</p>}
            </header>
            <ClockCard c={c} busy={busy} onPress={press} />
            {!c.past && <ShiftCard />}
            {!c.past && <p className="sk-note">{KW.rest}</p>}
          </>
        )}
        <div className="sk-demo">
          <button
            type="button"
            className="desk-text"
            aria-pressed={c.offline}
            onClick={() => setCard({ ...c, offline: !c.offline })}
          >
            {KW.demoOffline}
          </button>
          {(c.phase === 'on' || c.phase === 'off') && (
            <button type="button" className="desk-text" onClick={() => setCard(tappedAgain(c))}>
              {KW.demoAgain}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

function Status({ words, done }: { words: string; done: boolean }) {
  return (
    <p className="sk-status">
      <span className={done ? 'sk-shape is-done' : 'sk-shape'} aria-hidden="true">
        {done && <Glyph name="tick" size={12} weight={3.2} />}
      </span>
      {words}
    </p>
  );
}

/** Always in the card before the tap, so a screen reader reads the line as it is put in (WCAG 2.2 SC 4.1.3). */
function TapLine({ c }: { c: Card }) {
  const words = lineWords(c);
  const offline = c.line === 'offIn' || c.line === 'offOut';

  return (
    <div role="status" className="sk-live">
      {words != null && (
        <p className={offline ? 'sk-line is-attention' : 'sk-line'}>
          <span className="sk-ring" aria-hidden="true">
            {offline ? '!' : 'i'}
          </span>
          {words}
        </p>
      )}
    </div>
  );
}

function ClockCard({ c, busy, onPress }: { c: Card; busy: boolean; onPress: () => void }) {
  const at = (minutes: number | null) => timeWords(minutes ?? 0, c.now);

  if (c.phase === 'before')
    return (
      <section className="sk-card" aria-label={KW.clockIn}>
        <button type="button" className="sk-primary" disabled>
          {KW.opensAt(clock(SHIFT.start - 60))}
        </button>
        <p className="sk-help">{KW.opensLine}</p>
      </section>
    );
  if (c.phase === 'ready')
    return (
      <section className="sk-card" aria-label={KW.clockIn}>
        <TapLine c={c} />
        <button type="button" className="sk-primary" aria-busy={busy} onClick={onPress}>
          {busy ? KW.clockingIn : KW.clockIn}
        </button>
        <p className="sk-help">{KW.readyLine}</p>
      </section>
    );
  if (c.phase === 'on')
    return (
      <section className="sk-card" aria-label={KW.clockOut}>
        <Status words={KW.clockedInAt(at(c.clockIn))} done />
        <TapLine c={c} />
        <button type="button" className="sk-primary" aria-busy={busy} onClick={onPress}>
          {busy ? KW.clockingOut : KW.clockOut}
        </button>
        <p className="sk-help">
          {c.past ? KW.browserOut(at(outLimit(c.clockIn ?? 0))) : KW.stayLine(clock(SHIFT.end))}
        </p>
      </section>
    );
  if (c.phase === 'off')
    return (
      <section className="sk-card" aria-label={KW.yourShift}>
        <Status words={KW.inOut(at(c.clockIn), at(c.clockOut))} done />
        <p className="sk-help is-strong">{KW.recorded((c.clockOut ?? 0) - (c.clockIn ?? 0))}</p>
        <TapLine c={c} />
        <p className="sk-help">{KW.helper}</p>
      </section>
    );

  return (
    <section className="sk-card" aria-label={KW.clockIn}>
      <Status words={KW.closedAt(clock(SHIFT.end))} done={false} />
      <p className="sk-strong">{KW.closedLine}</p>
    </section>
  );
}

function ShiftCard() {
  return (
    <section className="sk-card" aria-labelledby="sk-shift">
      <h2 id="sk-shift" className="sk-eyebrow">
        {KW.yourShift}
      </h2>
      <p className="sk-big">{KW.hours}</p>
      <p className="sk-strong">{KW.endsOn}</p>
      <p className="sk-help">{JOB}</p>
      <p className="sk-eyebrow">{KW.yourLead}</p>
      <p className="sk-strong">{LEAD}</p>
    </section>
  );
}

/** The link's ended page once they clock out past their access: no event name, signed out. */
function Ended({ c }: { c: Card }) {
  return (
    <>
      <Status words={KW.clockedOutAt(timeWords(c.clockOut ?? 0, c.now))} done />
      <TapLine c={c} />
      <h1 className="sk-title">{KW.signedOut}</h1>
      <p className="sk-inset">{KW.ended}</p>
      <p className="sk-help">{KW.nothingSaved}</p>
    </>
  );
}
