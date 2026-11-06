import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';

import {
  type Filters,
  type SampleEvent,
  type Tab,
  CLOCKS,
  EVENT_WORDS as W,
  NO_FILTERS,
  PAST_PAGE,
  TABS,
  TODAY_IDS,
  filtering,
  filtersOf,
  listStart,
  listStateOf,
  listed,
  matches,
  noMatchLine,
  paramsOf,
  rememberTab,
  rememberedTab,
  resetSample,
  sampleEvent,
  sampleEvents,
  searching,
} from './events.ts';
import { DuplicateDialog } from './EventDialogs.tsx';
import { EventCard, EventRow, EventsShell } from './EventParts.tsx';
import { FilterMenu } from './EventFilter.tsx';
import { Glyph } from './Glyph.tsx';
import { Bell, CardStep, Head, TextAction } from './SettingsParts.tsx';
import type { Tell } from './TodayParts.tsx';
import { TodaySidebar } from './TodaySidebar.tsx';
import { SIDEBAR_EVENTS } from './settings.ts';

const TAB_WORDS: Record<Tab, string> = { upcoming: W.upcoming, drafts: W.drafts, past: W.past };

/** Events at a desk in A · Summary first (Events-A-Desk, page 29): the list from the Today sidebar, on sample data. */
export function Events() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const state = listStateOf(params.get('state'));
  const [told] = useState(() => (location.state as { told?: string } | null)?.told ?? null);
  const [start] = useState(() => {
    if (params.has('state')) resetSample();

    return listStart(state);
  });

  useEffect(() => {
    if (location.state == null) return;

    void navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [location, navigate]);

  return (
    <EventsShell
      told={told}
      renderSide={(tell, covered) => (
        <TodaySidebar
          events={
            start.first ? [] : SIDEBAR_EVENTS.filter((key) => sampleEvent(TODAY_IDS[key]) != null)
          }
          tell={tell}
          listing
          inert={covered}
        />
      )}
    >
      {(tell) => <EventsList start={start} tell={tell} />}
    </EventsShell>
  );
}

