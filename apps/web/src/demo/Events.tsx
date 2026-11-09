import { DemoBell } from './DemoBell.tsx';
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
  sampleEvents,
  searching,
  withoutTab,
} from './events.ts';
import { DuplicateDialog } from './EventDialogs.tsx';
import { GUEST_WORDS as G, SAMPLE_GUESTS, figureOf, guestCountsOf } from './guestCounts.ts';
import { guestLineOf } from './guests.ts';
import { EventCard, EventRow, EventsShell } from './EventParts.tsx';
import { FilterMenu } from './EventFilter.tsx';
import { Glyph } from '../components/Glyph.tsx';
import { Notice } from '../components/Notice.tsx';
import { CardStep, Head, TextAction } from '../components/SettingsParts.tsx';
import type { Tell } from '../components/SettingsParts.tsx';
import { TodaySidebar } from './TodaySidebar.tsx';
import { AccessPaused, Switched } from './OrgSwitcher.tsx';
import { SIDEBAR_EVENTS, VIEWERS } from './settings.ts';
import type { EventKey } from './today.ts';
import { isFresh, usePaused, useSwitcherStart, useWhere } from './switcher.ts';

const TAB_WORDS: Record<Tab, string> = { upcoming: W.upcoming, drafts: W.drafts, past: W.past };

/** Events at a desk in A · Summary first (Events-A-Desk, page 29): the list from the Today sidebar, on sample data. */
export function Events() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const state = listStateOf(params.get('state'));
  useSwitcherStart();
  const paused = usePaused();
  const fresh = isFresh(useWhere());
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
          events={start.first || fresh ? [] : sidebarEvents(start.emptied)}
          tell={tell}
          listing
          person={start.asks ? VIEWERS.ana : VIEWERS.folake}
          inert={covered}
        />
      )}
    >
      {(tell) =>
        paused ? (
          <PausedPage />
        ) : (
          <EventsList
            key={fresh ? 'fresh' : 'sample'}
            start={fresh ? { ...start, first: true } : start}
            tell={tell}
          />
        )
      }
    </EventsShell>
  );
}

/** The sidebar's events as the page has them: an emptied tab's events leave the sidebar too. */
function sidebarEvents(emptied: Tab | null): EventKey[] {
  const events = sampleEvents();
  const kept = emptied == null ? events : withoutTab(events, emptied, CLOCKS.rest);

  return SIDEBAR_EVENTS.filter((key) => kept.some((event) => event.id === TODAY_IDS[key]));
}

function EventsList({ start, tell }: { start: ReturnType<typeof listStart>; tell: Tell }) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const now = CLOCKS.rest;
  const [events] = useState<SampleEvent[]>(() => {
    if (start.first) return [];

    return start.emptied == null ? sampleEvents() : withoutTab(sampleEvents(), start.emptied, now);
  });
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
  const guests = guestCountsOf(events, start.noGuests ? {} : SAMPLE_GUESTS, now);
  const guestsOf = (event: SampleEvent) => (start.noGuests ? null : guestLineOf(event.id));
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

  if (start.loading)
    return (
      <div className="desk-page">
        <div className="ev-column">
          <ListTop tell={tell} />
          <Switched />
          <SearchRow
            filters={filters}
            offline={false}
            waiting
            menuStart={null}
            now={now}
            onFilters={apply}
          />
          <ListLoading />
        </div>
      </div>
    );

  if (events.length === 0)
    return (
      <div className="desk-page">
        <div className="ev-column">
          <ListTop tell={tell} creates={!start.asks} />
          <Switched />
          <FirstRun tell={tell} asks={start.asks} />
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
        <GuestTiles counts={guests} />
        <Switched />
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
                  guests={guestsOf(byTab[tab][0])}
                  onStep={stepOn(byTab[tab][0])}
                />
              )}
              {byTab[tab].length === 0 ? (
                <div className="ev-none">
                  <h2>{W.emptyTab[tab].title}</h2>
                  <p className="desk-line">{W.emptyTab[tab].line}</p>
                </div>
              ) : (
                <ul className="desk-rows ev-rows" ref={firstNew}>
                  {(tab === 'past'
                    ? byTab.past.slice(0, PAST_PAGE * pastPages)
                    : byTab[tab].slice(1)
                  ).map((event) => (
                    <EventRow
                      key={event.id}
                      event={event}
                      now={now}
                      tab={tab}
                      guests={guestsOf(event)}
                    />
                  ))}
                </ul>
              )}
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
              {byTab[tab].length > 0 && <p className="desk-foot">{W.footer(byTab[tab].length)}</p>}
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

