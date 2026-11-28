import { type EventType, searching } from '@soirely/domain';
import { type KeyboardEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useLocation, useSearchParams } from 'react-router';

import { EventsLoading } from '../components/EventsList.tsx';
import { Glyph } from '../components/Glyph.tsx';
import { Refreshing } from '../components/OfflineBand.tsx';
import { SearchField } from '../components/SearchField.tsx';
import { Chevron, Head, RowWords, TextAction, type Tell } from '../components/SettingsParts.tsx';
import type { DeskPerson } from '../components/DeskSidebar.tsx';
import { dateLocale } from '../i18n/index.ts';
import { nextFor, openOrder, relativeWords } from './consultations.ts';
import { DemoBell } from './DemoBell.tsx';
import { OfflineBox } from './DemoOffline.tsx';
import { EventsShell } from './EventParts.tsx';
import {
  ENQUIRY_TABS,
  ENQUIRY_WORDS as W,
  type Enquiry,
  type EnquiryState,
  type EnquiryTab,
  NOW,
  type Person,
  type Results,
  type Start,
  assignedWords,
  byTab,
  changedWords,
  enquiryStateOf,
  resultsOf,
  startOf,
  visibleTo,
  whatLine,
} from './enquiries.ts';
import {
  ERASE_WORDS as E,
  erasedTitle,
  eraseListStart,
  shortDay,
  warnsOn,
} from './enquiryErase.ts';
import { formStart, formStateOf } from './enquiryForm.ts';
import { LIST, NEW, pageStart, pageStateOf } from './enquiryPage.ts';
import { useStore } from './enquiryStore.ts';
import { TodaySidebar } from './TodaySidebar.tsx';
import './enquiries.css';
import './enquiryErase.css';

const TYPING_PAUSE = 300;
const PAUSE_SHOWN = 2500;
const FIELD = 'enquiries-search';

export interface Store {
  start: Start;
  enquiries: readonly Enquiry[];
  put: (enquiry: Enquiry) => void;
  remove: (id: string) => void;
  tab: EnquiryTab;
  setTab: (tab: EnquiryTab) => void;
  typed: string;
  setTyped: (typed: string) => void;
  searched: string;
  search: (typed: string) => void;
  mine: boolean;
  setMine: (mine: boolean) => void;
  offline: boolean;
  setOffline: (offline: boolean) => void;
  listFailed: boolean;
  setListFailed: (failed: boolean) => void;
  searchFailed: boolean;
  setSearchFailed: (failed: boolean) => void;
  tell: Tell;
}

const TUNDE: DeskPerson = { name: 'Tunde Bakare', initials: 'TB', role: 'Member' };

function viewerAt(path: string, state: string | null): Person {
  if (path === NEW) return formStart(formStateOf(state)).viewer;
  if (path !== LIST) {
    const page = pageStart(pageStateOf(state)).viewer;
    if (page != null) return page;
  }

  return listStartOf(enquiryStateOf(state)).viewer.person;
}

function listStartOf(state: EnquiryState): Start {
  return eraseListStart(state, startOf(state));
}

/** /demo/enquiries and everything under it: the search and the sample's changes live here, outside the address, for as long as the person stays in Enquiries. */
export function EnquiriesArea() {
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const asked = params.get('state');
  const state = pathname === NEW ? 'idle' : enquiryStateOf(asked);
  const [listState, setListState] = useState(state);
  const viewer = viewerAt(pathname, asked);

  if (pathname === LIST && state !== listState) setListState(state);

  return (
    <EventsShell
      fit
      renderSide={(tell, covered) => (
        <TodaySidebar
          phone
          events={[]}
          tell={tell}
          enquiries
          person={viewer.role === 'member' ? TUNDE : undefined}
          inert={covered}
        />
      )}
    >
      {(tell) => <EnquiriesStore key={listState} start={listStartOf(listState)} tell={tell} />}
    </EventsShell>
  );
}