function EventsList({ start, tell }: { start: ReturnType<typeof listStart>; tell: Tell }) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const now = CLOCKS.rest;
  const [events] = useState<SampleEvent[]>(() => (start.first ? [] : sampleEvents()));
  const [tab, setTab] = useState<Tab>(start.tab ?? rememberedTab());
  const [offline, setOffline] = useState(start.offline);
  const [pastPages, setPastPages] = useState(start.pastPages);
  const [copying, setCopying] = useState<SampleEvent | null>(null);
  const addressed = ['q', 'type', 'from', 'to', 'host'].some((name) => params.has(name));
  const filters = !addressed && start.filters != null ? start.filters : filtersOf(params);
  const lists = listed(events, now);
  const upcoming = [...lists.happeningNow, ...lists.upcoming];
  const byTab: Record<Tab, SampleEvent[]> = {
    upcoming,
    drafts: lists.drafts,
    past: lists.past,
  };
  const looking = searching(filters) || filtering(filters);
  const firstNew = useRef<HTMLUListElement>(null);

  function apply(next: Filters, replace = false): void {
    setParams(paramsOf(next, params), { replace });
  }

  function pick(next: Tab): void {
    setTab(next);
    rememberTab(next);
  }

  function stepOn(event: SampleEvent) {
    return (does: string) => {
      if (does === 'duplicate') setCopying(event);
      else if (does === 'makeLive') tell('Make live has its own design.');
      else void navigate(`/demo/events/${event.id}`, { state: { open: 'dates' } });
    };
  }

  if (events.length === 0)
    return (
      <div className="desk-page">
        <div className="ev-column">
          <ListTop tell={tell} />
          <FirstRun tell={tell} />
        </div>
      </div>
    );

  return (
    <div className="desk-page">
      <div className="ev-column">
        {offline && (
          <div className="ev-offline" role="status">
            <span className="ev-offline-mark" aria-hidden="true" />
            <span className="today-grow">{W.offline('09:32')}</span>
            <TextAction label={W.retry} onClick={() => setOffline(false)} />
          </div>
        )}
        <div>
          <ListTop tell={tell} />
          <p className="desk-line">{W.summary(upcoming.length, lists.drafts.length)}</p>
        </div>
        <SearchRow
          filters={filters}
          offline={offline}
          menuStart={start.menu}
          now={now}
          onFilters={apply}
        />
        {looking ? (
          <Results
            filters={filters}
            groups={TABS.map((one) => [one, byTab[one].filter((event) => matches(event, filters))])}
            now={now}
            onFilters={apply}
          />
        ) : (
          <>
            <Tabs tab={tab} counts={byTab} onPick={pick} />
            <div
              id={`ev-${tab}`}
              role="tabpanel"
              aria-labelledby={`ev-tab-${tab}`}
              className="ev-panel"
            >
              {tab !== 'past' && byTab[tab][0] != null && (
                <EventCard
                  event={byTab[tab][0]}
                  now={now}
                  level={2}
                  onStep={stepOn(byTab[tab][0])}
                />
              )}
              <ul className="desk-rows ev-rows" ref={firstNew}>
                {(tab === 'past'
                  ? byTab.past.slice(0, PAST_PAGE * pastPages)
                  : byTab[tab].slice(1)
                ).map((event) => (
                  <EventRow key={event.id} event={event} now={now} tab={tab} />
                ))}
              </ul>
              {tab === 'past' && byTab.past.length > PAST_PAGE * pastPages && (
                <TextAction
                  label={W.showMore}
                  onClick={() => {
                    setPastPages((pages) => pages + 1);
                    window.requestAnimationFrame(() => {
                      const links = firstNew.current?.querySelectorAll<HTMLElement>('a');

                      links?.[PAST_PAGE * pastPages]?.focus();
                    });
                  }}
                />
              )}
              {tab === 'past' && pastPages > 1 && (
                <p className="desk-note" role="status">
                  {W.moreShown(Math.min(byTab.past.length, PAST_PAGE * pastPages) - PAST_PAGE)}
                </p>
              )}
              <p className="desk-foot">{W.footer(byTab[tab].length)}</p>
            </div>
          </>
        )}
      </div>
      {copying != null && (
        <DuplicateDialog
          event={copying}
          onDismiss={() => setCopying(null)}
          onCreated={(words) => {
            setCopying(null);
            tell(words);
          }}
        />
      )}
    </div>
  );
}

function ListTop({ tell }: { tell: Tell }) {
  return (
    <header className="desk-top ev-top">
      <h1 className="desk-title ev-title" tabIndex={-1}>
        {W.title}
      </h1>
      <button
        type="button"
        className="ev-new"
        onClick={() => tell('Create an event has its own design.')}
      >
        <Glyph name="plus" size={18} weight={2.4} />
        {W.newEvent}
      </button>
      <Bell tell={tell} />
    </header>
  );
}

function FirstRun({ tell }: { tell: Tell }) {
  return (
    <>
      <section className="desk-card ev-first">
        {[1, 2, 3, 4, 5, 6].map((piece) => (
          <span key={piece} className={`desk-piece p${piece}`} aria-hidden="true" />
        ))}
        <div className="desk-card-inner">
          <h2 className="ev-card-name">{W.firstRunTitle}</h2>
          <CardStep
            label={W.firstRunCreate}
            onClick={() => tell('Create an event has its own design.')}
          />
        </div>
      </section>
      <ol className="desk-rows ev-steps">
        {W.firstRunSteps.map((step, index) => (
          <li key={step} className="desk-row">
            <span className="ev-step-number" aria-hidden="true">
              {index + 1}
            </span>
            <span className="desk-row-name">{step}</span>
          </li>
        ))}
      </ol>
    </>
  );
}

