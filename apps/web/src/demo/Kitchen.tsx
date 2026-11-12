import { useEffect, useId, useRef, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import { Ask, CardStep, Head, RowWords, TextAction } from '../components/SettingsParts.tsx';
import type { Tell } from '../components/SettingsParts.tsx';
import { DemoBell } from './DemoBell.tsx';
import { Opened } from '../components/EventPageParts.tsx';
import { EventsShell } from './EventParts.tsx';
import { EventSidebar } from './EventSidebar.tsx';
import { type SampleEvent, localDay, sampleEvent } from './events.ts';
import { Cover, OkLine } from './GuestsParts.tsx';
import {
  type Dialog,
  type Kitchen as KitchenHeld,
  type KitchenStart,
  CW,
  KITCHEN_EVENT,
  KW,
  READER,
  SHOWN_FIRST,
  changeLines,
  clockOfKitchen,
  copyLine,
  cw,
  dueError,
  errorWords,
  fileName,
  keepKitchen,
  keptKitchen,
  kitchenAt,
  kw,
  apiRefuses,
  latestCopy,
  madeCopy,
  newestFirst,
  picksLine,
  sheetLine,
  shortDay,
  sinceSlots,
  startOf,
} from './kitchen.ts';
import {
  type Figures,
  type Line,
  BASE,
  SAMPLES,
  allergic,
  allergyCounts,
  codeTitle,
  courseRows,
  dietCounts,
} from './kitchenChanges.ts';
import { KitchenPaper, PartsBlock } from './KitchenParts.tsx';
import { PARTS_FIGURES, PARTS_SAMPLES, type PartsSheet } from './kitchenParts.ts';
import { keptInbox, waitingLine } from './messages.ts';
import { useSwitcherStart } from './switcher.ts';
import './guests.css';
import './kitchen.css';

const MAKE_MS = 900;

/** The kitchen sheet at a desk (board Kitchen-A-Web, page e30): sc-3911's sheet beside Final numbers, the date edited in place, Give final numbers… the 400 dialog. */
export function KitchenPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const raw = params.get('state');
  useSwitcherStart();

  return <KitchenAt key={`${id ?? ''}|${raw ?? ''}`} id={id} raw={raw} />;
}

function KitchenAt({ id, raw }: { id: string | undefined; raw: string | null }) {
  const [event] = useState(() => sampleEvent(id));
  const [first] = useState(() => startOf(raw));

  if (event == null) return <Navigate to="/demo/events" replace />;
  if (event.id !== KITCHEN_EVENT)
    return <Navigate to={`/demo/events/${event.id}?area=menu`} replace />;
  if (first.paper === true && first.parts != null)
    return (
      <KitchenPaper
        event={event}
        figures={PARTS_FIGURES}
        sheet={PARTS_SAMPLES[first.parts]()}
        now={first.clock ?? clockOfKitchen()}
        back={kitchenAt(event.id, first.parts === 'inParts' ? 'inParts' : 'familyStyle')}
      />
    );

  return (
    <EventsShell
      told={first.told}
      renderSide={(tell, covered) => (
        <EventSidebar
          event={event}
          area="menu"
          now={first.clock ?? clockOfKitchen()}
          tell={tell}
          inert={covered}
          waiting={waitingLine(keptInbox())}
        />
      )}
    >
      {(tell) => <Kitchen first={first} event={event} tell={tell} />}
    </EventsShell>
  );
}

function figuresOf(kitchen: KitchenHeld, parts: boolean): Figures {
  if (parts) return PARTS_FIGURES;

  return kitchen.sample == null ? BASE : SAMPLES[kitchen.sample].now;
}

