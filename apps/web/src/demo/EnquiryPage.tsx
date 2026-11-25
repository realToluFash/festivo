import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router';

import { Broken, Crumb } from '../components/EventPageParts.tsx';
import { Glyph } from '../components/Glyph.tsx';
import { Head } from '../components/SettingsParts.tsx';
import { dateLocale } from '../i18n/index.ts';
import { DemoBell } from './DemoBell.tsx';
import {
  ENQUIRY_WORDS as W,
  type Enquiry,
  type LostReason,
  NOW,
  PEOPLE,
  type Person,
  canSee,
} from './enquiries.ts';
import { PlainSelect } from './EnquiryForm.tsx';
import { CloseAsLost } from './EnquiryLost.tsx';
import { Notes } from './EnquiryNotes.tsx';
import {
  type PageStart,
  dayWords,
  listPath,
  moneyWords,
  pageStart,
  pageStateOf,
  shownPhone,
  whatsAppLink,
} from './enquiryPage.ts';
import {
  BEST_WAY_WORDS,
  FORM_WORDS as F,
  FOUND_VIA_WORDS,
  LOST_WORDS,
  PAGE_WORDS as P,
} from './enquiryWords.ts';
import { useStore } from './enquiryStore.ts';
import { EnquiryEvent } from './EnquiryEvent.tsx';
import { enquiryEventStateOf, isSource } from './enquiryToEvent.ts';
import { TYPE_WORDS } from './events.ts';

/** An enquiry's page; its ?state= names who is looking and what is open, and the address names the enquiry. sc-31232's ?state= draws its parts of the page. */
export function EnquiryPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const state = pageStateOf(params.get('state'));
  const made = enquiryEventStateOf(params.get('state'));

  if (made != null && isSource(id)) return <EnquiryEvent key={made} state={made} />;

  return <EnquiryView key={`${id}-${state ?? ''}`} id={id} start={pageStart(state)} />;
}

function EnquiryView({ id, start }: { id: string; start: PageStart }) {
  const store = useStore();
  const location = useLocation();
  const viewer = start.viewer ?? store.start.viewer.person;
  const [failed, setFailed] = useState(start.failed);
  const stored = store.enquiries.find((one) => one.id === id) ?? null;
  const enquiry = stored != null && start.date != null ? { ...stored, date: start.date } : stored;
  const shown = enquiry != null && canSee(enquiry, viewer) ? enquiry : null;
  const back = listPath(location.search);

  return (
    <div className="desk-page ev-page">
      <div className="ev-wide enq-page">
        <Crumb to={back} back={W.enquiries} name={failed ? null : (shown?.client ?? null)}>
          <DemoBell tell={store.tell} />
        </Crumb>
        {failed ? (
          <Broken
            action={
              <button
                type="button"
                className="button button-primary"
                onClick={() => setFailed(false)}
              >
                {F.tryAgain}
              </button>
            }
          >
            {P.loadFailed}
          </Broken>
        ) : shown == null ? (
          <NotHere back={back} />
        ) : (
          <Loaded enquiry={shown} viewer={viewer} start={start} />
        )}
      </div>
    </div>
  );
}

function NotHere({ back }: { back: string }) {
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => heading.current?.focus(), []);

  return (
    <div className="enq-gone">
      <h1 ref={heading} className="desk-title" tabIndex={-1}>
        {P.notFoundTitle}
      </h1>
      <p className="desk-line">{P.notFoundLine}</p>
      <Link className="desk-text" to={back}>
        <Glyph name="back" size={17} weight={2.4} />
        {P.backTo}
      </Link>
    </div>
  );
}

function StatusMark({ lost }: { lost: boolean }) {
  return (
    <svg
      className="enq-mark"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      {lost ? (
        <>
          <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
          <path d="M3 13 13 3" strokeLinecap="round" />
        </>
      ) : (
        <circle cx="8" cy="8" r="5.6" />
      )}
    </svg>
  );
}

function useNarrow(): boolean {
  const query = '(width <= 40rem)';
  const [narrow, setNarrow] = useState(
    () => typeof window.matchMedia === 'function' && window.matchMedia(query).matches,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const list = window.matchMedia(query);
    const on = () => setNarrow(list.matches);
    list.addEventListener('change', on);

    return () => list.removeEventListener('change', on);
  }, []);

  return narrow;
}

