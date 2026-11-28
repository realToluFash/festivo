import { type MouseEvent, type ReactNode, type Ref, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { Switch } from './GeneralParts.tsx';
import { Glyph } from './Glyph.tsx';
import { markOf } from './notificationMarks.ts';
import { Refreshing } from './OfflineBand.tsx';
import './GeneralParts.css';
import './SettingsParts.css';
import './BellPanel.css';

export interface BellRow {
  id: string;
  category: string;
  title: string;
  lines: readonly string[];
  /** `{event} · {when}`, or the time alone for an item with no event. */
  where: string;
  unread: boolean;
  muted: boolean;
  /** Its More, for an item whose event is still there. */
  more: { label: string; mute: ReactNode } | null;
  goneShown: boolean;
}

/** The bell's popover in the B frame (sc-83081): the product's and the demo's, one drawing. */
export function BellPanel({
  titleId,
  heading,
  refreshing,
  unread,
  onReadAll,
  band,
  notice,
  ask,
  feed,
  rows,
  onPick,
  onTryAgain,
  more,
  menu,
  onMenu,
  settings,
  onClickCapture,
}: {
  titleId: string;
  heading: Ref<HTMLHeadingElement>;
  refreshing: boolean;
  unread: number;
  onReadAll: () => void;
  band: ReactNode;
  /** Mark all read's failure, until the next thing done in the bell. */
  notice: string | null;
  ask: { onAnswer: (turnOn: boolean) => void } | null;
  feed: 'loading' | 'failed' | 'loaded';
  rows: readonly BellRow[];
  onPick: (row: BellRow) => void;
  onTryAgain: () => void;
  more: { busy: boolean; failed: boolean; onMore: () => void } | null;
  menu: string | null;
  onMenu: (id: string | null) => void;
  settings: ReactNode;
  onClickCapture?: (event: MouseEvent<HTMLElement>) => void;
}) {
  const { t } = useTranslation();

  return (
    <div
      className="bell-pop"
      role="dialog"
      aria-labelledby={titleId}
      onClickCapture={onClickCapture}
    >
      <div className="bell-head">
        <div className="bell-heading">
          <h2 id={titleId} ref={heading} tabIndex={-1}>
            {t('notifications.heading')}
          </h2>
          {refreshing && <Refreshing />}
        </div>
        <button
          type="button"
          className="desk-text"
          aria-disabled={unread === 0}
          onClick={onReadAll}
        >
          {t('notifications.markAllRead')}
        </button>
      </div>
      {band}
      {notice != null && <BellAttention words={notice} />}
      {ask != null && (
        <section className="bell-ask" aria-labelledby={`${titleId}-push`}>
          <h3 id={`${titleId}-push`}>{t('notifications.pushAsk.title')}</h3>
          <p className="bell-why">{t('notifications.pushAsk.reason')}</p>
          <div className="bell-ask-acts">
            <button
              type="button"
              className="button button-primary"
              onClick={() => ask.onAnswer(true)}
            >
              {t('notifications.pushAsk.turnOn')}
            </button>
            <button type="button" className="desk-text" onClick={() => ask.onAnswer(false)}>
              {t('notifications.pushAsk.notNow')}
            </button>
          </div>
        </section>
      )}
      <div className="bell-body">
        {feed === 'loading' && (
          <ul className="bell-items" aria-busy="true" aria-label={t('notifications.loading')}>
            {[1, 2, 3].map((bar) => (
              <li key={bar} className="bell-bones" aria-hidden="true">
                <span className="desk-sunk bell-bone-mark" />
                <span className="bell-words">
                  <span className={`desk-sunk bell-bone-title b${bar}`} />
                  <span className="desk-sunk bell-bone-line" />
                </span>
              </li>
            ))}
          </ul>
        )}
        {feed === 'failed' && (
          <div className="bell-failed" role="alert">
            <p className="desk-line is-ink">{t('notifications.couldNotLoad')}</p>
            <button type="button" className="desk-text" onClick={onTryAgain}>
              {t('notifications.tryAgain')}
            </button>
          </div>
        )}
        {feed === 'loaded' && rows.length === 0 && (
          <div className="bell-empty">
            <span className="bell-glyph" aria-hidden="true">
              <Glyph name="bell" size={20} />
            </span>
            <p>{t('notifications.empty')}</p>
          </div>
        )}
        {feed === 'loaded' && rows.length > 0 && (
          <ul className="bell-items">
            {rows.map((row) => (
              <BellItem
                key={row.id}
                row={row}
                menuOpen={menu === row.id}
                onPick={() => onPick(row)}
                onMenu={(shown) => onMenu(shown ? row.id : null)}
              />
            ))}
          </ul>
        )}
        {feed === 'loaded' && more != null && (
          <div className="bell-more">
            <button
              type="button"
              className="desk-text"
              aria-disabled={more.busy}
              aria-busy={more.busy}
              onClick={() => {
                if (!more.busy) more.onMore();
              }}
            >
              {t('notifications.showMore')}
            </button>
            {more.failed && <BellAttention words={t('notifications.moreFailed')} />}
          </div>
        )}
      </div>
      {settings}
    </div>
  );
}

function BellItem({
  row,
  menuOpen,
  onPick,
  onMenu,
}: {
  row: BellRow;
  menuOpen: boolean;
  onPick: () => void;
  onMenu: (open: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <li className="bell-row">
      <button type="button" data-notification={row.id} className="bell-item" onClick={onPick}>
        <span className="bell-glyph" aria-hidden="true">
          <Glyph name={markOf(row.category)} size={20} />
        </span>
        <span className="bell-words">
          <span className={row.unread ? 'bell-title is-unread' : 'bell-title'}>{row.title}</span>
          {row.lines.map((line, index) => (
            <span key={index} className="bell-line">
              {line}
            </span>
          ))}
          <span className="bell-line">{row.where}</span>
          {(row.unread || row.muted) && (
            <span className="bell-marks">
              {row.unread && (
                <span className="bell-unread">
                  <span className="bell-dot" aria-hidden="true" />
                  {t('notifications.unread')}
                </span>
              )}
              {row.muted && (
                <span className="bell-muted">
                  <Glyph name="bellOff" size={14} weight={2.2} />
                  {t('notifications.muted')}
                </span>
              )}
            </span>
          )}
        </span>
      </button>
      {row.more != null && (
        <BellMoreMenu label={row.more.label} open={menuOpen} onOpen={onMenu}>
          {row.more.mute}
        </BellMoreMenu>
      )}
      {row.goneShown && (
        <p className="bell-gone" role="status">
          {t('notifications.eventGone')}
        </p>
      )}
    </li>
  );
}

/** An item's More: a small panel under the button holding Mute this event; Escape closes it and returns focus to More. */
function BellMoreMenu({
  label,
  open,
  onOpen,
  children,
}: {
  label: string;
  open: boolean;
  onOpen: (open: boolean) => void;
  children: ReactNode;
}) {
  const more = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) panel.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const keys = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      onOpen(false);
      more.current?.focus();
    };

    document.addEventListener('keydown', keys);

    return () => document.removeEventListener('keydown', keys);
  }, [open, onOpen]);

  return (
    <>
      <button
        ref={more}
        type="button"
        className="bell-more-button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => onOpen(!open)}
      >
        <svg width={20} height={20} viewBox="0 0 20 20" aria-hidden="true">
          <circle cx={4.5} cy={10} r={1.8} />
          <circle cx={10} cy={10} r={1.8} />
          <circle cx={15.5} cy={10} r={1.8} />
        </svg>
      </button>
      {open && (
        <div ref={panel} className="bell-mute" role="dialog" aria-label={label} tabIndex={-1}>
          {children}
        </div>
      )}
    </>
  );
}

/** Mute this event inside More: its name, then B's switch with its On/Off word. */
export function BellMute({
  on,
  busy = false,
  onChange,
  told,
  children,
}: {
  on: boolean;
  busy?: boolean;
  onChange: (next: boolean) => void;
  told?: string | undefined;
  children?: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <>
      <div className="bell-mute-row">
        <span className="bell-mute-name">{t('notifications.muteEvent')}</span>
        <Switch
          on={on}
          label={t('notifications.muteEvent')}
          words={{ on: t('notificationSettings.on'), off: t('notificationSettings.off') }}
          {...(told == null ? {} : { told })}
          busy={busy}
          onChange={onChange}
        />
      </div>
      {children}
    </>
  );
}

/** An amber line with the alert mark: Show more's failure, and Mark all read's. */
function BellAttention({ words }: { words: string }) {
  return (
    <p className="bell-attention" role="alert">
      <Glyph name="alert" size={16} weight={2.2} />
      {words}
    </p>
  );
}