function EnquiriesStore({ start, tell }: { start: Start; tell: Tell }) {
  const [tab, setTab] = useState(start.tab);
  const [typed, setTypedNow] = useState(start.typed);
  const [searched, setSearched] = useState(start.pausing ? '' : start.typed);
  const [mine, setMine] = useState(start.viewer.mine);
  const [offline, setOffline] = useState(start.offline);
  const [listFailed, setListFailed] = useState(start.listFailed);
  const [searchFailed, setSearchFailed] = useState(start.searchFailed);
  const [enquiries, setEnquiries] = useState(start.enquiries);
  const firstPause = useRef(start.pausing);

  useEffect(() => {
    if (start.told != null) tell(start.told);
  }, [start, tell]);

  useEffect(() => {
    if (typed === searched || typed.trim() === '') return undefined;
    const rest = window.setTimeout(
      () => {
        firstPause.current = false;
        setSearched(typed);
      },
      firstPause.current ? PAUSE_SHOWN : TYPING_PAUSE,
    );

    return () => window.clearTimeout(rest);
  }, [typed, searched]);

  const store: Store = {
    start,
    enquiries,
    put: (enquiry) =>
      setEnquiries((was) =>
        was.some((one) => one.id === enquiry.id)
          ? was.map((one) => (one.id === enquiry.id ? enquiry : one))
          : [enquiry, ...was],
      ),
    remove: (id) => setEnquiries((was) => was.filter((one) => one.id !== id)),
    tab,
    setTab,
    typed,
    setTyped: (next) => {
      setTypedNow(next);
      if (next.trim() !== '') return;
      setSearched('');
      setSearchFailed(false);
    },
    searched,
    search: (next) => {
      firstPause.current = false;
      setTypedNow(next);
      setSearched(next);
      if (next === '') setSearchFailed(false);
    },
    mine,
    setMine,
    offline,
    setOffline,
    listFailed,
    setListFailed,
    searchFailed,
    setSearchFailed,
    tell,
  };

  return <Outlet context={store} />;
}

function EnquiryRow({ enquiry }: { enquiry: Enquiry }) {
  const { t } = useTranslation();
  const location = useLocation();
  const locale = dateLocale();
  const typeWord = (type: EventType) => t(`eventTypes.${type}`);
  const erased = enquiry.erased != null;
  const what = whatLine(enquiry, typeWord, W.noDate, NOW, locale);
  const who = assignedWords(enquiry, W.notAssigned);
  const when = changedWords(enquiry.changedAt, NOW, locale);
  const next = enquiry.tab === 'open' ? nextFor(enquiry) : null;
  const warns = warnsOn(enquiry, next);
  const whoLine = (
    <span key="who">
      {who}
      <span className="enq-when-inline"> · {when}</span>
    </span>
  );

  return (
    <li>
      <Link
        className="desk-row ev-row enq-row"
        to={`/demo/enquiries/${enquiry.id}${location.search}`}
        state={{ from: 'list' }}
      >
        <RowWords
          title={erased ? erasedTitle(enquiry, typeWord, locale) : enquiry.client}
          lines={
            erased
              ? [<ErasedChip key="erased" />, whoLine]
              : [
                  what,
                  whoLine,
                  ...(next == null
                    ? []
                    : [
                        <span key="next" className="enq-next">
                          <Glyph name="users" size={15} weight={2.4} />
                          {relativeWords(next, locale)}
                        </span>,
                      ]),
                  ...(warns == null
                    ? []
                    : [
                        <span key="warns" className="enq-warns">
                          <Hourglass />
                          {E.warning(shortDay(warns, locale))}
                        </span>,
                      ]),
                ]
          }
        />
        <span className="ev-soon enq-when">{when}</span>
        <Chevron />
      </Link>
    </li>
  );
}

export function Hourglass() {
  return (
    <svg
      className="enq-hourglass"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 3h12M6 21h12M7 3v3a5 5 0 0 0 10 0V3M7 21v-3a5 5 0 0 1 10 0v3" />
    </svg>
  );
}

export function ErasedChip() {
  return (
    <span className="enq-erased-chip">
      <span className="enq-erased-ring" aria-hidden="true" />
      {E.erased}
    </span>
  );
}

