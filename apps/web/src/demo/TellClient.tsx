import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';

import { ConfirmDialog } from '../components/ConfirmDialog.tsx';
import { Glyph } from '../components/Glyph.tsx';
import type { Tell } from '../components/SettingsParts.tsx';
import { BookPanel, ConsultationRow, Refused } from './Consultations.tsx';
import {
  CW,
  type Consultation,
  type Draft,
  type Panel,
  type Save,
  changeable,
  consultationOf,
  dayWords,
  draftOf,
  earliestFirst,
  mayEdit,
  timesWords,
} from './consultations.ts';
import { DemoBell } from './DemoBell.tsx';
import { EventsShell } from './EventParts.tsx';
import { PEOPLE } from './enquiries.ts';
import {
  type AsBooked,
  LANGUAGES,
  type Language,
  ORG,
  type Said,
  type Surface,
  TELL_NOW,
  TW,
  type TellStart,
  type Way,
  asBooked,
  hrefOf,
  languageName,
  languageOf,
  messageOf,
  saidOf,
  tellStart,
  tellStateOf,
  waysOf,
} from './tellClient.ts';
import { TodaySidebar } from './TodaySidebar.tsx';
import './consultations.css';
import './tellClient.css';

const LOCALE = 'en';
const SAVE_MS = 700;

/** /demo/tell-client (sc-37133): Tell {client} on a consultation's row, its panel, and the offer after a save. */
export function TellClient() {
  const [params] = useSearchParams();
  const state = tellStateOf(params.get('state'));
  const start = tellStart(state);

  return (
    <EventsShell
      fit
      renderSide={(tell, covered) => (
        <TodaySidebar
          phone
          events={[]}
          tell={tell}
          enquiries={!start.free}
          calendar={false}
          settings={false}
          inert={covered}
        />
      )}
    >
      {(tell) =>
        start.free ? (
          <FreeOrganisation />
        ) : (
          <EnquiryWithTell key={state} start={start} tell={tell} />
        )
      }
    </EventsShell>
  );
}

type Layer =
  | Surface
  | { kind: 'book'; panel: Extract<Panel, { kind: 'book' }> }
  | { kind: 'cancel'; consultation: Consultation };

