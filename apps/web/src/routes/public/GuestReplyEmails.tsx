import { ApiError } from '@soirely/api-client';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';

import { api } from '../../api.ts';
import { AuthPage } from '../../components/AuthPage.tsx';
import { offButton } from '../../offButton.ts';
import './guestReplyEmails.css';

/** Where Guest reply emails stand as the page shows them; `backOn` is on, after Turn them back on. */
type Standing = 'on' | 'off' | 'backOn' | 'unknown';
type Mark = 'envelope' | 'envelopeOff' | 'envelopeTick' | 'brokenLink';
type Pressed = 'button' | 'retry';

const SETTINGS = '/app/account/notifications';

const MARKS: Record<Standing, Mark> = {
  on: 'envelope',
  off: 'envelopeOff',
  backOn: 'envelopeTick',
  unknown: 'brokenLink',
};

/** /unsubscribe/guest-replies#token (sc-4331): the page the summary's footer link opens, signed out. Opening it changes nothing; the token never leaves the page but in a request's body. */
export function GuestReplyEmails() {
  const { hash } = useLocation();
  const token = hash.replace(/^#/, '');

  return <GuestReplyEmailsPage key={token} token={token} />;
}

function GuestReplyEmailsPage({ token }: { token: string }) {
  const { t } = useTranslation();
  const [standing, setStanding] = useState<Standing | null>(token === '' ? 'unknown' : null);
  const [saving, setSaving] = useState<Pressed | null>(null);
  const [failures, setFailures] = useState(0);
  const [said, setSaid] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const changed = useRef(false);

  useEffect(() => {
    if (token === '') return;
    let current = true;

    api.guestReplyEmails(token).then(
      (on) => current && setStanding(on ? 'on' : 'off'),
      (error: unknown) => {
        if (current && error instanceof ApiError && error.status === 404) setStanding('unknown');
      },
    );

    return () => {
      current = false;
    };
  }, [token]);

  useEffect(() => {
    if (changed.current) heading.current?.focus();
  }, [standing]);

  if (standing == null)
    return (
      <AuthPage bare end={null}>
        {null}
      </AuthPage>
    );

  const to = standing === 'on' ? 'off' : standing === 'off' ? 'backOn' : null;

  function save(pressed: Pressed): void {
    if (saving != null || to == null) return;

    setSaving(pressed);
    setSaid(t('guestReplyEmails.saving'));
    api.setGuestReplyEmails(token, to === 'backOn').then(
      () => {
        setSaving(null);
        setSaid('');
        setFailures(0);
        changed.current = true;
        setStanding(to);
      },
      () => {
        setSaving(null);
        setSaid('');
        setFailures((was) => was + 1);
      },
    );
  }

  const title = {
    on: t('guestReplyEmails.onTitle'),
    off: t('guestReplyEmails.offTitle'),
    backOn: t('guestReplyEmails.backOnTitle'),
    unknown: t('guestReplyEmails.unknownTitle'),
  }[standing];
  const body = {
    on: null,
    off: t('guestReplyEmails.offBody'),
    backOn: t('guestReplyEmails.backOnBody'),
    unknown: t('guestReplyEmails.unknownBody'),
  }[standing];
  const label =
    to === 'off'
      ? t('guestReplyEmails.turnOff')
      : to === 'backOn'
        ? t('guestReplyEmails.turnOn')
        : null;

  return (
    <AuthPage bare end={null}>
      <meta name="robots" content="noindex" />
      <meta name="referrer" content="no-referrer" />
      <div className="unsub">
        <span className="unsub-mark" aria-hidden="true">
          <MarkGlyph mark={MARKS[standing]} />
        </span>
        <div className="unsub-words">
          <h1 ref={heading} tabIndex={-1}>
            {title}
          </h1>
          {body != null && <p className="unsub-body">{body}</p>}
        </div>
        <div className="unsub-actions">
          {label != null && (
            <button
              className="button button-primary unsub-pill"
              type="button"
              aria-busy={saving === 'button'}
              {...offButton(saving != null, { dim: false })}
              onClick={() => save('button')}
            >
              {saving === 'button' && <span className="unsub-spinner" aria-hidden="true" />}
              <span>{label}</span>
            </button>
          )}
          {standing === 'unknown' && (
            <Link className="button button-primary unsub-pill" to={SETTINGS}>
              {t('guestReplyEmails.signIn')}
            </Link>
          )}
          {failures > 0 && (
            <div className="unsub-failed">
              <RingCross />
              <div className="unsub-failed-words">
                <p key={failures} className="unsub-failed-line" role="alert">
                  {t('guestReplyEmails.failed')}
                </p>
                <button
                  className="link-button unsub-retry"
                  type="button"
                  aria-busy={saving === 'retry'}
                  {...offButton(saving != null, { dim: false })}
                  onClick={() => save('retry')}
                >
                  {saving === 'retry' && <span className="unsub-spinner" aria-hidden="true" />}
                  {t('guestReplyEmails.tryAgain')}
                </button>
              </div>
            </div>
          )}
          {standing !== 'unknown' && (
            <Link className="link-button unsub-link" to={SETTINGS}>
              {t('guestReplyEmails.settings')}
            </Link>
          )}
          <p className="visually-hidden" role="status">
            {said}
          </p>
        </div>
      </div>
    </AuthPage>
  );
}

const ENVELOPE = 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z';
const FLAP = 'm22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7';

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
