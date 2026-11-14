import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { useDialogKeys } from '../dialogFocus.ts';
import { offButton } from '../offButton.ts';
import {
  NOW,
  PW,
  type PassState,
  type PassTicket,
  type Printed,
  ROLLS,
  type Roll,
  TICKETS,
  type Which,
  allFor,
  allergyPlates,
  choicesOf,
  forMain,
  laidOut,
  notPrintedYet,
  passStateOf,
  printN,
  printedLine,
  sentToPrint,
  startOf,
  stillToMake,
} from './pass.ts';
import './pass.css';

const AREAS = ['Overview', 'Service', 'Guests', 'Menu', 'Seating', 'Messages', 'Schedule', 'Staff'];

interface Dialogue {
  tables: readonly string[];
  what: string;
}

/** /demo/pass (sc-4018): the pass's print controls at 1280 × 800, Printing in version B, by ?state=. */
export function PassPage() {
  const [params] = useSearchParams();
  const state = passStateOf(params.get('state'));

  return <Pass key={state} state={state} />;
}

function Pass({ state }: { state: PassState }) {
  const [start] = useState(() => startOf(state));
  const [printed, setPrinted] = useState<Printed>(start.printed);
  const [panel, setPanel] = useState(start.panel);
  const [which, setWhich] = useState<Which>('unprinted');
  const [roll, setRoll] = useState<Roll>('80');
  const [dialogue, setDialogue] = useState<Dialogue | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const tickets = start.noTickets ? [] : TICKETS;
  const choices = choicesOf(tickets, printed, which);
  const stale = start.connection === 'none';
  const canPrintAll = tickets.length > 0;

  function open(next: 'tickets' | 'printing', from: HTMLElement): void {
    opener.current = from;
    setPanel(next);
  }

  function closePanel(): void {
    setPanel(null);
    opener.current?.focus();
  }

  return (
    <div className="pass-desk">
      <nav className="pass-side" aria-label="Event">
        <span className="pass-brand">Soirely</span>
        <Link className="pass-side-link" to="/demo">
          ‹ All states in the demo
        </Link>
        <div className="pass-event">
          <span className="pass-happening">{PW.happening}</span>
          <strong>{PW.event}</strong>
          <span className="pass-meta">{PW.eventLine}</span>
        </div>
        <ul className="pass-areas">
          {AREAS.map((area) => (
            <li
              key={area}
              className="pass-area"
              aria-current={area === 'Service' ? 'page' : undefined}
            >
              {area}
            </li>
          ))}
        </ul>
      </nav>
      <main id="content" className="pass-main">
        <header className="pass-header">
          <h1>{PW.title}</h1>
          <div className="pass-grow" />
          <div className="pass-tabs">
            {PW.tabs.map((tab, index) => (
              <span key={tab} className="pass-tab" data-on={index === 0 || undefined}>
                {tab}
                <span className="pass-meta">{index === 1 ? 0 : tickets.length}</span>
              </span>
            ))}
          </div>
          <button
            className="button"
            type="button"
            aria-haspopup="dialog"
            onClick={(event) => open('printing', event.currentTarget)}
          >
            {PW.printing}
          </button>
          <button
            className="button pass-print-all"
            type="button"
            aria-haspopup="dialog"
            {...offButton(!canPrintAll, { dim: false })}
            aria-describedby={canPrintAll ? undefined : 'pass-none-in-course'}
            onClick={(event) => open('tickets', event.currentTarget)}
          >
            <PrinterGlyph />
            <span>{PW.printTickets}</span>
            {!canPrintAll && (
              <span id="pass-none-in-course" className="pass-why">
                {PW.noneInCourse}
              </span>
            )}
          </button>
        </header>
        <div className="pass-strip" data-connection={start.connection} role="status">
          <span className="pass-strip-dot" aria-hidden="true" />
          <strong>{stale ? PW.noConnection : PW.connected}</strong>
        </div>
        <div className="pass-body">
          <section className="pass-tickets" aria-labelledby="pass-tickets-heading">
            <h2 id="pass-tickets-heading">{PW.ticketsHeading}</h2>
            <div className="pass-grid">
              {tickets.length === 0 && (
                <div className="pass-empty">
                  <strong>{PW.emptyTitle}</strong>
                  <span>{PW.emptyBody}</span>
                  <NewWords />
                </div>
              )}
              {tickets.map((ticket) => (
                <TicketCard
                  key={ticket.table}
                  ticket={ticket}
                  printedAt={printed[ticket.table]}
                  stale={stale}
                  onPrint={(from) => {
                    opener.current = from;
                    setDialogue({
                      tables: [ticket.table],
                      what: `Table ${ticket.table.slice(1)} · 1 ticket`,
                    });
                  }}
                />
              ))}
            </div>
          </section>
          <aside className="pass-aside">
            <section className="pass-card pass-totals" aria-labelledby="pass-totals-heading">
              <h2 id="pass-totals-heading" className="pass-label">
                {PW.stillToMake}
              </h2>
              {stillToMake(tickets).map((row) => (
                <div key={row.dish} className="pass-total">
                  <span className="pass-dot" data-tone={row.tone} aria-hidden="true" />
                  <span className="pass-grow">{row.dish}</span>
                  <strong>{row.count}</strong>
                </div>
              ))}
              <strong className="pass-total-allergy">
                {allergyPlates(tickets.reduce((sum, t) => sum + t.allergies.length, 0))}
              </strong>
            </section>
            <p className="pass-demo-note">{PW.demoNote}</p>
          </aside>
        </div>
      </main>
      {panel === 'tickets' && (
        <SidePanel title={PW.printTickets} onClose={closePanel}>
          <fieldset className="pass-fieldset">
            <legend>{PW.which}</legend>
            <Choice
              name="which"
              checked={choices.which === 'unprinted'}
              off={choices.noneLeft}
              title={choices.noneLeft ? PW.noneLeft : notPrintedYet(choices.unprinted.length)}
              onChoose={() => setWhich('unprinted')}
            />
            <Choice
              name="which"
              checked={choices.which === 'all'}
              off={false}
              title={allFor(tickets.length)}
              onChoose={() => setWhich('all')}
            />
          </fieldset>
          {stale && (
            <div className="pass-stale-note">
              <span className="pass-ring" aria-hidden="true" />
              <div>
                <p>{PW.staleNote}</p>
                <NewWords />
              </div>
            </div>
          )}
          <p className="pass-meta">{PW.dialogueLine(ROLLS[roll])}</p>
          <NewWords />
          <div className="pass-panel-foot">
            <button className="link-button" type="button" onClick={closePanel}>
              {PW.cancel}
            </button>
            <button
              className="button button-primary"
              type="button"
              onClick={() => {
                setPanel(null);
                setDialogue({
                  tables: choices.chosen.map((ticket) => ticket.table),
                  what: forMain(choices.chosen.length),
                });
              }}
            >
              {printN(choices.chosen.length)}
            </button>
          </div>
        </SidePanel>
      )}
      {panel === 'printing' && (
        <SidePanel title={PW.printing} onClose={closePanel}>
          <p className="pass-meta">{PW.deviceLine}</p>
          <NewWords />
          <fieldset className="pass-fieldset">
            <legend>{PW.paperRoll}</legend>
            <div className="pass-rolls">
              {(['80', '58'] as const).map((each) => (
                <label key={each} className="pass-roll" data-on={roll === each || undefined}>
                  <input
                    type="radio"
                    name="roll"
                    checked={roll === each}
                    onChange={() => setRoll(each)}
                  />
                  {ROLLS[each]}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="pass-ipad-line">
            <InfoGlyph />
            <div>
              <strong>{PW.whenFired}</strong>
              <p>{PW.needsIpad}</p>
              <NewWords />
            </div>
          </div>
        </SidePanel>
      )}
      {dialogue != null && (
        <PrintDialogue
          what={dialogue.what}
          paper={laidOut(ROLLS[roll], stale)}
          onClose={() => {
            setPrinted((was) => sentToPrint(was, dialogue.tables, NOW));
            setDialogue(null);
            opener.current?.focus();
          }}
        />
      )}
    </div>
  );
}

function TicketCard({
  ticket,
  printedAt,
  stale,
  onPrint,
}: {
  ticket: PassTicket;
  printedAt: string | undefined;
  stale: boolean;
  onPrint: (from: HTMLElement) => void;
}) {
  const late = ticket.wait >= 10;

  return (
    <article
      className="pass-ticket"
      data-late={late || undefined}
      aria-label={`Table ${ticket.table.slice(1)}, Main`}
    >
      <div className="pass-ticket-head">
        <span className="pass-table">{ticket.table}</span>
        <span className="pass-covers">Main · {ticket.covers} covers</span>
        <span className="pass-grow" />
        <span className="pass-wait">
          <span className="pass-dot" data-late={late || undefined} aria-hidden="true" />
          {late ? `Late · ${ticket.wait} min` : `${ticket.wait} min`}
        </span>
      </div>
      {ticket.allergies.length > 0 && (
        <div className="pass-allergy">
          <span className="pass-allergy-mark" aria-hidden="true">
            !
          </span>
          <div>
            <strong className="pass-allergy-word">{PW.allergy}</strong>
            {ticket.allergies.map((line) => (
              <span key={line} className="pass-allergy-line">
                {line}
              </span>
            ))}
          </div>
        </div>
      )}
      <ul className="pass-lines">
        {ticket.lines.map((line, index) => (
          <li key={`${line.dish}.${index}`}>
            <span className="pass-dot" data-tone={line.tone} aria-hidden="true" />
            <strong>{line.count} ×</strong>
            <span className="pass-grow">{line.dish}</span>
            {line.flag != null && (
              <span className="pass-flag" data-preference={line.preference ?? undefined}>
                <span aria-hidden="true">{line.preference ? '·' : '!'}</span>
                {line.flag}
              </span>
            )}
          </li>
        ))}
      </ul>
      {ticket.preference != null && (
        <div className="pass-preference">
          <span className="pass-preference-tag">{PW.preference}</span>
          <span>{ticket.preference}</span>
        </div>
      )}
      {printedAt != null && (
        <div className="pass-printed">
          <PrinterGlyph />
          <span>{printedLine(printedAt)}</span>
        </div>
      )}
      <div className="pass-actions">
        <button className="button button-primary pass-up" type="button">
          {PW.platesUp}
        </button>
        <button
          className="button pass-print"
          type="button"
          aria-label={`Print table ${ticket.table.slice(1)}’s ticket`}
          onClick={(event) => onPrint(event.currentTarget)}
        >
          <PrinterGlyph />
          <span>{PW.print}</span>
        </button>
        {stale && <span className="pass-as-of">{PW.asOf}</span>}
      </div>
    </article>
  );
}

function Choice({
  name,
  checked,
  off,
  title,
  onChoose,
}: {
  name: string;
  checked: boolean;
  off: boolean;
  title: string;
  onChoose: () => void;
}) {
  return (
    <label className="pass-choice" data-on={checked || undefined} data-off={off || undefined}>
      <input type="radio" name={name} checked={checked} disabled={off} onChange={onChoose} />
      <span>{title}</span>
    </label>
  );
}

function SidePanel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useDialogKeys(panel, onClose, false);
  useEffect(() => panel.current?.focus(), []);

  return (
    <>
      <button
        className="dialog-scrim pass-scrim"
        type="button"
        tabIndex={-1}
        aria-label={PW.close}
        onClick={onClose}
      />
      <div
        ref={panel}
        className="pass-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pass-panel-title"
        tabIndex={-1}
      >
        <div className="pass-panel-head">
          <h2 id="pass-panel-title">{title}</h2>
          <button className="pass-close" type="button" aria-label={PW.close} onClick={onClose}>
            <svg
              aria-hidden="true"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              className="pass-glyph"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
        <div className="pass-panel-body">{children}</div>
      </div>
    </>
  );
}

function PrintDialogue({
  what,
  paper,
  onClose,
}: {
  what: string;
  paper: string;
  onClose: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  useDialogKeys(box, onClose, false);
  useEffect(() => box.current?.focus(), []);

  return (
    <>
      <div className="dialog-scrim pass-scrim-light" aria-hidden="true" />
      <div
        ref={box}
        className="pass-stand-in"
        role="dialog"
        aria-modal="true"
        aria-label={PW.dialogueCaption}
        tabIndex={-1}
      >
        <p className="pass-stand-in-caption">{PW.dialogueCaption}</p>
        <div className="pass-stand-in-body">
          <strong>{what}</strong>
          <span className="pass-meta">{paper}</span>
        </div>
        <div className="pass-stand-in-actions">
          <button className="button" type="button" onClick={onClose}>
            {PW.cancel}
          </button>
          <button className="button" type="button" onClick={onClose}>
            {PW.print}
          </button>
        </div>
      </div>
    </>
  );
}

function NewWords() {
  return <span className="pass-new-words">{PW.newWords}</span>;
}

function PrinterGlyph() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" className="pass-glyph">
      <path d="M6 9V2h12v7" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <path d="M6 14h12v8H6z" />
    </svg>
  );
}

function InfoGlyph() {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" className="pass-glyph">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}