function Loaded({
  enquiry,
  viewer,
  start,
}: {
  enquiry: Enquiry;
  viewer: Person;
  start: PageStart;
}) {
  const store = useStore();
  const location = useLocation();
  const narrow = useNarrow();
  const [closing, setClosing] = useState(start.closing);
  const title = useRef<HTMLHeadingElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const notesHead = useRef<HTMLHeadingElement>(null);
  const lost = enquiry.lost;

  useEffect(() => {
    if (start.toNotes) notesHead.current?.focus();
    else if (!start.closing) title.current?.focus();
  }, [start]);

  function put(next: Partial<Enquiry>): void {
    store.put({ ...enquiry, ...next, changedAt: NOW });
  }

  function closeAsLost(reason: LostReason, line: string | null): void {
    put({ tab: 'lost', lost: { reason, line } });
    setClosing(false);
    store.tell(P.closed);
    window.setTimeout(() => title.current?.focus());
  }

  function reopen(): void {
    put({ tab: 'open', lost: null });
    store.tell(P.reopened);
    window.setTimeout(() => closeButton.current?.focus());
  }

  function keepOpen(): void {
    setClosing(false);
    window.setTimeout(() => closeButton.current?.focus());
  }

  const panel = closing && (
    <CloseAsLost docked={!narrow} start={start.lostTyped} onKeep={keepOpen} onClose={closeAsLost} />
  );

  return (
    <>
      <header className="enq-head">
        <h1 ref={title} className="desk-title" tabIndex={-1}>
          {enquiry.client}
        </h1>
        <p className={lost == null ? 'enq-page-status' : 'enq-page-status is-lost'}>
          <StatusMark lost={lost != null} />
          {lost == null ? P.open : `${P.lost} · ${LOST_WORDS[lost.reason]}`}
        </p>
      </header>
      {lost != null && (
        <div className="enq-banner" role="note">
          <StatusMark lost />
          <div className="enq-banner-words">
            <p className="enq-banner-title">{`${P.lost} · ${LOST_WORDS[lost.reason]}`}</p>
            {lost.line != null && <p className="desk-line">{lost.line}</p>}
          </div>
          <button type="button" className="button" onClick={reopen}>
            {P.reopen}
          </button>
        </div>
      )}
      <div className={closing && !narrow ? 'enq-split is-docked' : 'enq-split'}>
        <div className="enq-sections" inert={closing && narrow}>
          <ReachThem enquiry={enquiry} />
          <AboutIt
            enquiry={enquiry}
            editTo={`/demo/enquiries/${enquiry.id}/edit${location.search}`}
          />
          <AssignedTo
            enquiry={enquiry}
            viewer={viewer}
            onPick={(assignedTo) => put({ assignedTo })}
          />
          <Notes
            notes={enquiry.notesList}
            viewer={viewer}
            editingOwn={start.editingOwnNote}
            headingRef={notesHead}
            onNotes={(notesList) => put({ notesList })}
          />
          {lost == null && (
            <div className="enq-foot">
              <button
                ref={closeButton}
                type="button"
                className="button enq-lose"
                aria-expanded={closing}
                onClick={() => setClosing(true)}
              >
                {P.closeAsLost}
              </button>
            </div>
          )}
        </div>
        {panel}
      </div>
    </>
  );
}

function Card({
  title,
  children,
  after,
}: {
  title: string;
  children: ReactNode;
  after?: ReactNode;
}) {
  const id = useId();

  return (
    <section className="desk-block enq-card" aria-labelledby={id}>
      <Head title={<span id={id}>{title}</span>}>{after}</Head>
      {children}
    </section>
  );
}

function ReachThem({ enquiry }: { enquiry: Enquiry }) {
  const way = enquiry.bestWay;

  return (
    <Card title={P.reach}>
      <ul className="enq-reach">
        {enquiry.phone != null && (
          <li>
            <a className="desk-text" href={`tel:${enquiry.phone}`}>
              <Glyph name="phone" size={17} weight={2.3} />
              {P.call(shownPhone(enquiry.phone))}
            </a>
          </li>
        )}
        {enquiry.email != null && (
          <li>
            <a className="desk-text" href={`mailto:${enquiry.email}`}>
              <Glyph name="mail" size={17} weight={2.3} />
              {enquiry.email}
            </a>
          </li>
        )}
      </ul>
      {way === 'whatsapp' && enquiry.phone != null && (
        <a
          className="button enq-whatsapp"
          href={whatsAppLink(enquiry.phone)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Glyph name="message" size={17} weight={2.3} />
          {P.whatsapp}
        </a>
      )}
      {way != null && <p className="desk-line">{P.bestWayLine(BEST_WAY_WORDS[way])}</p>}
    </Card>
  );
}

function AboutIt({ enquiry, editTo }: { enquiry: Enquiry; editTo: string }) {
  const locale = dateLocale();
  const rows: [string, string | null, boolean?][] = [
    [F.type, enquiry.type == null ? null : TYPE_WORDS[enquiry.type]],
    [
      F.date,
      enquiry.date == null ? W.noDate : dayWords(enquiry.date, locale),
      enquiry.date == null,
    ],
    [F.guests, enquiry.guests == null ? null : enquiry.guests.toLocaleString(locale)],
    [F.where, enquiry.where],
    [F.budget, enquiry.budget == null ? null : moneyWords(enquiry.budget, locale)],
    [F.foundVia, enquiry.foundVia == null ? null : FOUND_VIA_WORDS[enquiry.foundVia]],
  ];

  return (
    <Card
      title={P.about}
      after={
        <Link className="button enq-edit" to={editTo}>
          {P.edit}
        </Link>
      }
    >
      <dl className="enq-facts">
        {rows.map(([label, value, quiet]) => (
          <div key={label} className="enq-fact">
            <dt>{label}</dt>
            <dd
              className={
                value == null || quiet === true
                  ? 'is-quiet'
                  : label === F.budget
                    ? 'is-money'
                    : undefined
              }
            >
              {value ?? F.notGiven}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function AssignedTo({
  enquiry,
  viewer,
  onPick,
}: {
  enquiry: Enquiry;
  viewer: Person;
  onPick: (id: string) => void;
}) {
  const id = useId();

  if (viewer.role === 'member')
    return (
      <Card title={F.assignedTo}>
        <p className="desk-line">{P.assignedYou}</p>
      </Card>
    );

  return (
    <Card title={F.assignedTo}>
      <PlainSelect
        id={id}
        label={F.assignedTo}
        value={enquiry.assignedTo ?? ''}
        placeholder={enquiry.assignedTo == null ? W.notAssigned : undefined}
        choices={Object.values(PEOPLE).map((one) => [
          one.id,
          one.id === viewer.id ? F.you(one.name) : one.name,
        ])}
        unseenLabel
        onChange={onPick}
      />
    </Card>
  );
}