function Kitchen({ first, event, tell }: { first: KitchenStart; event: SampleEvent; tell: Tell }) {
  const now = first.clock ?? clockOfKitchen();
  const [kitchen, setKitchen] = useState(first.kitchen);
  const [open, setOpen] = useState(first.open);
  const [dialog, setDialog] = useState<Dialog | null>(first.dialog);
  const [given, setGiven] = useState(first.given);
  const [pressed, setPressed] = useState(false);
  const [seed, setSeed] = useState<KitchenStart | null>(first.open ? first : null);
  const [all, setAll] = useState(false);
  const manage = first.manage;
  const names = first.names ?? manage;
  const copies = newestFirst(kitchen.copies);
  const [parts] = useState(() => (first.parts == null ? null : PARTS_SAMPLES[first.parts]()));
  const figures = figuresOf(kitchen, parts != null);
  const started = now.getTime() >= Date.parse(event.startsAt);

  function keep(next: typeof kitchen): void {
    keepKitchen(next);
    setKitchen(next);
  }

  useEffect(() => {
    if (dialog !== 'making' || !pressed) return undefined;

    const timer = window.setTimeout(() => {
      const held = keptKitchen();
      const copy = madeCopy(
        held.copies,
        now.toISOString(),
        READER,
        changeLines(held, names).length > 0,
      );
      const next = { ...held, copies: [copy, ...held.copies], changedAt: null };

      keepKitchen(next);
      setKitchen(next);
      setPressed(false);
      setDialog(null);
      setGiven(true);
      tell(kw(KW.noPdf, { file: fileName(event, copy) }));
    }, MAKE_MS);

    return () => window.clearTimeout(timer);
  }, [dialog, pressed, now, event, tell, names]);

  return (
    <div className="desk-page ev-page gs kitchen">
      <div className="ev-wide gs-page">
        <div className="ev-crumb-row">
          <nav className="ev-crumb" aria-label={KW.crumb}>
            <ol>
              <li className="ev-crumb-part">
                <Link to="/demo/events">{KW.events}</Link>
              </li>
              <li className="ev-crumb-part">
                <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
                <Link className="ev-crumb-name" to={`/demo/events/${event.id}`}>
                  {event.name}
                </Link>
              </li>
              <li className="ev-crumb-part">
                <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
                <Link className="ev-crumb-name" to={`/demo/events/${event.id}?area=menu`}>
                  {KW.menu}
                </Link>
              </li>
              <li className="ev-crumb-part" aria-current="page">
                <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
                <span className="ev-crumb-name">{KW.title}</span>
              </li>
            </ol>
          </nav>
          <DemoBell tell={tell} />
        </div>
        <header className="gs-top">
          <h1 className="gs-title" tabIndex={-1}>
            {KW.title}
          </h1>
          <div className="kitchen-acts">
            <button
              type="button"
              className="desk-text"
              onClick={() =>
                tell(kw(KW.noPdf, { file: fileName(event, { at: now.toISOString() }) }))
              }
            >
              <DownloadMark />
              {KW.download}
            </button>
            <button type="button" className="desk-text" onClick={() => tell(KW.printed)}>
              <PrintMark />
              {KW.print}
            </button>
          </div>
        </header>
        <div role="status" className="kitchen-said">
          {given && <OkLine>{KW.given}</OkLine>}
        </div>
        <Cover mesh={event.mesh} size="page" label="kitchen-says">
          <p id="kitchen-says" className="gs-says">
            {kw(KW.coming, { count: figures.coming })}
          </p>
          <p className="desk-on-card">{sheetLine(event, now, allergic(figures).length)}</p>
          {manage && (
            <div className="ev-card-foot">
              <CardStep label={KW.give} onClick={() => setDialog('rest')} />
            </div>
          )}
        </Cover>
        <div className="ev-columns">
          <div className="ev-left">
            <Changes
              kitchen={kitchen}
              names={names}
              timeZone={event.timeZone}
              give={manage && !started}
              onGive={() => setDialog('rest')}
            />
            <Sheet
              figures={figures}
              parts={parts}
              names={names}
              all={all}
              onAll={() => setAll(true)}
            />
          </div>
          <div className="ev-right">
            <section className="desk-block" aria-labelledby="kitchen-final">
              <Head title={<span id="kitchen-final">{KW.final}</span>} />
              <ul className="desk-rows ev-details">
                <DueRow
                  event={event}
                  now={now}
                  due={kitchen.due}
                  manage={manage}
                  open={open}
                  seed={seed}
                  onOpen={() => setOpen((was) => !was)}
                  onClose={() => {
                    setOpen(false);
                    setSeed(null);
                  }}
                  onSave={(due) => {
                    keep({ ...kitchen, due });
                    setOpen(false);
                    setSeed(null);
                    tell(KW.saved);
                  }}
                />
                {copies.map((copy) => (
                  <li key={copy.id} className="ev-part">
                    <div className="desk-row ev-detail is-locked">
                      <span className="ev-lead" aria-hidden="true">
                        <Glyph name="page" size={22} weight={2} />
                      </span>
                      <RowWords title={copyLine(copy, event.timeZone)} />
                    </div>
                    <button
                      type="button"
                      className="desk-text ev-maps"
                      onClick={() =>
                        tell(
                          copy.changes === true
                            ? `${kw(KW.noPdf, { file: fileName(event, copy) })} ${KW.changesPage}`
                            : kw(KW.noPdf, { file: fileName(event, copy) }),
                        )
                      }
                    >
                      <DownloadMark />
                      {KW.copyDownload}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </div>
      {dialog != null && (
        <Ask
          title={KW.giveTitle}
          line={KW.giveBody}
          keep={KW.cancel}
          go={dialog === 'failed' ? KW.retry : KW.download}
          red={false}
          busy={dialog === 'making' ? KW.making : undefined}
          failed={dialog === 'failed' ? KW.failed : undefined}
          onKeep={() => {
            setPressed(false);
            setDialog(null);
          }}
          onGo={() => {
            setPressed(true);
            setDialog('making');
          }}
        />
      )}
    </div>
  );
}

function DueRow({
  event,
  now,
  due,
  manage,
  open,
  seed,
  onOpen,
  onClose,
  onSave,
}: {
  event: SampleEvent;
  now: Date;
  due: string | null;
  manage: boolean;
  open: boolean;
  seed: KitchenStart | null;
  onOpen: () => void;
  onClose: () => void;
  onSave: (due: string | null) => void;
}) {
  const title = due == null ? KW.none : shortDay(due);
  const line = picksLine(due);
  const words = <RowWords title={title} lines={[KW.due]} />;
  const lead = (
    <span className="ev-lead" aria-hidden="true">
      <Glyph name="calendar" size={22} weight={2} />
    </span>
  );

  return (
    <li className="ev-part">
      {manage ? (
        <button
          type="button"
          className={open ? 'desk-row ev-detail is-lit' : 'desk-row ev-detail'}
          aria-expanded={open}
          onClick={onOpen}
        >
          {lead}
          <span className={due == null ? 'kitchen-none' : undefined}>{words}</span>
          <Glyph name="chevron" size={17} weight={2.3} className="desk-chevron" />
        </button>
      ) : (
        <div className="desk-row ev-detail is-locked">
          {lead}
          <span className={due == null ? 'kitchen-none' : undefined}>{words}</span>
        </div>
      )}
      {open ? (
        <DueEditor
          event={event}
          now={now}
          due={due}
          seed={seed}
          onClose={onClose}
          onSave={onSave}
        />
      ) : (
        line != null && (
          <p className="kitchen-picks">
            <Glyph name="info" size={15} weight={2.2} />
            {line}
          </p>
        )
      )}
    </li>
  );
}

function DueEditor({
  event,
  now,
  due,
  seed,
  onClose,
  onSave,
}: {
  event: SampleEvent;
  now: Date;
  due: string | null;
  seed: KitchenStart | null;
  onClose: () => void;
  onSave: (due: string | null) => void;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState(seed?.typed ?? due ?? '');
  const [tried, setTried] = useState(seed?.tried ?? false);
  const [refused, setRefused] = useState(seed?.apiRefused ?? false);
  const error = dueError(typed, due, event, now);
  const shown = refused ? KW.errorPast : tried && error != null ? errorWords(error) : null;
  const changed = typed !== (due ?? '') || refused;
  const help = kw(KW.help, {
    start: shortDay(localDay(event.startsAt, event.timeZone)),
    zone: event.timeZone,
  });
  const told = [`${id}-help`, shown == null ? null : `${id}-error`].filter(Boolean).join(' ');

  useEffect(() => {
    input.current?.focus();
  }, []);

  return (
    <Opened
      label={KW.due}
      changed={changed}
      onCancel={onClose}
      onSave={() => {
        setTried(true);
        if (error != null) {
          input.current?.focus();
          return;
        }
        if (seed?.apiRefused === true && apiRefuses(typed)) {
          setRefused(true);
          input.current?.focus();
          return;
        }
        onSave(typed === '' ? null : typed);
      }}
    >
      <div className="desk-field">
        <div className="kitchen-label">
          <label htmlFor={id} className="desk-label">
            {KW.due}
          </label>
          <span className="gs-optional">{KW.optional}</span>
        </div>
        <div className={shown == null ? 'desk-box' : 'desk-box is-wrong'}>
          <input
            ref={input}
            id={id}
            type="date"
            value={typed}
            aria-invalid={shown != null}
            aria-describedby={told}
            onChange={(change) => {
              setTyped(change.target.value);
              setRefused(false);
            }}
          />
          {typed !== '' && (
            <button
              type="button"
              className="kitchen-clear"
              aria-label={KW.clear}
              onClick={() => {
                setTyped('');
                setRefused(false);
                input.current?.focus();
              }}
            >
              <Glyph name="clear" size={12} weight={3} />
            </button>
          )}
        </div>
        <p id={`${id}-help`} className="desk-help">
          {help}
        </p>
        {shown != null && (
          <p id={`${id}-error`} className="desk-error" role="alert">
            <Glyph name="alert" size={15} weight={2.2} />
            {shown}
          </p>
        )}
      </div>
    </Opened>
  );
}

const LEAD: Record<Line['kind'], 'alert' | 'menu' | 'users' | null> = {
  allergy: 'alert',
  diet: 'menu',
  coming: 'users',
  dish: null,
};

/** sc-30692: what changed since the latest copy, opening the sheet, in its order; Give the changes… ends it only when there is a change. */
function Changes({
  kitchen,
  names,
  timeZone,
  give,
  onGive,
}: {
  kitchen: KitchenHeld;
  names: boolean;
  timeZone: string;
  give: boolean;
  onGive: () => void;
}) {
  const copy = latestCopy(kitchen);

  if (copy == null) return null;

  const lines = changeLines(kitchen, names);
  const slots = sinceSlots(copy, timeZone);

  return (
    <section className="desk-block kitchen-changes" aria-labelledby="kitchen-since">
      <Head
        title={<span id="kitchen-since">{cw(lines.length === 0 ? CW.none : CW.since, slots)}</span>}
      />
      {lines.length > 0 && (
        <ul className="desk-rows">
          {lines.map((line) => {
            const lead = LEAD[line.kind];

            return (
              <li key={line.key} className="desk-row">
                {lead != null && (
                  <span className="ev-lead" aria-hidden="true">
                    <Glyph name={lead} size={22} weight={2} />
                  </span>
                )}
                <RowWords title={line.text} />
              </li>
            );
          })}
        </ul>
      )}
      {give && lines.length > 0 && (
        <button type="button" className="desk-text ev-maps" onClick={onGive}>
          {CW.give}
          <Glyph name="arrow" size={16} weight={2.4} />
        </button>
      )}
    </section>
  );
}

function Sheet({
  figures,
  parts,
  names,
  all,
  onAll,
}: {
  figures: Figures;
  parts: PartsSheet | null;
  names: boolean;
  all: boolean;
  onAll: () => void;
}) {
  const people = allergic(figures);
  const shown = all ? people : people.slice(0, SHOWN_FIRST);

  return (
    <>
      <section className="desk-block" aria-labelledby="kitchen-allergies">
        <Head
          title={
            <span id="kitchen-allergies">
              {KW.allergies}
              <span className="kitchen-count"> · {people.length}</span>
            </span>
          }
        />
        <ul className="desk-rows">
          {names
            ? shown.map((one) => (
                <li key={one.guest} className="desk-row">
                  <span className="ev-lead" aria-hidden="true">
                    <Glyph name="alert" size={22} weight={2} />
                  </span>
                  <RowWords
                    title={one.name}
                    lines={[[...one.allergies.map(codeTitle), one.dishes].join(' · ')]}
                  />
                </li>
              ))
            : allergyCounts(figures).map(([allergen, count]) => (
                <li key={allergen} className="desk-row">
                  <span className="ev-lead" aria-hidden="true">
                    <Glyph name="alert" size={22} weight={2} />
                  </span>
                  <RowWords title={codeTitle(allergen)} />
                  <span className="kitchen-figure">{count}</span>
                </li>
              ))}
        </ul>
        {names && !all && (
          <TextAction label={kw(KW.showAll, { count: people.length })} onClick={onAll} />
        )}
        {!names && <p className="desk-line">{KW.namesNeed}</p>}
      </section>
      <section className="desk-block" aria-labelledby="kitchen-diets">
        <Head title={<span id="kitchen-diets">{KW.diets}</span>} />
        <ul className="desk-rows">
          {dietCounts(figures).map(([diet, count]) => (
            <li key={diet} className="desk-row">
              <span className="ev-lead" aria-hidden="true">
                <Glyph name="menu" size={22} weight={2} />
              </span>
              <RowWords title={codeTitle(diet)} />
              <span className="kitchen-figure">{count}</span>
            </li>
          ))}
        </ul>
      </section>
      {figures.courses.map((course) =>
        parts?.course.id === course.id ? (
          <PartsBlock key={course.id} sheet={parts} coming={figures.coming} />
        ) : (
          <section
            key={course.id}
            className="desk-block"
            aria-labelledby={`kitchen-${course.name}`}
          >
            <Head
              title={
                <span id={`kitchen-${course.name}`}>
                  {course.name}
                  <span className="kitchen-count"> · {figures.coming}</span>
                </span>
              }
            />
            <ul className="desk-rows">
              {courseRows(figures, course.id).map(({ id, name: dish, count }) => (
                <li key={id} className="desk-row">
                  <RowWords title={dish} />
                  <span className="kitchen-figure">{count}</span>
                </li>
              ))}
            </ul>
          </section>
        ),
      )}
    </>
  );
}

/** Download and Print are drawn here, in the demo, not added to the product's icon set. */
function DownloadMark() {
  return (
    <svg className="kitchen-mark" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
    </svg>
  );
}

function PrintMark() {
  return (
    <svg className="kitchen-mark" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" rx="1" />
    </svg>
  );
}
