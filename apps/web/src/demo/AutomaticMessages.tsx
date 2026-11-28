import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { ActionPair } from '../components/ActionPair.tsx';
import { Glyph } from '../components/Glyph.tsx';
import { useDialogKeys } from '../dialogFocus.ts';
import { offButton } from '../offButton.ts';
import '../components/GeneralParts.css';
import {
  AUTO_KEYS,
  AW,
  type AutoKey,
  type AutoState,
  type AutoStateName,
  EVENT,
  SAID_WORDS,
  autoStateOf,
  confirmOff,
  confirmWords,
  draftLine,
  keepOn,
  press,
  publish,
  rowOf,
  seed,
} from './automaticMessages.ts';
import { MESSAGES_AT } from './messages.ts';
import './howItsGoing.css';
import './automaticMessages.css';

const AREAS = ['Overview', 'Guests', 'Seating', 'Menu', 'Service', 'Messages', 'Reports'];

/** /demo/automatic-messages (sc-3974): the Messages page's Automatic messages card under All messages, at 1280 × 800. */
export function AutomaticMessagesPage() {
  const [params] = useSearchParams();
  const name = autoStateOf(params.get('state'));

  return <AutomaticMessages key={name} name={name} />;
}

function AutomaticMessages({ name }: { name: AutoStateName }) {
  const [s, setS] = useState<AutoState>(() => seed(name));
  const focusTo = useRef('');

  useEffect(() => {
    if (focusTo.current === '') return;
    document.querySelector<HTMLElement>(focusTo.current)?.focus();
    focusTo.current = '';
  });

  function act(next: AutoState, focus = ''): void {
    focusTo.current = focus;
    setS(next);
  }

  const draft = draftLine(s);

  return (
    <div className="hig-page">
      <div className="hig-desk">
        <nav className="hig-side" aria-label="Event">
          <div className="hig-org">
            <span className="hig-org-mark" aria-hidden="true">
              IE
            </span>
            <span>Ire Events</span>
          </div>
          <Link className="hig-side-link" to="/demo">
            ‹ All states in the demo
          </Link>
          <div className="hig-event">
            <strong>{EVENT}</strong>
            <span className="hig-live-pill am-phase" data-draft={draft != null || undefined}>
              <span className="am-phase-mark" aria-hidden="true" />
              {draft == null ? 'Live' : 'Draft'}
            </span>
          </div>
          <ul className="hig-areas">
            {AREAS.map((area) => (
              <li
                key={area}
                className="hig-area"
                aria-current={area === 'Messages' ? 'page' : undefined}
              >
                {area}
              </li>
            ))}
          </ul>
        </nav>
        <main id="content" className="hig-main">
          <header className="hig-header">
            <div>
              <h1>{AW.title}</h1>
              <p className="hig-meta">{EVENT}</p>
            </div>
          </header>
          <div className="hig-scroll">
            <section className="am-card" aria-labelledby="am-all">
              <h2 id="am-all" className="am-heading">
                {AW.allMessages}
              </h2>
              <p className="am-line">{AW.allMessagesLine}</p>
              <Link className="am-open" to={MESSAGES_AT}>
                Open All messages
                <Glyph name="chevron" size={16} weight={2.2} />
              </Link>
            </section>
            <Card s={s} act={act} />
            <div className="am-demo-only">
              <p>{`Read out as a switch settles: “${SAID_WORDS.isOn}” and “${SAID_WORDS.isOff}”`}</p>
              <span className="am-pill">{SAID_WORDS.proposed}</span>
              {draft != null && (
                <>
                  <p>Demo only: the event’s own Make live publishes it.</p>
                  <button
                    type="button"
                    className="button"
                    data-am="publish"
                    onClick={() => act(publish(s), '[data-am="switch-reminders"]')}
                  >
                    Publish the event
                  </button>
                </>
              )}
            </div>
          </div>
        </main>
        {s.confirm != null && <TurnOff s={s} act={act} />}
      </div>
      <p className="desk-unseen" role="status">
        {s.said}
      </p>
    </div>
  );
}

