import { type CalendarFeedLink } from '@soirely/api-client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { ConfirmDialog } from '../../../components/ConfirmDialog.tsx';
import { useDialogKeys } from '../../../dialogFocus.ts';
import { usePhoneWidth } from '../../../phoneWidth.ts';
import { focusStep } from '../../../stepFocus.ts';

const NO_DIALOG = { current: null };

const IN_FEED = ['inName', 'inTimes', 'inVenue', 'inMilestones'] as const;

const NEVER_IN_FEED = ['outGuests', 'outContacts', 'outDietary', 'outMoney'] as const;

type Load = { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; link: CalendarFeedLink };

/** The Calendar's "Subscribe in your calendar app" (sc-3626): the reader's own private feed link, to copy, open or reset. */
export function CalendarSubscribe({
  organisationId,
  organisationName,
}: {
  organisationId: string;
  organisationName: string;
}) {
  const { t } = useTranslation();
  const phone = usePhoneWidth();
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);

  const close = () => {
    setOpen(false);
    window.setTimeout(() => opener.current?.focus(), 0);
  };

  return (
    <>
      <button
        ref={opener}
        type="button"
        className="button calendar-subscribe-open"
        onClick={() => setOpen(true)}
      >
        <CalendarIcon />
        {phone ? t('calendarFeed.openShort') : t('calendarFeed.open')}
      </button>
      {open && (
        <SubscribeDialog
          organisationId={organisationId}
          organisationName={organisationName}
          onClose={close}
        />
      )}
    </>
  );
}