function GuestTiles({ counts }: { counts: ReturnType<typeof guestCountsOf> }) {
  return (
    <ul className="ev-guests" aria-label={G.label}>
      <li className="ev-guest">
        <span className="ev-guest-name">{G.invited}</span>
        <span className="ev-guest-figure">{figureOf(counts.invited)}</span>
        <span className="ev-guest-line">{G.coming(counts.coming)}</span>
      </li>
      <li className="ev-guest">
        <span className="ev-guest-name">{G.replied}</span>
        <span className="ev-guest-figure">{figureOf(counts.replied)}</span>
        <span className="ev-guest-line">{G.notReplied(counts.notReplied)}</span>
      </li>
    </ul>
  );
}

function PausedPage() {
  return (
    <div className="desk-page">
      <Switched />
      <AccessPaused />
    </div>
  );
}

function ListTop({ tell, creates = true }: { tell: Tell; creates?: boolean }) {
  return (
    <header className="desk-top ev-top">
      <h1 className="desk-title ev-title" tabIndex={-1}>
        {W.title}
      </h1>
      {creates && (
        <button
          type="button"
          className="ev-new"
          onClick={() => tell('Create an event has its own design.')}
        >
          <Glyph name="plus" size={18} weight={2.4} />
          {W.newEvent}
        </button>
      )}
      <DemoBell tell={tell} />
    </header>
  );
}

export function FirstRun({ tell, asks = false }: { tell: Tell; asks?: boolean }) {
  return (
    <>
      <section className="desk-card ev-first">
        {[1, 2, 3, 4, 5, 6].map((piece) => (
          <span key={piece} className={`desk-piece p${piece}`} aria-hidden="true" />
        ))}
        <div className="desk-card-inner">
          <h2 className="ev-card-name">{W.firstRunTitle}</h2>
          {!asks && (
            <CardStep
              label={W.firstRunCreate}
              onClick={() => tell('Create an event has its own design.')}
            />
          )}
        </div>
      </section>
      {asks && <Notice kind="quiet">{W.firstRunAsk}</Notice>}
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

/** Where the tabs, the card and the rows go while the list loads, as the shared shapes, heard and not seen. */
function ListLoading() {
  return (
    <div className="desk-loading" role="status" aria-busy="true">
      <span className="desk-unseen">{W.loading}</span>
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

function SearchRow({
  filters,
  offline,
  waiting = false,
  menuStart,
  now,
  onFilters,
}: {
  filters: Filters;
  offline: boolean;
  /** Off while the list loads, with no word about a connection. */
  waiting?: boolean;
  menuStart: 'top' | 'type' | null;
  now: Date;
  onFilters: (next: Filters, replace?: boolean) => void;
}) {
  const id = useId();
  const field = useRef<HTMLInputElement>(null);
  const off = offline || waiting;

  return (
    <div className="ev-search-row">
      <div className="ev-search" role="search">
        <div className={off ? 'ev-field is-off' : 'ev-field'}>
          <Glyph name="search" size={18} weight={2.2} />
          <input
            ref={field}
            type="search"
            aria-label={W.searchEvents}
            placeholder={W.searchEvents}
            value={filters.q}
            readOnly={off}
            aria-disabled={off}
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
          {filters.q !== '' && !off && (
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
      <FilterMenu filters={filters} off={off} start={menuStart} now={now} onFilters={onFilters} />
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
