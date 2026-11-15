import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { offButton } from '../offButton.ts';
import { BoardPage } from './BoardPage.tsx';
import {
  type Mark,
  NOTIFICATION_SETTINGS,
  SAVE_MS,
  type Standing,
  U,
  openingOf,
  pageOf,
} from './unsubscribe.ts';
import './unsubscribe.css';

type Pressed = 'button' | 'retry';

/** /demo/unsubscribe (sc-4331): the page the daily summary's footer link opens, signed out, at any width. */
export function Unsubscribe() {
  const [params] = useSearchParams();
  const state = params.get('state');

  return <UnsubscribeBoard key={state ?? ''} state={state} />;
}

function UnsubscribeBoard({ state }: { state: string | null }) {
  const [opening] = useState(() => openingOf(state));
  const [standing, setStanding] = useState<Standing>(opening.standing);
  const [saving, setSaving] = useState<Pressed | null>(opening.saving ? 'button' : null);
  const [failures, setFailures] = useState(opening.failed ? 1 : 0);
  const [fails, setFails] = useState(false);
  const [said, setSaid] = useState<string>(opening.saving ? U.saving : '');
  const heading = useRef<HTMLHeadingElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const changed = useRef(false);
  const pending = useRef<number | undefined>(undefined);
  const page = pageOf(standing);

  useEffect(() => () => window.clearTimeout(pending.current), []);

  // Opened mid-save or after a failed one, focus is where the press left it.
  useEffect(() => {
    if (opening.saving || opening.failed) button.current?.focus();
  }, [opening]);

  useEffect(() => {
    if (changed.current) heading.current?.focus();
  }, [standing]);

  function save(pressed: Pressed): void {
    if (saving != null || page.save == null) return;

    const to = page.save.to;
    const failing = fails;
    setSaving(pressed);
    setSaid(U.saving);
    pending.current = window.setTimeout(() => {
      setSaving(null);
      setSaid('');
      if (failing) {
        setFailures((was) => was + 1);
        return;
      }

      setFailures(0);
      changed.current = true;
      setStanding(to);
    }, SAVE_MS);
  }

  return (
    <BoardPage
      end={null}
      controls={
        <label className="demo-switch">
          <input
            type="checkbox"
            role="switch"
            checked={fails}
            onChange={(event) => setFails(event.target.checked)}
          />
          {U.saveFails}
        </label>
      }
    >
      <meta name="robots" content="noindex" />
      <meta name="referrer" content="no-referrer" />
      <div className="unsub">
        <span className="unsub-mark" aria-hidden="true">
          <MarkGlyph mark={page.mark} />
        </span>
        <div className="unsub-words">
          <h1 ref={heading} tabIndex={-1}>
            {page.title}
          </h1>
          {page.body != null && <p className="unsub-body">{page.body}</p>}
        </div>
        <div className="unsub-actions">
          {page.save != null && (
            <button
              ref={button}
              className="button button-primary unsub-pill"
              type="button"
              aria-busy={saving === 'button'}
              {...offButton(saving != null, { dim: false })}
              onClick={() => save('button')}
            >
              {saving === 'button' && <span className="demo-spinner" aria-hidden="true" />}
              <span>{page.save.label}</span>
            </button>
          )}
          {page.signIn === true && (
            <Link className="button button-primary unsub-pill" to={NOTIFICATION_SETTINGS}>
              {U.signIn}
            </Link>
          )}
          {failures > 0 && (
            <div className="unsub-failed">
              <RingCross />
              <div className="unsub-failed-words">
                <p key={failures} className="unsub-failed-line" role="alert">
                  {U.failed}
                </p>
                <button
                  className="link-button unsub-retry"
                  type="button"
                  aria-busy={saving === 'retry'}
                  {...offButton(saving != null, { dim: false })}
                  onClick={() => save('retry')}
                >
                  {saving === 'retry' && <span className="demo-spinner" aria-hidden="true" />}
                  {U.tryAgain}
                </button>
              </div>
            </div>
          )}
          {page.settings && (
            <Link className="link-button unsub-link" to={NOTIFICATION_SETTINGS}>
              {U.settings}
            </Link>
          )}
          <p className="visually-hidden" role="status">
            {said}
          </p>
        </div>
      </div>
    </BoardPage>
  );
}

const ENVELOPE = 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z';
const FLAP = 'm22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7';

/** The four marks, 28 in the 56 circle, drawn here rather than in the product's icon set. */
function MarkGlyph({ mark }: { mark: Mark }) {
  return (
    <svg className="unsub-glyph" width={28} height={28} viewBox="0 0 24 24" focusable="false">
      {mark === 'envelope' && (
        <>
          <path d={ENVELOPE} />
          <path d={FLAP} />
        </>
      )}
      {mark === 'envelopeOff' && (
        <>
          <path d={ENVELOPE} />
          <path d={FLAP} />
          <path className="unsub-knock" d="M3 2.5 21 21.5" />
          <path d="M3 2.5 21 21.5" />
        </>
      )}
      {mark === 'envelopeTick' && (
        <>
          <path d="M22 12.5V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8" />
          <path d={FLAP} />
          <path d="m15.5 19 2.5 2.5 4.5-4.5" />
        </>
      )}
      {mark === 'brokenLink' && (
        <>
          <path d="m18.84 12.25 1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="m5.17 11.75-1.71 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          <path d="M8 2v3M2 8h3M16 19v3M19 16h3" />
        </>
      )}
    </svg>
  );
}

/** The failure's ring with a cross, beside its words, so red is never the only sign. */
function RingCross() {
  return (
    <svg
      className="unsub-failed-mark"
      width={20}
      height={20}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx={12} cy={12} r={9.5} />
      <path d="m15 9-6 6M9 9l6 6" />
    </svg>
  );
}
