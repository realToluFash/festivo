import { type RefObject, useEffect, useId, useMemo, useRef, useState } from 'react';

import { Glyph } from '../components/Glyph.tsx';
import { type Told, MW, changeId, channelWord, many } from './messages.ts';
import { useInbox } from './messagesContext.ts';
import {
  type Figures,
  type Flow,
  FIGURES_MS,
  READY,
  byName,
  changeFor,
  figuresArrive,
  lineWords,
  pressSend,
  sentWords,
  sheetOf,
  titleOf,
} from './messagesTell.ts';
import { WhereGlyph } from './MessagesParts.tsx';
import { Dialog } from '../components/SettingsParts.tsx';
import type { Tell } from '../components/SettingsParts.tsx';

export interface Sent {
  allTold: boolean;
  note: string;
  figures: Figures;
}

/** Tell guests (sc-4330): Soirely's prepared line goes by every channel; the hosts' note goes on their page only. */
export function TellDialog({
  tell,
  changes,
  figures = null,
  flow: flowFirst = READY,
  note: noteFirst = '',
  onNotNow,
  onSent,
  before = null,
}: {
  tell: Tell;
  changes: readonly Told[];
  figures?: Figures | null;
  flow?: Flow;
  note?: string;
  onNotNow: () => void;
  onSent: (sent: Sent) => void;
  /** A change the save made beside the guests' message (sc-3780: Reply by moved with the start). */
  before?: string | null;
}) {
  const noteId = useId();
  const hintId = useId();
  const peopleId = useId();
  const [note, setNote] = useState(noteFirst);
  const [flow, setFlow] = useState(flowFirst);
  const [seeing, setSeeing] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  const send = useMemo<RefObject<HTMLElement | null>>(
    () => ({
      get current() {
        return (
          body.current?.closest('.desk-dialog')?.querySelector<HTMLElement>('.desk-nav-verb') ??
          null
        );
      },
    }),
    [],
  );
  const sheet = sheetOf(changes, figures);
  const shown = flow.figures === 'shown';
  const of = sheet.figures;
  const after = of.balance - of.credits;

  useEffect(() => {
    if (flow.figures !== 'loading') return;

    const timer = window.setTimeout(() => setFlow(figuresArrive), FIGURES_MS);

    return () => window.clearTimeout(timer);
  }, [flow.figures]);

  return (
    <Dialog
      title={shown ? titleOf(sheet.figures) : MW.tellGuests}
      verb={MW.send}
      dismiss={MW.notNow}
      {...(flowFirst === READY ? {} : { first: send })}
      onDismiss={onNotNow}
      onConfirm={() => {
        const pressed = pressSend(flow);

        setFlow(pressed.flow);
        if (pressed.result === 'none') return;
        tell(pressed.result === 'allTold' ? MW.allTold : sentWords(sheet.figures));
        onSent({ allTold: pressed.result === 'allTold', note, figures: sheet.figures });
      }}
    >
      <div ref={body} className="mg-tell">
        {sheet.who != null && <p className="mg-tell-who">{sheet.who}</p>}
        <div className="mg-tell-figures" aria-busy={!shown}>
          <p className="mg-tell-label">{MW.sentBy}</p>
          {shown ? (
            <ul className="mg-pills">
              {of.pills.map((pill) => (
                <li key={pill.channel}>
                  <WhereGlyph where={pill.channel} size={15} />
                  {channelWord(pill.channel)} · {pill.count}
                </li>
              ))}
            </ul>
          ) : (
            <span className="mg-tell-shapes">
              <span className="skeleton-bar mg-tell-shape" />
              <span className="skeleton-bar mg-tell-shape" />
              <span className="skeleton-bar mg-tell-shape" />
            </span>
          )}
        </div>
        {!shown ? (
          <span className="skeleton-bar mg-tell-shape is-line" aria-hidden="true" />
        ) : (
          of.unreachable.length > 0 && (
            <div>
              <p className="mg-info">
                <Glyph name="info" size={15} weight={2.1} />
                {many('cannotBeReached', of.unreachable.length)}
              </p>
              <button
                type="button"
                className="desk-text"
                aria-expanded={seeing}
                aria-controls={peopleId}
                onClick={() => setSeeing((now) => !now)}
              >
                {MW.seeWho}
              </button>
              <ul id={peopleId} className="mg-tell-people" hidden={!seeing}>
                {byName(of.unreachable).map((person) => (
                  <li key={person.name}>
                    <span className="mg-tell-name">{person.name}</span>
                    <span className="mg-tell-hint">{person.why.join(' · ')}</span>
                  </li>
                ))}
              </ul>
            </div>
          )
        )}
        {before != null && <p className="mg-tell-who">{before}</p>}
        <div className="mg-tell-part">
          <p className="mg-tell-label">{MW.message}</p>
          {sheet.parts == null ? (
            <TellBox lines={sheet.lines} />
          ) : (
            sheet.parts.map((part) => (
              <div key={part.heading} className="mg-tell-change">
                <p className="mg-tell-head">{part.heading}</p>
                <TellBox lines={part.lines} />
                <p className="mg-tell-hint">{part.who}</p>
              </div>
            ))
          )}
          {sheet.hints.map((hint) => (
            <p key={hint} className="mg-tell-hint">
              {hint}
            </p>
          ))}
        </div>
        <div className="mg-tell-part">
          <label htmlFor={noteId} className="mg-tell-label">
            {MW.noteForGuests}
            <span className="mg-optional">{MW.optional}</span>
          </label>
          <textarea
            id={noteId}
            className="mg-tell-note"
            rows={1}
            value={note}
            aria-describedby={hintId}
            onChange={(event) => setNote(event.target.value)}
          />
          <p id={hintId} className="mg-tell-hint">
            {MW.noteHint}
          </p>
        </div>
        <div className="mg-tell-cost" aria-busy={!shown}>
          {!shown ? (
            <span className="skeleton-bar mg-tell-shape is-line" />
          ) : (
            of.credits > 0 && (
              <p className="mg-tell-credits">
                {many('textsAndWhatsAppUse', of.credits)}
                <br />
                {many('balanceAfter', after)}
              </p>
            )
          )}
          {shown && of.held != null && <p className="mg-tell-hint">{many('held', of.held)}</p>}
          {shown && of.quiet != null && (
            <p className="mg-tell-hint">{many('quiet', of.quiet.count, { time: of.quiet.time })}</p>
          )}
          {flow.line === 'early' && (
            <p key={flow.presses} className="mg-tell-hint" role="status">
              {lineWords(flow.line)}
            </p>
          )}
          {flow.line != null && flow.line !== 'early' && (
            <p key={flow.presses} className="mg-tell-hint is-wrong" role="alert">
              <Glyph name="alert" size={15} weight={2.2} />
              {lineWords(flow.line)}
            </p>
          )}
        </div>
      </div>
    </Dialog>
  );
}