function Card({ s, act }: { s: AutoState; act: (next: AutoState, focus?: string) => void }) {
  const draft = draftLine(s);

  if (s.loading)
    return (
      <section className="am-card" aria-labelledby="am-auto" aria-busy="true">
        <h2 id="am-auto" className="am-heading">
          {AW.heading}
        </h2>
        <p className="desk-unseen" role="status">
          {AW.loading}
        </p>
        <ul className="am-rows" aria-hidden="true">
          {AUTO_KEYS.map((key) => (
            <li key={key} className="am-row am-bones">
              <span className="am-bone am-bone-title" />
              <span className="am-bone am-bone-line" />
              <span className="am-bone am-bone-inset" />
            </li>
          ))}
        </ul>
      </section>
    );

  return (
    <section className="am-card" aria-labelledby="am-auto">
      <h2 id="am-auto" className="am-heading">
        {AW.heading}
      </h2>
      {draft != null && (
        <p className="am-inset am-draft">
          <span className="am-ring" aria-hidden="true" />
          {draft}
        </p>
      )}
      <ul className="am-rows">
        {AUTO_KEYS.map((key) => (
          <Row key={key} s={s} k={key} act={act} />
        ))}
      </ul>
      <p className="am-footer">{AW.footer}</p>
    </section>
  );
}

function Row({
  s,
  k,
  act,
}: {
  s: AutoState;
  k: AutoKey;
  act: (next: AutoState, focus?: string) => void;
}) {
  const row = rowOf(s, k);
  const told = `am-${k}-when`;

  return (
    <li className="am-row">
      <div className="am-row-top">
        <h3 className="am-name">{row.name}</h3>
        <button
          type="button"
          role="switch"
          className="general-switch am-switch"
          aria-checked={row.shownOn}
          aria-label={row.name}
          aria-describedby={told}
          data-am={`switch-${k}`}
          data-dim={!row.live || undefined}
          {...offButton(!row.live, { dim: false })}
          onClick={() => {
            const next = press(s, k);
            act(next, next.confirm == null ? `[data-am="switch-${k}"]` : '');
          }}
        >
          <span className="general-track" aria-hidden="true">
            <span className="general-knob" />
          </span>
          <span className="general-word" aria-hidden="true">
            {row.shownOn ? AW.on : AW.off}
          </span>
        </button>
      </div>
      <div id={told} className="am-words">
        <p className="am-line">{row.when}</p>
        {row.limit != null && <p className="am-line">{row.limit}</p>}
        <p className="am-line">{row.time}</p>
      </div>
      {row.next != null && (
        <p className="am-inset am-next">
          <Glyph name="clock" size={16} weight={2.2} />
          {row.next}
        </p>
      )}
      {row.unavailable != null && (
        <p className="am-inset am-unavailable">
          <span className="am-ring" aria-hidden="true" />
          <Link to="/demo/events/evt-draft-4?state=replyByEmpty">{row.unavailable}</Link>
        </p>
      )}
    </li>
  );
}

function TurnOff({ s, act }: { s: AutoState; act: (next: AutoState, focus?: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const keep = useRef<HTMLButtonElement>(null);
  const opener = `[data-am="switch-${s.confirm}"]`;
  const close = () => act(keepOn(s), opener);
  const words = confirmWords(s);

  useDialogKeys(box, close, false);
  useEffect(() => keep.current?.focus(), []);

  if (words == null) return null;

  return (
    <>
      <div className="dialog-scrim" aria-hidden="true" />
      <div
        ref={box}
        className="dialog hig-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="am-off-title"
        aria-describedby="am-off-line"
        tabIndex={-1}
      >
        <div className="dialog-heading">
          <h2 id="am-off-title">{words.title}</h2>
          <p id="am-off-line">{words.body}</p>
        </div>
        <ActionPair
          className="dialog-actions"
          dismiss={
            <button ref={keep} type="button" className="link-button" onClick={close}>
              {AW.keepOn}
            </button>
          }
          confirm={
            <button type="button" className="button" onClick={() => act(confirmOff(s), opener)}>
              {AW.turnOff}
            </button>
          }
        />
      </div>
    </>
  );
}