const row = (enquiry: Enquiry) => <EnquiryRow key={enquiry.id} enquiry={enquiry} />;

/** Enquiries (sc-31226) with Search enquiries above Open, Won and Lost (sc-42749). */
export function EnquiriesList() {
  const { t } = useTranslation();
  const store = useStore();
  const { start, enquiries, tab, searched, offline, listFailed, searchFailed } = store;
  const viewer = useMemo(
    () => ({ person: start.viewer.person, mine: store.mine }),
    [start, store.mine],
  );
  const manages = viewer.person.role !== 'member';
  const tabs = useMemo(() => {
    const sorted = byTab(visibleTo(enquiries, viewer));

    return { ...sorted, open: openOrder(sorted.open, nextFor) };
  }, [enquiries, viewer]);
  const results = searching(searched) && !offline ? resultsOf(enquiries, viewer, searched) : null;
  const newPath = manages ? NEW : `${NEW}?state=member`;

  useEffect(() => {
    if (start.pausing)
      document.querySelector<HTMLInputElement>(`input[data-focus="${FIELD}"]`)?.focus();
  }, [start]);

  const top = (
    <header className="desk-top ev-top">
      <h1 className="desk-title ev-title" tabIndex={-1}>
        {W.enquiries}
      </h1>
      <Link className="ev-new" to={newPath}>
        <Glyph name="plus" size={18} weight={2.4} />
        <span>{W.newEnquiry}</span>
      </Link>
      <DemoBell tell={store.tell} />
    </header>
  );

  if (start.loading)
    return (
      <div className="desk-page">
        <div className="ev-column">
          {top}
          <EventsLoading />
        </div>
      </div>
    );

  if (listFailed)
    return (
      <div className="desk-page">
        <div className="ev-column">
          {top}
          <Broken words={W.listFailed} onRetry={() => store.setListFailed(false)} />
        </div>
      </div>
    );

  return (
    <div className="desk-page">
      <div className="ev-column">
        {offline && <OfflineBox onRetry={() => store.setOffline(false)} />}
        <div>
          {top}
          {start.refreshing && (
            <p className="desk-line">
              <Refreshing />
            </p>
          )}
        </div>
        <div className="ev-search-row">
          <div className="ev-search" role="search">
            <SearchField
              label={W.search}
              clearLabel={t('eventsSearch.clearSearch')}
              value={store.typed}
              off={offline}
              describedBy={offline ? 'enquiries-off' : undefined}
              focusKey={FIELD}
              onChange={store.setTyped}
              onClear={() => store.search('')}
              onEnter={() => store.search(store.typed)}
            />
            {offline && (
              <p id="enquiries-off" className="desk-note">
                {t('eventsSearch.searchOff')}
              </p>
            )}
          </div>
          {manages && (
            <button
              type="button"
              className={offline ? 'ev-filter enq-mine is-off' : 'ev-filter enq-mine'}
              aria-pressed={store.mine}
              aria-disabled={offline || undefined}
              onClick={() => !offline && store.setMine(!store.mine)}
            >
              <span className="enq-box" aria-hidden="true">
                {store.mine && <Glyph name="tick" size={13} weight={3} />}
              </span>
              {W.assignedToMe}
            </button>
          )}
        </div>
        <p className="visually-hidden" role="status" aria-live="polite">
          {results == null || searchFailed ? '' : W.count(results.count)}
        </p>
        {results != null ? (
          searchFailed ? (
            <Broken words={W.searchFailed} onRetry={() => store.setSearchFailed(false)} />
          ) : (
            <EnquiryResults results={results} searched={searched} row={row} />
          )
        ) : (
          <EnquiryTabs
            tab={tab}
            counts={{ open: tabs.open.length, won: tabs.won.length, lost: tabs.lost.length }}
            onPick={store.setTab}
          >
            {tabs[tab].length === 0 ? (
              <div className="ev-none">
                <h2>{W.empty[tab].title}</h2>
                <p className="desk-line">{W.empty[tab].line}</p>
                {tab === 'open' && (
                  <div className="ev-none-actions">
                    <Link className="button button-primary" to={newPath}>
                      {W.newEnquiry}
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <ul className="desk-rows ev-rows">{tabs[tab].map(row)}</ul>
            )}
          </EnquiryTabs>
        )}
      </div>
    </div>
  );
}

function EnquiryTabs({
  tab,
  counts,
  onPick,
  children,
}: {
  tab: EnquiryTab;
  counts: Record<EnquiryTab, number>;
  onPick: (tab: EnquiryTab) => void;
  children: ReactNode;
}) {
  const list = useRef<HTMLDivElement>(null);
  const keys = (event: KeyboardEvent<HTMLButtonElement>) => {
    const at = ENQUIRY_TABS.indexOf(tab);
    const to = {
      ArrowRight: ENQUIRY_TABS[(at + 1) % ENQUIRY_TABS.length],
      ArrowLeft: ENQUIRY_TABS[(at + ENQUIRY_TABS.length - 1) % ENQUIRY_TABS.length],
      Home: ENQUIRY_TABS[0],
      End: ENQUIRY_TABS[ENQUIRY_TABS.length - 1],
    }[event.key];

    if (to == null) return;

    event.preventDefault();
    onPick(to);
    list.current?.querySelector<HTMLElement>(`#enq-tab-${to}`)?.focus();
  };

  return (
    <>
      <div ref={list} className="ev-tabs" role="tablist" aria-label={W.enquiries}>
        {ENQUIRY_TABS.map((one) => (
          <button
            key={one}
            id={`enq-tab-${one}`}
            type="button"
            role="tab"
            className="ev-tab"
            aria-selected={one === tab}
            aria-controls={one === tab ? `enq-${one}` : undefined}
            tabIndex={one === tab ? 0 : -1}
            onClick={() => onPick(one)}
            onKeyDown={keys}
          >
            {one === tab && <Glyph name="tick" size={14} weight={2.6} />}
            {W.tabs[one]} <span className="ev-tab-count">{counts[one]}</span>
          </button>
        ))}
      </div>
      <div
        id={`enq-${tab}`}
        role="tabpanel"
        aria-labelledby={`enq-tab-${tab}`}
        className="ev-panel"
      >
        {children}
      </div>
    </>
  );
}

/** The total, then a group per tab with its name and count; or what found nothing, never the empty tab's line or New enquiry. */
function EnquiryResults({
  results,
  searched,
  row,
}: {
  results: Results;
  searched: string;
  row: (enquiry: Enquiry) => ReactNode;
}) {
  const { t } = useTranslation();
  const store = useStore();

  return (
    <>
      <div className="ev-count-row">
        <p className="ev-count" aria-hidden="true">
          {W.count(results.count)}
        </p>
      </div>
      {results.count === 0 ? (
        <div className="ev-none">
          <h2>{W.noMatch}</h2>
          <p className="desk-line">{W.searched(searched.trim())}</p>
          <div className="ev-none-actions">
            <TextAction
              label={t('eventsSearch.clearSearch')}
              onClick={() => {
                store.search('');
                document.querySelector<HTMLInputElement>(`input[data-focus="${FIELD}"]`)?.focus();
              }}
            />
          </div>
        </div>
      ) : (
        <div className="ev-groups">
          {results.groups.map((group) => (
            <section key={group.tab} aria-label={W.tabs[group.tab]}>
              <Head title={W.tabs[group.tab]}>
                <span className="ev-group-count">{group.enquiries.length}</span>
              </Head>
              <ul className="desk-rows ev-rows">{group.enquiries.map(row)}</ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

function Broken({ words, onRetry }: { words: string; onRetry: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="notice notice-broken" role="alert">
      <span className="mark mark-broken" aria-hidden="true">
        ✕
      </span>
      <div className="notice-body">
        <p>{words}</p>
        <button type="button" className="button button-primary" onClick={onRetry}>
          {t('events.retry')}
        </button>
      </div>
    </div>
  );
}