function SubscribeDialog({
  organisationId,
  organisationName,
  onClose,
}: {
  organisationId: string;
  organisationName: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const phone = usePhoneWidth();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [copied, setCopied] = useState(false);
  const [copyRefused, setCopyRefused] = useState(false);
  const [renewed, setRenewed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [notReset, setNotReset] = useState(false);
  const [announce, setAnnounce] = useState('');
  const [selectLink, setSelectLink] = useState(0);
  const dialog = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const linkField = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => focusStep(heading.current), []);
  useDialogKeys(confirming ? NO_DIALOG : dialog, onClose, confirming);

  useEffect(() => {
    let current = true;

    api.calendarFeed(organisationId).then(
      (link) => current && setLoad({ kind: 'loaded', link }),
      () => current && setLoad({ kind: 'failed' }),
    );

    return () => {
      current = false;
    };
  }, [organisationId, attempt]);

  useEffect(() => {
    if (selectLink === 0) return;

    linkField.current?.focus();
    linkField.current?.select();
  }, [selectLink]);

  async function copy(url: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setCopyRefused(false);
      setAnnounce(t('calendarFeed.copiedAnnounce'));
    } catch {
      setCopyRefused(true);
      setSelectLink((times) => times + 1);
    }
  }

  async function reset(): Promise<void> {
    setResetting(true);
    setNotReset(false);

    try {
      const link = await api.resetCalendarFeed(organisationId);
      setLoad({ kind: 'loaded', link });
      setConfirming(false);
      setRenewed(true);
      setCopied(false);
      setCopyRefused(false);
      setSelectLink((times) => times + 1);
    } catch {
      setNotReset(true);
    } finally {
      setResetting(false);
    }
  }

  return (
    <>
      <div className="dialog-scrim" aria-hidden="true" />
      <div
        ref={dialog}
        className="dialog calendar-subscribe"
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-subscribe-title"
      >
        <div className="calendar-subscribe-head">
          <h2 id="calendar-subscribe-title" ref={heading} tabIndex={-1}>
            {t('calendarFeed.title')}
          </h2>
          <button
            type="button"
            className="calendar-subscribe-close"
            aria-label={t('calendarFeed.close')}
            onClick={onClose}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <div className="calendar-subscribe-body">
          <p className="calendar-subscribe-intro">
            {t('calendarFeed.intro', { organisation: organisationName })}
          </p>

          {load.kind === 'loading' && <p className="muted">{t('calendarFeed.loading')}</p>}

          {load.kind === 'failed' && (
            <div className="notice notice-broken" role="alert">
              <span className="mark mark-broken" aria-hidden="true">
                ✕
              </span>
              <p>{t('calendarFeed.unreadable')}</p>
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setLoad({ kind: 'loading' });
                  setAttempt((tries) => tries + 1);
                }}
              >
                {t('calendarFeed.retry')}
              </button>
            </div>
          )}

          {load.kind === 'loaded' && (
            <div className="calendar-subscribe-link">
              <label htmlFor="calendar-subscribe-url">{t('calendarFeed.linkLabel')}</label>
              <input
                ref={linkField}
                className="input input-locked calendar-subscribe-url"
                id="calendar-subscribe-url"
                type="text"
                value={load.link.url}
                readOnly
                aria-describedby="calendar-subscribe-private"
                onFocus={(event) => event.target.select()}
              />
              {renewed && (
                <p className="calendar-subscribe-line calendar-subscribe-renewed">
                  <span aria-hidden="true">✓</span>
                  {t('calendarFeed.newLink')}
                </p>
              )}
              {copyRefused && (
                <p className="calendar-subscribe-line calendar-subscribe-warning" role="alert">
                  {t('calendarFeed.copyRefused')}
                </p>
              )}
              <div className="calendar-subscribe-buttons">
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => void copy(load.link.url)}
                >
                  {copied && <span aria-hidden="true">✓</span>}
                  {copied ? t('calendarFeed.copied') : t('calendarFeed.copy')}
                </button>
                <a className="button" href={load.link.webcal}>
                  {t('calendarFeed.openInApp')}
                </a>
              </div>
              <p
                id="calendar-subscribe-private"
                className="calendar-subscribe-line calendar-subscribe-warning"
              >
                {t('calendarFeed.private')}
              </p>
            </div>
          )}

          <section className="calendar-subscribe-lists" aria-labelledby="calendar-subscribe-in">
            <div>
              <h3 id="calendar-subscribe-in" className="calendar-subscribe-subtitle">
                {t('calendarFeed.inTitle')}
              </h3>
              <ul>
                {IN_FEED.map((key) => (
                  <li key={key}>{t(`calendarFeed.${key}`)}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="calendar-subscribe-subtitle">{t('calendarFeed.outTitle')}</h3>
              <ul>
                {NEVER_IN_FEED.map((key) => (
                  <li key={key}>{t(`calendarFeed.${key}`)}</li>
                ))}
              </ul>
            </div>
            <p className="calendar-subscribe-access">{t('calendarFeed.access')}</p>
          </section>

          {load.kind === 'loaded' && (
            <div className="calendar-subscribe-reset">
              <h3 className="calendar-subscribe-subtitle">{t('calendarFeed.resetTitle')}</h3>
              <p>{t('calendarFeed.resetBody')}</p>
              <div>
                <button
                  type="button"
                  className="button calendar-subscribe-reset-button"
                  onClick={() => {
                    setNotReset(false);
                    setAnnounce('');
                    setConfirming(true);
                  }}
                >
                  {t('calendarFeed.reset')}
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="visually-hidden" role="status">
          {announce}
        </p>
      </div>

      {confirming && (
        <ConfirmDialog
          id="calendar-subscribe-confirm"
          title={t('calendarFeed.confirmTitle')}
          keep={t('calendarFeed.keep')}
          go={t('calendarFeed.reset')}
          pending={resetting}
          opensPage
          stacks={phone}
          refusal={
            notReset ? (
              <div className="notice notice-broken" role="alert">
                <span className="mark mark-broken" aria-hidden="true">
                  ✕
                </span>
                <p>{t('calendarFeed.notReset')}</p>
              </div>
            ) : undefined
          }
          onKeep={() => {
            setConfirming(false);
            setAnnounce(t('calendarFeed.kept'));
          }}
          onGo={() => void reset()}
        >
          <p>{t('calendarFeed.confirmBody')}</p>
        </ConfirmDialog>
      )}
    </>
  );
}

function CalendarIcon() {
  return (
    <svg
      className="calendar-subscribe-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}
