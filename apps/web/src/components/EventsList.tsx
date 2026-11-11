import { EVENTS_TABS, type EventsTab } from '@soirely/domain';
import { type KeyboardEvent, type ReactNode, type Ref, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { type Shown, howSoon, rowLine, rowTag } from '../eventsList.ts';
import { EventThumb } from './EventCard.tsx';
import { Glyph } from './Glyph.tsx';
import { Notice } from './Notice.tsx';
import { CardStep, Chevron, RowWords, Tag } from './SettingsParts.tsx';
import './SettingsParts.css';
import './eventsDesk.css';
import './EventsList.css';

const TAB_WORD: Record<EventsTab, string> = {
  upcoming: 'events.tabUpcoming',
  drafts: 'events.tabDrafts',
  past: 'events.tabPast',
};

const EMPTY: Record<EventsTab, { title: string; line: string }> = {
  upcoming: { title: 'events.emptyUpcomingTitle', line: 'events.emptyUpcoming' },
  drafts: { title: 'events.emptyDraftsTitle', line: 'events.emptyDrafts' },
  past: { title: 'events.emptyPastTitle', line: 'events.emptyPast' },
};

const FIRST_RUN_STEPS = [
  'events.firstRunStepName',
  'events.firstRunStepDefaults',
  'events.firstRunStepOpen',
] as const;

/** Events' title, then New event for a role that creates events, then whatever else the header holds. */
export function EventsTop({
  title,
  newEvent,
  children,
}: {
  title?: Ref<HTMLHeadingElement>;
  newEvent?: ReactNode;
  children?: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <header className="desk-top ev-top">
      <h1 ref={title} className="desk-title ev-title" tabIndex={-1}>
        {t('events.title')}
      </h1>
      {newEvent}
      {children}
    </header>
  );
}

/** New event's look, on whatever opens it. */
export function NewEventWords() {
  const { t } = useTranslation();

  return (
    <>
      <Glyph name="plus" size={18} weight={2.4} />
      {t('events.newEvent')}
    </>
  );
}

/** A WAI-ARIA tab list, Upcoming, Drafts and Past with their counts, over the chosen tab's panel: arrow keys, Home and End move between the three and choose as they go. */
export function EventsTabs({
  tab,
  counts,
  onPick,
  children,
}: {
  tab: EventsTab;
  counts: Record<EventsTab, number>;
  onPick: (tab: EventsTab) => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const list = useRef<HTMLDivElement>(null);
  const keys = (event: KeyboardEvent<HTMLButtonElement>) => {
    const at = EVENTS_TABS.indexOf(tab);
    const to = {
      ArrowRight: EVENTS_TABS[(at + 1) % EVENTS_TABS.length],
      ArrowLeft: EVENTS_TABS[(at + EVENTS_TABS.length - 1) % EVENTS_TABS.length],
      Home: EVENTS_TABS[0],
      End: EVENTS_TABS[EVENTS_TABS.length - 1],
    }[event.key];

    if (to == null) return;

    event.preventDefault();
    onPick(to);
    list.current?.querySelector<HTMLElement>(`#ev-tab-${to}`)?.focus();
  };

  return (
    <>
      <div ref={list} className="ev-tabs" role="tablist" aria-label={t('events.title')}>
        {EVENTS_TABS.map((one) => (
          <button
            key={one}
            id={`ev-tab-${one}`}
            type="button"
            role="tab"
            className="ev-tab"
            aria-selected={one === tab}
            aria-controls={one === tab ? `ev-${one}` : undefined}
            tabIndex={one === tab ? 0 : -1}
            onClick={() => onPick(one)}
            onKeyDown={keys}
          >
            {one === tab && <Glyph name="tick" size={14} weight={2.6} />}
            {t(TAB_WORD[one])} <span className="ev-tab-count">{counts[one]}</span>
          </button>
        ))}
      </div>
      <div id={`ev-${tab}`} role="tabpanel" aria-labelledby={`ev-tab-${tab}`} className="ev-panel">
        {children}
      </div>
    </>
  );
}

/** An event in the list: its cover or colour, its name, its days and place, how soon, and a tag where it is off its tab's rule. */
export function EventRow({
  event,
  now,
  locale,
  to,
  everyPhase = false,
  guests = null,
}: {
  event: Shown;
  now: Date;
  locale: string;
  to: string;
  /** Tabs mixed, as a search's results are: every row says its phase. */
  everyPhase?: boolean;
  guests?: string | null;
}) {
  const { t } = useTranslation();
  const tag = rowTag(event, everyPhase, t);
  const soon = howSoon(event, now, t);
  const line = rowLine(event, locale, t);

  return (
    <li>
      <Link className="desk-row ev-row" to={to}>
        <EventThumb event={event} size={48} />
        <RowWords
          title={event.name}
          tag={tag != null && <Tag kind={tag.kind} word={tag.word} />}
          lines={guests == null ? [line] : [line, guests]}
        />
        {soon != null && <span className="ev-soon">{soon}</span>}
        <Chevron />
      </Link>
    </li>
  );
}

/** A tab with nothing on it: its title and line, as No events match is drawn, with no box. */
export function EventsEmptyTab({ tab }: { tab: EventsTab }) {
  const { t } = useTranslation();

  return (
    <div className="ev-none">
      <h2>{t(EMPTY[tab].title)}</h2>
      <p className="desk-line">{t(EMPTY[tab].line)}</p>
    </div>
  );
}

export function EventsFooter({ count }: { count: number }) {
  const { t } = useTranslation();

  return <p className="desk-foot">{t('events.footer', { count })}</p>;
}

/** No events yet: the card that starts the first one, or for a role without Create events the ask-an-owner Notice under it, then the three steps. Its step opens a path, or does what it is given. */
export function EventsFirstRun({
  create,
  createLabel = 'events.firstRunCreate',
  title,
}: {
  create: string | (() => void) | undefined;
  createLabel?: string;
  title?: Ref<HTMLHeadingElement>;
}) {
  const { t } = useTranslation();
  const createStep =
    typeof create === 'string' ? (
      <Link className="desk-step" to={create}>
        {t(createLabel)}
        <Glyph name="arrow" size={16} weight={2.4} />
      </Link>
    ) : (
      create != null && <CardStep label={t(createLabel)} onClick={create} />
    );

  return (
    <>
      <section className="desk-card ev-first">
        {[1, 2, 3, 4, 5, 6].map((piece) => (
          <span key={piece} className={`desk-piece p${piece}`} aria-hidden="true" />
        ))}
        <div className="desk-card-inner">
          <h2 ref={title} className="ev-card-name" tabIndex={-1}>
            {t('events.firstRunTitle')}
          </h2>
          {createStep}
        </div>
      </section>
      {create == null && <Notice kind="quiet">{t('events.firstRunAskOwner')}</Notice>}
      <ol className="desk-rows ev-steps">
        {FIRST_RUN_STEPS.map((step, index) => (
          <li key={step} className="desk-row">
            <span className="ev-step-number" aria-hidden="true">
              {index + 1}
            </span>
            <span className="desk-row-name">{t(step)}</span>
          </li>
        ))}
      </ol>
    </>
  );
}

/** Where the tabs, the card and the rows go while the list loads, as the shared shapes, heard and not seen. */
export function EventsLoading() {
  const { t } = useTranslation();

  return (
    <div className="desk-loading" role="status" aria-busy="true">
      <span className="desk-unseen">{t('events.loading')}</span>
      <span className="desk-sunk ev-bone-tabs" aria-hidden="true" />
      <span className="desk-sunk is-card ev-bone-card" aria-hidden="true" />
      <ul className="desk-rows" aria-hidden="true">
        {[1, 2, 3].map((bone) => (
          <li key={bone} className="desk-row is-bones ev-bone-row">
            <span className="desk-sunk ev-bone-thumb" />
            <span className="desk-row-words">
              <span className={`desk-sunk is-title b${bone}`} />
              <span className={`desk-sunk is-line b${bone}`} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
