import { searching } from '@soirely/domain';
import { type KeyboardEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Link,
  Outlet,
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
  useSearchParams,
} from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import { SearchField } from '../components/SearchField.tsx';
import { Chevron, Head, RowWords, TextAction, type Tell } from '../components/SettingsParts.tsx';
import { dateLocale } from '../i18n/index.ts';
import { DemoBell } from './DemoBell.tsx';
import { OfflineBox } from './DemoOffline.tsx';
import { EventsShell } from './EventParts.tsx';
import {
  ENQUIRY_TABS,
  ENQUIRY_WORDS as W,
  type Enquiry,
  type EnquiryTab,
  NOW,
  type Results,
  type Start,
  assignedWords,
  byTab,
  changedWords,
  enquiryOf,
  enquiryStateOf,
  resultsOf,
  startOf,
  visibleTo,
  whatLine,
} from './enquiries.ts';
import { TodaySidebar } from './TodaySidebar.tsx';
import { EnquiryEvent } from './EnquiryEvent.tsx';
import { enquiryEventStateOf, isSource } from './enquiryToEvent.ts';
import './enquiries.css';

const TYPING_PAUSE = 300;
const PAUSE_SHOWN = 2500;
const FIELD = 'enquiries-search';

interface Store {
  start: Start;
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

/** /demo/enquiries and an enquiry under it: the search lives here, outside the address, for as long as the person stays in Enquiries. */
export function EnquiriesArea() {
  const [params] = useSearchParams();
  const state = enquiryStateOf(params.get('state'));

  return (
    <EventsShell
      fit
      renderSide={(tell, covered) => (
        <TodaySidebar phone events={[]} tell={tell} enquiries inert={covered} />
      )}
    >
      {(tell) => <EnquiriesStore key={state} start={startOf(state)} tell={tell} />}
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
  const firstPause = useRef(start.pausing);

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

function useStore(): Store {
  return useOutletContext<Store>();
}

function EnquiryRow({ enquiry }: { enquiry: Enquiry }) {
  const { t } = useTranslation();
  const location = useLocation();
  const locale = dateLocale();
  const what = whatLine(enquiry, (type) => t(`eventTypes.${type}`), W.noDate, NOW, locale);
  const who = assignedWords(enquiry, W.notAssigned);
  const when = changedWords(enquiry.changedAt, NOW, locale);

  return (
    <li>
      <Link
        className="desk-row ev-row enq-row"
        to={`/demo/enquiries/${enquiry.id}${location.search}`}
      >
        <RowWords
          title={enquiry.client}
          lines={[
            what,
            <span key="who">
              {who}
              <span className="enq-when-inline"> · {when}</span>
            </span>,
          ]}
        />
        <span className="ev-soon enq-when">{when}</span>
        <Chevron />
      </Link>
    </li>
  );
}

const row = (enquiry: Enquiry) => <EnquiryRow key={enquiry.id} enquiry={enquiry} />;

/** Enquiries (sc-31226) with Search enquiries above Open, Won and Lost (sc-42749). */
export function EnquiriesList() {
  const { t } = useTranslation();
  const store = useStore();
  const { start, tab, searched, offline, listFailed, searchFailed, tell } = store;
  const viewer = useMemo(
    () => ({ person: start.viewer.person, mine: store.mine }),
    [start, store.mine],
  );
  const manages = viewer.person.role !== 'member';
  const tabs = useMemo(() => byTab(visibleTo(start.enquiries, viewer)), [start, viewer]);
  const results =
    searching(searched) && !offline ? resultsOf(start.enquiries, viewer, searched) : null;

  useEffect(() => {
    if (start.pausing)
      document.querySelector<HTMLInputElement>(`input[data-focus="${FIELD}"]`)?.focus();
  }, [start]);

  const top = (
    <header className="desk-top ev-top">
      <h1 className="desk-title ev-title" tabIndex={-1}>
        {W.enquiries}
      </h1>
      <button type="button" className="ev-new" onClick={() => tell(W.ownDesign(W.newEnquiry))}>
        <Glyph name="plus" size={18} weight={2.4} />
        <span>{W.newEnquiry}</span>
      </button>
      <DemoBell tell={tell} />
    </header>
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
        {top}
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
                    <button
                      type="button"
                      className="button button-primary"
                      onClick={() => tell(W.ownDesign(W.newEnquiry))}
                    >
                      {W.newEnquiry}
                    </button>
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

/** Where a result opens. Its page is sc-31226's to draw; Back returns to the same search and results. */
export function EnquiryPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const enquiry = enquiryOf(id);
  const locale = dateLocale();
  const [params] = useSearchParams();
  const made = enquiryEventStateOf(params.get('state'));

  if (made != null && isSource(id)) return <EnquiryEvent key={made} state={made} />;

  return (
    <div className="desk-page">
      <div className="ev-column">
        <div className="desk-top">
          <button
            type="button"
            className="desk-back"
            onClick={() =>
              location.key === 'default'
                ? void navigate(`/demo/enquiries${location.search}`)
                : void navigate(-1)
            }
          >
            <Glyph name="back" size={17} weight={2.4} />
            {W.enquiries}
          </button>
        </div>
        <h1 className="desk-title">{enquiry?.client ?? W.enquiries}</h1>
        {enquiry != null && (
          <>
            <p className="desk-line">
              {whatLine(enquiry, (type) => t(`eventTypes.${type}`), W.noDate, NOW, locale)}
            </p>
            <p className="desk-line">
              {`${assignedWords(enquiry, W.notAssigned)} · ${changedWords(enquiry.changedAt, NOW, locale)}`}
            </p>
          </>
        )}
        <p className="desk-note enq-demo-only">{W.pageDrawnElsewhere}</p>
      </div>
    </div>
  );
}