function EnquiryWithTell({ start, tell }: { start: TellStart; tell: Tell }) {
  const [list, setList] = useState<Consultation[]>(start.list);
  const [booked, setBooked] = useState<Record<string, AsBooked>>(start.booked);
  const [layer, setLayer] = useState<Layer>(start.surface);
  const [save, setSave] = useState<Save>('idle');
  const arrivedTell = useRef<HTMLButtonElement>(null);
  const edits = mayEdit(start.enquiry, start.viewer);
  const client = start.enquiry.client;
  const docked = layer.kind === 'book' || layer.kind === 'tell' || layer.kind === 'offer';

  useEffect(() => {
    if (start.arrived == null) return;
    arrivedTell.current?.scrollIntoView?.({ block: 'center' });
    arrivedTell.current?.focus();
  }, [start.arrived]);

  function close(): void {
    setLayer({ kind: 'none' });
  }

  function finish(after: () => void): void {
    setSave('saving');
    window.setTimeout(() => {
      setSave('idle');
      after();
    }, SAVE_MS);
  }

  function openBook(change: Consultation | null): void {
    setLayer({
      kind: 'book',
      panel: {
        kind: 'book',
        change,
        draft: draftOf(change, start.enquiry, start.viewer),
        touched: false,
        pressed: false,
      },
    });
  }

  function book(draft: Draft, change: Consultation | null): void {
    const made = consultationOf(draft, change?.id ?? `con-${Date.now()}`);

    if (made == null) return;
    finish(() => {
      const before = change == null ? asBooked(made) : (booked[made.id] ?? asBooked(change));

      setList((now) =>
        change == null ? [...now, made] : now.map((one) => (one.id === change.id ? made : one)),
      );
      setBooked((now) => ({ ...now, [made.id]: before }));
      setLayer({ kind: 'offer', id: made.id, said: saidOf(made, before, TELL_NOW) ?? 'booked' });
    });
  }

  const found = (id: string) => list.find((one) => one.id === id) ?? null;
  const saidFor = (one: Consultation) => saidOf(one, booked[one.id] ?? asBooked(one), TELL_NOW);
  const shown = layer.kind === 'tell' || layer.kind === 'offer' ? found(layer.id) : null;

  return (
    <div className="desk-page con-page">
      <div className={docked ? 'con-split is-docked' : 'con-split'}>
        <div className="desk-column con-column">
          <div className="desk-top con-top">
            <nav aria-label="Breadcrumb" className="con-crumb">
              <Link to="/demo/enquiries">Enquiries</Link>
              <Glyph name="chevron" size={15} weight={2} />
              <span aria-current="page">{client}</span>
            </nav>
            <DemoBell tell={tell} />
          </div>
          <div className="con-head">
            <div className="con-head-words">
              <h1 className="desk-title con-title">{client}</h1>
              <p className="con-status">
                <span className="con-open-ring" aria-hidden="true" />
                Open
              </p>
            </div>
          </div>
          {start.arrived != null && (
            <p className="tc-arrived" role="note">
              <Glyph name="bell" size={17} weight={2.2} />
              <span>{TW.fromNotification(start.arrived.words)}</span>
            </p>
          )}
          {!edits && (
            <p className="con-read-only" role="note">
              <Glyph name="eye" size={17} weight={2.2} />
              <span>{CW.readOnly(PEOPLE.folake.name)}</span>
            </p>
          )}
          <section className="con-card" aria-labelledby="tc-consultations">
            <div className="con-card-head">
              <h2 id="tc-consultations">{CW.consultations}</h2>
              <span className="con-count">{list.length}</span>
            </div>
            <ul className="con-rows">
              {earliestFirst(list).map((one) => {
                const lit = start.arrived?.id === one.id;

                return (
                  <ConsultationRow
                    key={one.id}
                    consultation={one}
                    list={list}
                    edits={edits}
                    manages={start.viewer.role !== 'member'}
                    now={TELL_NOW}
                    lit={lit}
                    onChange={() => openBook(one)}
                    onCancel={() => setLayer({ kind: 'cancel', consultation: one })}
                    tell={
                      saidFor(one) == null ? null : (
                        <div className="con-row-acts">
                          <button
                            ref={lit ? arrivedTell : undefined}
                            type="button"
                            className="button con-outlined"
                            onClick={() => setLayer({ kind: 'tell', id: one.id })}
                          >
                            {TW.tell(client)}
                          </button>
                        </div>
                      )
                    }
                  />
                );
              })}
            </ul>
            {edits && (
              <div className="con-card-foot">
                <button
                  type="button"
                  className="button con-secondary"
                  onClick={() => openBook(null)}
                >
                  <Glyph name="plus" size={17} weight={2.4} />
                  {CW.book}
                </button>
              </div>
            )}
          </section>
          <div className="desk-note con-demo-only">
            {start.note != null && <p>{start.note}</p>}
            <p>{TW.pressNotSeen}</p>
            <p>{TW.proposal}</p>
          </div>
        </div>
        {layer.kind === 'book' && (
          <BookPanel
            key={layer.panel.change?.id ?? 'new'}
            panel={layer.panel}
            start={start}
            save={save}
            onClose={close}
            onBook={book}
            now={TELL_NOW}
          />
        )}
        {layer.kind === 'tell' && shown != null && (
          <TellPanel
            key={shown.id}
            consultation={shown}
            said={saidFor(shown) ?? 'booked'}
            start={start}
            onClose={close}
          />
        )}
        {layer.kind === 'offer' && shown != null && (
          <Offer
            consultation={shown}
            said={layer.said}
            client={client}
            onTell={() => setLayer({ kind: 'tell', id: shown.id })}
            onDone={close}
          />
        )}
      </div>
      {layer.kind === 'cancel' && (
        <ConfirmDialog
          id="tc-cancel"
          title={CW.cancelTitle}
          keep={CW.keepIt}
          go={save === 'saving' ? CW.saving : CW.cancelIt}
          pending={save === 'saving'}
          refusal={save === 'failed' ? <Refused words={CW.notCancelled} /> : undefined}
          onKeep={close}
          onGo={() =>
            finish(() => {
              const id = layer.consultation.id;

              setList((now) =>
                now.map((one) => (one.id === id ? { ...one, cancelled: true } : one)),
              );
              setLayer(
                changeable(layer.consultation, TELL_NOW)
                  ? { kind: 'offer', id, said: 'cancelled' }
                  : { kind: 'none' },
              );
            })
          }
        >
          <p>
            {CW.cancelLine(
              dayWords(layer.consultation, LOCALE),
              timesWords(layer.consultation, LOCALE),
            )}
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}

const SAVED: Record<Said, string> = {
  booked: CW.booked,
  changed: CW.changed,
  cancelled: CW.cancelledSaid,
};

function usePanelTitle() {
  const title = useRef<HTMLHeadingElement>(null);

  useEffect(() => title.current?.focus(), []);

  return title;
}

/** Straight after a save: what was saved, and Tell {client} as the next step. Leaving keeps the save. */
function Offer({
  consultation,
  said,
  client,
  onTell,
  onDone,
}: {
  consultation: Consultation;
  said: Said;
  client: string;
  onTell: () => void;
  onDone: () => void;
}) {
  const id = useId();
  const title = usePanelTitle();

  return (
    <aside className="con-panel tc-panel" aria-labelledby={`${id}-title`}>
      <div className="con-panel-top">
        <h2 id={`${id}-title`} ref={title} tabIndex={-1} className="tc-saved">
          <span className="tc-saved-mark" aria-hidden="true">
            <Glyph name="tick" size={16} weight={2.8} />
          </span>
          {SAVED[said]}
        </h2>
        <button type="button" className="con-close" aria-label={TW.close} onClick={onDone}>
          <Glyph name="clear" size={18} weight={2.4} />
        </button>
      </div>
      <div className="con-panel-body">
        <p className={said === 'cancelled' ? 'tc-summary is-struck' : 'tc-summary'}>
          {`${dayWords(consultation, LOCALE)} · ${timesWords(consultation, LOCALE)} · ${CW.how[consultation.how]}`}
        </p>
        <p className="tc-next">{TW.offerLine[said](client)}</p>
        <div className="tc-offer-acts">
          <button type="button" className="button button-primary tc-wide" onClick={onTell}>
            {TW.tell(client)}
          </button>
          <button type="button" className="link-button tc-done" onClick={onDone}>
            {TW.done}
          </button>
        </div>
      </div>
    </aside>
  );
}

function TellPanel({
  consultation,
  said,
  start,
  onClose,
}: {
  consultation: Consultation;
  said: Said;
  start: TellStart;
  onClose: () => void;
}) {
  const id = useId();
  const title = usePanelTitle();
  const { i18n } = useTranslation();
  const [language, setLanguage] = useState<Language>(start.language ?? languageOf(i18n.language));
  const [copied, setCopied] = useState<'no' | 'yes' | 'failed'>(start.copied ? 'yes' : 'no');
  const [opened, setOpened] = useState<string | null>(null);
  const client = start.enquiry.client;
  const message = messageOf(consultation, said, client, ORG, language, TELL_NOW);
  const ways = waysOf(start.reach, start.device);

  async function copy(): Promise<void> {
    setCopied('no');
    try {
      await navigator.clipboard.writeText(message.body);
      setCopied('yes');
    } catch {
      setCopied('failed');
    }
  }

  function pick(next: Language): void {
    setLanguage(next);
    setCopied('no');
    setOpened(null);
  }

  return (
    <aside className="con-panel tc-panel" aria-labelledby={`${id}-title`}>
      <div className="con-panel-top">
        <h2 id={`${id}-title`} ref={title} tabIndex={-1}>
          {TW.tell(client)}
        </h2>
        <button type="button" className="con-close" aria-label={TW.close} onClick={onClose}>
          <Glyph name="clear" size={18} weight={2.4} />
        </button>
      </div>
      <div className="con-panel-body">
        <div className="field">
          <label htmlFor={`${id}-language`}>{TW.language}</label>
          <select
            id={`${id}-language`}
            className="input"
            value={language}
            onChange={(event) => pick(languageOf(event.target.value))}
          >
            {LANGUAGES.map((one) => (
              <option key={one} value={one} lang={one}>
                {languageName(one)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <p className="tc-label">{TW.message}</p>
          <p className="tc-preview" lang={language}>
            {message.body}
          </p>
        </div>
        <ul className="tc-ways">
          {ways.map((way) => (
            <li key={way} className="tc-way">
              <WayPill
                way={way}
                href={hrefOf(way, start.reach, message)}
                label={TW.ways[way]}
                named={TW.named[way](client)}
                onSend={setOpened}
                onCopy={() => void copy()}
              />
              {way === 'email' && <p className="tc-subject">{TW.subject(message.subject)}</p>}
              {way === 'copy' && (
                <p role="status" className="tc-copied">
                  {copied === 'yes' && (
                    <>
                      <Glyph name="tick" size={16} weight={2.8} />
                      {TW.copied}
                    </>
                  )}
                  {copied === 'failed' && (
                    <>
                      <Glyph name="warn" size={16} weight={2.4} />
                      {TW.notCopied}
                    </>
                  )}
                </p>
              )}
            </li>
          ))}
        </ul>
        {opened != null && (
          <div className="desk-note tc-opened">
            <p>{TW.wouldOpen}</p>
            <code>{opened}</code>
          </div>
        )}
      </div>
    </aside>
  );
}

/** Full width, 44 tall at desk width and 48 at phone width. The two Sends are links that leave Soirely, with sc-3627's outward mark. */
function WayPill({
  way,
  href,
  label,
  named,
  onSend,
  onCopy,
}: {
  way: Way;
  href: string | null;
  label: string;
  named: string;
  onSend: (href: string) => void;
  onCopy: () => void;
}) {
  if (way === 'copy' || href == null)
    return (
      <button type="button" className="button tc-pill" aria-label={named} onClick={onCopy}>
        <Glyph name="copy" size={17} weight={2.2} />
        {label}
      </button>
    );

  return (
    <a
      href={href}
      className="button tc-pill"
      aria-label={named}
      onClick={(event) => {
        event.preventDefault();
        onSend(href);
      }}
    >
      {label}
      <Outward />
    </a>
  );
}

/** sc-3627's outward mark, as the guest page draws it. */
function Outward() {
  return (
    <svg
      className="tc-outward"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

function FreeOrganisation() {
  return (
    <div className="desk-page con-page">
      <div className="desk-column con-column">
        <h1 className="desk-title">Events</h1>
        <p className="desk-note con-demo-only">{TW.free}</p>
      </div>
    </div>
  );
}