function SearchRow({
  filters,
  offline,
  menuStart,
  now,
  onFilters,
}: {
  filters: Filters;
  offline: boolean;
  menuStart: 'top' | 'type' | null;
  now: Date;
  onFilters: (next: Filters, replace?: boolean) => void;
}) {
  const id = useId();
  const field = useRef<HTMLInputElement>(null);

  return (
    <div className="ev-search-row">
      <div className="ev-search" role="search">
        <div className={offline ? 'ev-field is-off' : 'ev-field'}>
          <Glyph name="search" size={18} weight={2.2} />
          <input
            ref={field}
            type="search"
            aria-label={W.searchEvents}
            placeholder={W.searchEvents}
            value={filters.q}
            readOnly={offline}
            aria-disabled={offline}
            aria-describedby={offline ? `${id}-off` : undefined}
            spellCheck={false}
            onChange={(event) => onFilters({ ...filters, q: event.target.value }, true)}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && filters.q !== '') {
                event.preventDefault();
                onFilters({ ...filters, q: '' }, true);
              }
            }}
          />
          {filters.q !== '' && !offline && (
            <button
              type="button"
              className="ev-clear"
              aria-label={W.clearSearch}
              onClick={() => {
                onFilters({ ...filters, q: '' });
                field.current?.focus();
              }}
            >
              <span className="ev-clear-disc" aria-hidden="true">
                <Glyph name="clear" size={12} weight={3} />
              </span>
            </button>
          )}
        </div>
        {offline && (
          <p id={`${id}-off`} className="desk-note">
            {W.searchOff}
          </p>
        )}
      </div>
      <FilterMenu
        filters={filters}
        off={offline}
        start={menuStart}
        now={now}
        onFilters={onFilters}
      />
    </div>
  );
}

function Tabs({
  tab,
  counts,
  onPick,
}: {
  tab: Tab;
  counts: Record<Tab, readonly SampleEvent[]>;
  onPick: (tab: Tab) => void;
}) {
  const list = useRef<HTMLDivElement>(null);
  const keys = (event: KeyboardEvent<HTMLButtonElement>) => {
    const at = TABS.indexOf(tab);
    const step =
      event.key === 'ArrowRight'
        ? 1
        : event.key === 'ArrowLeft'
          ? -1
          : event.key === 'Home'
            ? -at
            : event.key === 'End'
              ? TABS.length - 1 - at
              : 0;

    if (step === 0) return;
    event.preventDefault();
    const next = TABS[(at + step + TABS.length) % TABS.length] ?? tab;
    onPick(next);
    list.current?.querySelector<HTMLElement>(`#ev-tab-${next}`)?.focus();
  };

  return (
    <div ref={list} className="ev-tabs" role="tablist" aria-label={W.title}>
      {TABS.map((one) => (
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
          {TAB_WORDS[one]}
          <span className="ev-tab-count">{counts[one].length}</span>
        </button>
      ))}
    </div>
  );
}

function Results({
  filters,
  groups,
  now,
  onFilters,
}: {
  filters: Filters;
  groups: readonly (readonly [Tab, SampleEvent[]])[];
  now: Date;
  onFilters: (next: Filters) => void;
}) {
  const count = groups.reduce((total, [, events]) => total + events.length, 0);
  const clearFilters = () => onFilters({ ...NO_FILTERS, q: filters.q });

  return (
    <>
      <div className="ev-count-row">
        <p className="ev-count" role="status" aria-live="polite">
          {W.count(count)}
        </p>
        {filtering(filters) && count > 0 && (
          <TextAction label={W.clearFilters} onClick={clearFilters} />
        )}
      </div>
      {count === 0 ? (
        <div className="ev-none" role="status">
          <h2>{W.noMatch}</h2>
          <p className="desk-line">{noMatchLine(filters, now)}</p>
          <div className="ev-none-actions">
            {searching(filters) && (
              <TextAction label={W.clearSearch} onClick={() => onFilters({ ...filters, q: '' })} />
            )}
            {filtering(filters) && <TextAction label={W.clearFilters} onClick={clearFilters} />}
          </div>
        </div>
      ) : (
        <div className="ev-groups">
          {groups.map(
            ([tab, events]) =>
              events.length > 0 && (
                <section key={tab} aria-label={TAB_WORDS[tab]}>
                  <Head title={TAB_WORDS[tab]}>
                    <span className="ev-group-count">{events.length}</span>
                  </Head>
                  <ul className="desk-rows ev-rows">
                    {events.map((event) => (
                      <EventRow key={event.id} event={event} now={now} tab="all" />
                    ))}
                  </ul>
                </section>
              ),
          )}
        </div>
      )}
    </>
  );
}