/** Guests have not been told yet: on the event's Overview under the cover, and at the head of Messages' list. */
export function UntoldCard({
  items,
  onTell,
  onDismiss,
}: {
  items: readonly Told[];
  onTell: () => void;
  onDismiss: () => void;
}) {
  const titleId = useId();

  return (
    <section className="mg-untold" aria-labelledby={titleId}>
      <h2 id={titleId} className="mg-untold-title">
        <Glyph name="alert" size={16} weight={2.2} />
        {MW.notTold}
      </h2>
      <ul className="mg-untold-list">
        {items.map((change) => (
          <li key={change.item}>{change.item}</li>
        ))}
      </ul>
      <div className="mg-acts">
        <button type="button" className="desk-text" onClick={onTell}>
          {MW.tellThem}
        </button>
        <button type="button" className="desk-text is-quiet" onClick={onDismiss}>
          {MW.dismiss}
        </button>
      </div>
    </section>
  );
}

export function UntoldBanner() {
  const { act, focus, tell, inbox } = useInbox();
  const [telling, setTelling] = useState(false);

  return (
    <>
      <UntoldCard
        items={inbox.untold}
        onTell={() => setTelling(true)}
        onDismiss={() => {
          act({ kind: 'untold', untold: [] });
          tell(MW.dismissed);
          focus('title');
        }}
      />
      {telling && (
        <TellDialog
          tell={tell}
          changes={inbox.untold}
          onNotNow={() => setTelling(false)}
          onSent={(sent) => {
            setTelling(false);
            act({
              kind: 'tellSent',
              untold: [],
              out: sent.allTold
                ? null
                : changeFor(inbox.untold, sent.figures, sent.note, changeId(inbox)),
            });
            focus('title');
          }}
        />
      )}
    </>
  );
}

function TellBox({ lines }: { lines: readonly string[] }) {
  return (
    <p className="mg-tell-box">
      {lines.map((line, index) => (
        <span key={line}>
          {index > 0 && <br />}
          {line}
        </span>
      ))}
    </p>
  );
}
