import { type CalendarFeedLink } from '@soirely/api-client';
import { useContext, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { LayersContext, useDeskDialog } from '../layers.ts';
import { offButton } from '../offButton.ts';
import { ActionPair } from './ActionPair.tsx';
import { BrokenLine } from './CalendarWeeks.tsx';
import { Glyph } from './Glyph.tsx';

const IN_FEED = ['inName', 'inTimes', 'inVenue', 'inMilestones'] as const;

const NEVER_IN_FEED = ['outGuests', 'outContacts', 'outDietary', 'outMoney'] as const;

/** Where the reader's own feed link comes from: read, reset and copied. */
export interface FeedSource {
  read: () => Promise<CalendarFeedLink>;
  reset: () => Promise<CalendarFeedLink>;
  copy: (url: string) => Promise<void>;
}

type Load = { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; link: CalendarFeedLink };

/** The Calendar's "Subscribe in your calendar app" (sc-3626) in a desk dialog: the reader's own private feed link, to copy, open or reset. */
export function CalendarSubscribe(props: {
  organisationName: string;
  source: FeedSource;
  /** The link already in hand, so the panel opens on it. */
  first?: CalendarFeedLink;
  /** Opens on Reset your link?. */
  confirm?: boolean;
  /** Opens on a copy the browser refused, the link selected. */
  refused?: boolean;
  /** In place of following the webcal link, the line the design demo says instead. */
  instead?: string;
  onClose: () => void;
}) {
  const { host } = useContext(LayersContext);

  return host == null ? null : createPortal(<SubscribeBox {...props} />, host);
}

function SubscribeBox({
  organisationName,
  source,
  first,
  confirm = false,
  refused: refusedFirst = false,
  instead,
  onClose,
}: {
  organisationName: string;
  source: FeedSource;
  first?: CalendarFeedLink;
  confirm?: boolean;
  refused?: boolean;
  instead?: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const resetOpen = useRef<HTMLButtonElement>(null);
  const back = useRef(false);
  const [load, setLoad] = useState<Load>(
    first == null ? { kind: 'loading' } : { kind: 'loaded', link: first },
  );
  const [attempt, setAttempt] = useState(0);
  const [confirming, setConfirming] = useState(confirm);
  const [resetting, setResetting] = useState(false);
  const [notReset, setNotReset] = useState(false);
  const [copied, setCopied] = useState(false);
  const [refused, setRefused] = useState(refusedFirst);
  const [renewed, setRenewed] = useState(false);
  const [said, setSaid] = useState('');
  const [chosen, setChosen] = useState(refusedFirst ? 1 : 0);
  const [opened, setOpened] = useState(false);

  useDeskDialog(box, close, confirming ? keep : onClose, resetting);

  useEffect(() => {
    if (first != null) return;

    let current = true;

    source.read().then(
      (link) => current && setLoad({ kind: 'loaded', link }),
      () => current && setLoad({ kind: 'failed' }),
    );

    return () => {
      current = false;
    };
  }, [source, first, attempt]);

  useEffect(() => {
    if (chosen === 0) return;

    field.current?.focus();
    field.current?.select();
  }, [chosen]);

  useEffect(() => {
    if (confirming) title.current?.focus();
    else if (back.current) resetOpen.current?.focus();
    back.current = false;
  }, [confirming]);

  async function copy(url: string): Promise<void> {
    try {
      await source.copy(url);
      setCopied(true);
      setRefused(false);
      setSaid(t('calendarFeed.copiedAnnounce'));
    } catch {
      setRefused(true);
      setChosen((times) => times + 1);
    }
  }

  function keep(): void {
    setConfirming(false);
    setNotReset(false);
    setSaid(t('calendarFeed.kept'));
    back.current = true;
  }

  async function reset(): Promise<void> {
    setResetting(true);
    setNotReset(false);

    try {
      const link = await source.reset();

      setLoad({ kind: 'loaded', link });
      setConfirming(false);
      setRenewed(true);
      setCopied(false);
      setRefused(false);
      setSaid('');
      setChosen((times) => times + 1);
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
        ref={box}
        className="desk-dialog cal-feed"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
      >
        <div className="cal-feed-head">
          <h2 id={`${id}-title`} ref={title} tabIndex={-1}>
            {confirming ? t('calendarFeed.confirmTitle') : t('calendarFeed.title')}
          </h2>
          <button
            ref={close}
            type="button"
            className="cal-round"
            aria-label={t('calendarFeed.close')}
            {...offButton(resetting, { dim: false })}
            onClick={onClose}
          >
            <Glyph name="clear" size={19} weight={2.3} />
          </button>
        </div>
        <div className="cal-feed-body">
          {confirming ? (
            <>
              <p className="cal-feed-intro">{t('calendarFeed.confirmBody')}</p>
              {notReset && <BrokenLine words={t('calendarFeed.notReset')} />}
              <ActionPair
                className="cal-feed-pair"
                dismiss={
                  <button
                    type="button"
                    className="cal-feed-button"
                    {...offButton(resetting, { dim: false })}
                    onClick={keep}
                  >
                    {t('calendarFeed.keep')}
                  </button>
                }
                confirm={
                  <button
                    type="button"
                    className="cal-feed-button is-red"
                    {...offButton(resetting, { dim: false })}
                    aria-busy={resetting}
                    onClick={() => void reset()}
                  >
                    {t('calendarFeed.reset')}
                  </button>
                }
              />
            </>
          ) : (
            <>
              <p className="cal-feed-intro">
                {t('calendarFeed.intro', { organisation: organisationName })}
              </p>
              {load.kind === 'loading' && (
                <p className="cal-feed-line" role="status">
                  {t('calendarFeed.loading')}
                </p>
              )}
              {load.kind === 'failed' && (
                <>
                  <BrokenLine words={t('calendarFeed.unreadable')} />
                  <div className="cal-feed-buttons">
                    <button
                      type="button"
                      className="cal-feed-button"
                      onClick={() => {
                        setLoad({ kind: 'loading' });
                        setAttempt((tries) => tries + 1);
                      }}
                    >
                      {t('calendarFeed.retry')}
                    </button>
                  </div>
                </>
              )}
              {load.kind === 'loaded' && (
                <>
                  <div className="cal-feed-link">
                    <label htmlFor={`${id}-link`}>{t('calendarFeed.linkLabel')}</label>
                    <textarea
                      ref={field}
                      id={`${id}-link`}
                      className="cal-feed-url"
                      value={load.link.url}
                      readOnly
                      rows={2}
                      spellCheck={false}
                      aria-describedby={`${id}-private`}
                      onFocus={(event) => event.target.select()}
                    />
                  </div>
                  {renewed && (
                    <p className="cal-feed-new">
                      <span className="cal-feed-disc is-in" aria-hidden="true">
                        <Glyph name="tick" size={13} weight={3} />
                      </span>
                      {t('calendarFeed.newLink')}
                    </p>
                  )}
                  {refused && <BrokenLine words={t('calendarFeed.copyRefused')} />}
                  <div className="cal-feed-buttons">
                    <button
                      type="button"
                      className="cal-feed-button is-primary"
                      onClick={() => void copy(load.link.url)}
                    >
                      <Glyph name={copied ? 'tick' : 'copy'} size={18} weight={2.2} />
                      {copied ? t('calendarFeed.copied') : t('calendarFeed.copy')}
                    </button>
                    {instead == null ? (
                      <a className="cal-feed-button" href={load.link.webcal}>
                        <Glyph name="calendar" size={18} weight={2.2} />
                        {t('calendarFeed.openInApp')}
                      </a>
                    ) : (
                      <button
                        type="button"
                        className="cal-feed-button"
                        onClick={() => setOpened(true)}
                      >
                        <Glyph name="calendar" size={18} weight={2.2} />
                        {t('calendarFeed.openInApp')}
                      </button>
                    )}
                  </div>
                  {opened && (
                    <p className="cal-feed-line" role="status">
                      {instead}
                    </p>
                  )}
                  <p id={`${id}-private`} className="cal-feed-private">
                    <Glyph name="shield" size={18} weight={2.1} />
                    {t('calendarFeed.private')}
                  </p>
                </>
              )}
              <hr className="cal-feed-rule" />
              <div className="cal-feed-lists">
                <FeedList title={t('calendarFeed.inTitle')} lines={IN_FEED} has />
                <FeedList title={t('calendarFeed.outTitle')} lines={NEVER_IN_FEED} has={false} />
              </div>
              <p className="cal-feed-line">{t('calendarFeed.access')}</p>
              {load.kind === 'loaded' && (
                <>
                  <hr className="cal-feed-rule" />
                  <div className="cal-feed-reset">
                    <h3>{t('calendarFeed.resetTitle')}</h3>
                    <p className="cal-feed-line">{t('calendarFeed.resetBody')}</p>
                    <button
                      ref={resetOpen}
                      type="button"
                      className="cal-feed-button is-reset"
                      onClick={() => {
                        setSaid('');
                        setNotReset(false);
                        setConfirming(true);
                      }}
                    >
                      {t('calendarFeed.resetOpen')}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
        <p className="visually-hidden" role="status">
          {said}
        </p>
      </div>
    </>
  );
}

function FeedList({
  title,
  lines,
  has,
}: {
  title: string;
  lines: readonly (typeof IN_FEED | typeof NEVER_IN_FEED)[number][];
  has: boolean;
}) {
  const { t } = useTranslation();
  const id = useId();

  return (
    <section className="cal-feed-list" aria-labelledby={id}>
      <h3 id={id}>{title}</h3>
      <ul>
        {lines.map((line) => (
          <li key={line}>
            <span className={has ? 'cal-feed-disc is-in' : 'cal-feed-disc'} aria-hidden="true">
              <Glyph name={has ? 'tick' : 'clear'} size={has ? 13 : 12} weight={3} />
            </span>
            {t(`calendarFeed.${line}`)}
          </li>
        ))}
      </ul>
    </section>
  );
}
