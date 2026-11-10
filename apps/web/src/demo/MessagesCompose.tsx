import {
  type KeyboardEvent,
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { offButton } from '../offButton.ts';
import { Glyph } from '../components/Glyph.tsx';
import {
  type Draft,
  type Segment,
  type Token,
  CHANNELS,
  SCHEDULED,
  MW,
  blank,
  channelWord,
  checkOf,
  chipWords,
  countOf,
  dayWords,
  filled,
  isNew,
  outsIn,
  many,
  reachedOfThread,
  refusalOf,
  resendOf,
  tokenWord,
} from './messages.ts';
import { useInbox } from './messagesContext.ts';
import { LaterDialog } from './MessagesDialogs.tsx';
import { InsertMenu } from './MessagesInsert.tsx';
import { WhereGlyph } from './MessagesParts.tsx';
import { Preview } from './MessagesPreview.tsx';
import { PW } from './messagesPreviewWords.ts';
import { StreamItems } from './MessagesStream.tsx';
import { ToPopover } from './MessagesTo.tsx';
import { WaitBlock } from './MessagesWaits.tsx';
import { waitsCheckOf, waitsOf } from './messagesWaits.ts';

function commandEnter(event: KeyboardEvent, then: () => void): void {
  if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey)) return;

  event.preventDefault();
  then();
}

/** Writing to many: To and Let them know by at the head, the check or the preview in the stream, the composer at the foot. */
export function ComposePane({ opening, later: laterFirst }: { opening: boolean; later: boolean }) {
  const { inbox, act, focus, say, to: event } = useInbox();
  const draft = inbox.draft;
  const [toOpen, setToOpen] = useState(opening || draft?.openTo === true);
  const [later, setLater] = useState(laterFirst);
  const [refused, setRefused] = useState(() => event.refused(draft?.to));
  const { viewed } = event;
  const chip = useRef<HTMLButtonElement>(null);
  const byId = useId();

  useEffect(() => viewed(), [viewed]);

  if (draft == null) return null;

  const current = draft;
  const following = !isNew(draft.thread) || outsIn(inbox, draft.thread).length > 0;

  function send(): void {
    if (blank(current.body)) return;

    const why = refusalOf(current.to, event.book.groups);

    if (why != null) {
      setRefused(why);
      focus('refused');
      return;
    }
    setRefused(null);
    act({ kind: 'draft', draft: { step: 'check' } });
    focus('check');
  }

  function edit(): void {
    act({ kind: 'draft', draft: { step: 'write' } });
    focus('body');
  }

  return (
    <div className="mg-in is-compose">
      <h2 className="desk-unseen">{MW.newMessage}</h2>
      {draft.step !== 'preview' && (
        <header className="mg-to-head">
          <div className="mg-to-row">
            <span className="mg-to-label">{MW.to}</span>
            <div className="mg-to-at">
              <button
                ref={chip}
                type="button"
                className="mg-to-chip"
                aria-haspopup="dialog"
                aria-expanded={toOpen}
                data-focus="to-chip"
                onClick={() => setToOpen((open) => !open)}
              >
                {chipWords(draft.to, event.book)}
                <Glyph name="chevdown" size={14} weight={2.6} />
              </button>
              {toOpen && (
                <ToPopover
                  to={draft.to}
                  chip={chip}
                  onPick={(to) => {
                    act({ kind: 'draft', draft: { to } });
                    setRefused(null);
                  }}
                  onClose={(back) => {
                    setToOpen(false);
                    if (back) focus('to-chip');
                  }}
                />
              )}
            </div>
          </div>
          <div className="mg-by-row" role="group" aria-labelledby={byId}>
            <span id={byId} className="mg-by-label">
              {MW.letThemKnowBy}
            </span>
            <div className="mg-ticks">
              {CHANNELS.map((channel) => (
                <TickChip
                  key={channel}
                  word={channelWord(channel)}
                  on={draft.ticks[channel]}
                  onToggle={() =>
                    act({
                      kind: 'draft',
                      draft: { ticks: { ...draft.ticks, [channel]: !draft.ticks[channel] } },
                    })
                  }
                />
              ))}
            </div>
          </div>
        </header>
      )}
      {draft.step !== 'preview' && following ? (
        <ol className="mg-stream" role="log" aria-label={MW.writeFollowUp}>
          <StreamItems thread={draft.thread} />
          {draft.step === 'check' && (
            <li className="mg-said is-host">
              <CheckCard draft={draft} onChange={edit} onLater={() => setLater(true)} />
            </li>
          )}
          {draft.step === 'write' && inbox.cancelled && (
            <li className="mg-status" role="status">
              <Glyph name="info" size={15} weight={2.2} />
              <p>{MW.cancelled}</p>
            </li>
          )}
        </ol>
      ) : (
        <div className={draft.step === 'preview' ? 'mg-compose-body is-top' : 'mg-compose-body'}>
          {draft.step === 'preview' ? (
            <Preview draft={draft} />
          ) : draft.step === 'check' ? (
            <CheckCard draft={draft} onChange={edit} onLater={() => setLater(true)} />
          ) : inbox.cancelled ? (
            <p className="mg-status" role="status">
              <Glyph name="info" size={15} weight={2.2} />
              {MW.cancelled}
            </p>
          ) : null}
        </div>
      )}
      {draft.step === 'preview' ? (
        <div className="mg-preview-bar">
          <button type="button" className="desk-text" data-focus="preview-edit" onClick={edit}>
            <Glyph name="pen" size={17} weight={2.2} />
            {MW.edit}
          </button>
          <button type="button" className="desk-text" aria-pressed="true" onClick={edit}>
            <Glyph name="eye" size={17} weight={2.2} />
            {MW.previewOn}
          </button>
          <span className="today-grow" />
          <button type="button" className="mg-send" aria-label={MW.send} onClick={send}>
            <Glyph name="send" size={20} weight={2.4} />
          </button>
        </div>
      ) : (
        <Composer
          draft={draft}
          tools={draft.step === 'write'}
          refused={refused}
          previewOff={(countOf(draft.to, event.book.groups) ?? 0) === 0 ? PW.nobodyToPreview : null}
          onDraft={(next) => act({ kind: 'draft', draft: next })}
          onSend={send}
          onPreview={() => {
            act({ kind: 'draft', draft: { step: 'preview' } });
            focus('preview-edit');
          }}
        />
      )}
      {later && (
        <LaterDialog
          day={SCHEDULED.day}
          time={SCHEDULED.time}
          onCancel={() => {
            setLater(false);
            focus('later');
          }}
          onNow={() => {
            setLater(false);
            focus('go');
          }}
          onSchedule={(day, time) => {
            setLater(false);
            act({ kind: 'schedule', day, time });
            say(filled(MW.scheduledSaid, { date: dayWords(day), time }));
            focus('heading');
          }}
        />
      )}
    </div>
  );
}

export function TickChip({
  word,
  on,
  onToggle,
}: {
  word: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      className={on ? 'mg-tick is-on' : 'mg-tick'}
      onClick={onToggle}
    >
      {on && <Glyph name="tick" size={15} weight={2.8} />}
      {word}
    </button>
  );
}

function caretToEnd(node: HTMLElement): void {
  const range = document.createRange();
  const selection = window.getSelection();

  range.selectNodeContents(node);
  range.collapse(false);
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function nodeOf(part: Segment): Node {
  if (part.kind === 'text') return document.createTextNode(part.text);

  const word = tokenWord(part.token);
  const chip = document.createElement('span');

  chip.className = 'mg-token';
  chip.contentEditable = 'false';
  chip.dataset.token = part.token;
  chip.setAttribute('role', 'img');
  chip.setAttribute('aria-label', filled(MW.tokenName, { token: word }));
  chip.textContent = word;

  return chip;
}

function read(node: Node): Segment[] {
  const parts: Segment[] = [];

  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE)
      parts.push({ kind: 'text', text: child.textContent ?? '' });
    else if (child instanceof HTMLElement && child.dataset.token != null)
      parts.push({ kind: 'token', token: child.dataset.token as Token });
    else if (child instanceof HTMLBRElement) parts.push({ kind: 'text', text: '\n' });
    else if (child instanceof HTMLElement) {
      if (child.tagName === 'DIV' && parts.length > 0) parts.push({ kind: 'text', text: '\n' });
      parts.push(...read(child));
    }
  });

  return parts.reduce<Segment[]>((joined, part) => {
    const last = joined.at(-1);

    if (part.kind === 'text' && last?.kind === 'text')
      return [...joined.slice(0, -1), { kind: 'text', text: last.text + part.text }];

    return [...joined, part];
  }, []);
}

function MessageField({
  body,
  seed,
  editable,
  onChange,
  onSubmit,
}: {
  body: readonly Segment[];
  seed: number;
  editable: boolean;
  onChange: (body: Segment[]) => void;
  onSubmit: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const first = useRef(body);
  const toEnd = useRef(false);

  useLayoutEffect(() => {
    box.current?.replaceChildren(...first.current.map(nodeOf));
    toEnd.current = (box.current?.childNodes.length ?? 0) > 0;
  }, [seed]);

  useEffect(() => {
    first.current = body;
  }, [body]);

  return (
    <div
      ref={box}
      className="mg-field"
      contentEditable={editable ? 'true' : 'false'}
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label={MW.message}
      aria-readonly={!editable}
      data-placeholder={MW.writeToGuests}
      data-focus="body"
      tabIndex={0}
      onFocus={() => {
        const field = box.current;

        if (!toEnd.current || field == null) return;
        toEnd.current = false;
        queueMicrotask(() => caretToEnd(field));
      }}
      onInput={() => {
        const now = box.current == null ? [] : read(box.current);

        if (blank(now) && box.current != null && box.current.childNodes.length > 0)
          box.current.replaceChildren();
        onChange(now);
      }}
      onKeyDown={(event) => commandEnter(event, onSubmit)}
    />
  );
}

export function Composer({
  draft,
  tools,
  refused,
  onSend,
  onPreview,
  onDraft,
  editing,
  previewOff = null,
}: {
  draft: Pick<Draft, 'subject' | 'body' | 'seed' | 'opens'>;
  tools: boolean;
  refused: string | null;
  onSend: () => void;
  onPreview: () => void;
  onDraft: (draft: Partial<Draft>) => void;
  editing?: { onChangeWhen: () => void };
  previewOff?: string | null;
}) {
  const optionalId = useId();
  const refusedId = useId();
  const offId = useId();
  const empty = blank(draft.body);

  function insert(token: Token): void {
    const field = document.querySelector<HTMLElement>('.mg-field');
    const chip = nodeOf({ kind: 'token', token });
    const at = window.getSelection();
    const range = at != null && at.rangeCount > 0 ? at.getRangeAt(0) : null;

    if (field == null) return;
    if (range != null && field.contains(range.startContainer)) {
      range.deleteContents();
      range.insertNode(chip);
      range.setStartAfter(chip);
    } else field.append(chip);
    onDraft({ body: read(field) });
    field.focus();

    const after = document.createRange();

    after.setStartAfter(chip);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(after);
  }

  return (
    <form
      className={tools ? 'mg-composer' : 'mg-composer is-held'}
      onSubmit={(event) => {
        event.preventDefault();
        onSend();
      }}
    >
      <div className="mg-subject-row">
        <input
          className="mg-subject"
          value={draft.subject}
          aria-label={MW.subject}
          aria-describedby={optionalId}
          readOnly={!tools}
          data-focus="subject"
          onChange={(event) => onDraft({ subject: event.target.value })}
          onKeyDown={(event) => commandEnter(event, onSend)}
        />
        <span className={draft.subject === '' ? 'mg-subject-hint' : 'desk-unseen'} aria-hidden>
          {draft.subject === '' && MW.subject}
          <span id={optionalId} className="mg-optional">
            {MW.optional}
          </span>
        </span>
      </div>
      <MessageField
        body={draft.body}
        seed={draft.seed}
        editable={tools}
        onChange={(body) => onDraft({ body })}
        onSubmit={onSend}
      />
      {refused != null && (
        <p id={refusedId} className="desk-error" role="alert" tabIndex={-1} data-focus="refused">
          <Glyph name="alert" size={15} weight={2.2} />
          {refused}
        </p>
      )}
      {tools && (
        <div className="mg-tools">
          <InsertMenu
            first={draft.opens === 'insert'}
            onFirst={() => onDraft({ opens: undefined })}
            onPick={insert}
          />
          <button
            type="button"
            className="desk-text mg-preview-tool"
            data-focus="preview"
            aria-describedby={previewOff == null ? undefined : offId}
            {...offButton(previewOff != null)}
            onClick={onPreview}
          >
            <Glyph name="eye" size={17} weight={2.2} />
            {MW.preview}
          </button>
          {editing == null ? (
            <>
              <span className="mg-goes-page">{MW.goesOnTheirPage}</span>
              <button
                type="submit"
                className={empty ? 'mg-send is-off' : 'mg-send'}
                aria-label={MW.send}
                aria-keyshortcuts="Meta+Enter Control+Enter"
                aria-describedby={refused == null ? undefined : refusedId}
                data-focus="send"
                {...offButton(empty, { dim: false })}
              >
                <Glyph name="send" size={20} weight={2.4} />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="desk-text mg-change-when"
                onClick={editing.onChangeWhen}
              >
                <Glyph name="clock" size={17} weight={2.2} />
                {MW.changeWhen}
              </button>
              <button type="submit" className="button button-primary mg-save" data-focus="save">
                {MW.save}
              </button>
            </>
          )}
        </div>
      )}
      {tools && previewOff != null && (
        <p id={offId} className="mg-why">
          <Glyph name="info" size={16} weight={2.2} />
          <span>{previewOff}</span>
        </p>
      )}
    </form>
  );
}

/** The check, a card in the conversation (sc-3942): Escape and Change it give the words back. */
export function CheckCard({
  draft,
  onChange,
  onLater,
}: {
  draft: Draft;
  onChange: () => void;
  onLater: () => void;
}) {
  const { inbox, act, focus, tell, to } = useInbox();
  const counted = checkOf(draft.to, draft.ticks, to.book.groups);
  const check = inbox.balance === 0 ? waitsCheckOf(counted, draft.to, draft.ticks) : counted;
  const waits = inbox.balance === 0 ? waitsOf(check, draft.ticks) : null;
  const sentenceId = useId();

  return (
    <div
      className="mg-check"
      role="alertdialog"
      aria-label={MW.checkName}
      aria-describedby={sentenceId}
    >
      <OnEscape
        then={() => {
          act({ kind: 'draft', draft: { step: 'write' } });
          focus('send');
        }}
      />
      <p id={sentenceId} className="mg-check-sentence" tabIndex={-1} data-focus="check">
        {many('cannotUndo', check.count)}
      </p>
      <p className="mg-check-line">
        {[MW.goesOnPage, check.told].filter((line) => line != null).join(' ')}
      </p>
      <div className="mg-ticks" role="group" aria-label={MW.letThemKnowBy}>
        {CHANNELS.map((channel) => (
          <TickChip
            key={channel}
            word={channelWord(channel)}
            on={draft.ticks[channel]}
            onToggle={() =>
              act({
                kind: 'draft',
                draft: { ticks: { ...draft.ticks, [channel]: !draft.ticks[channel] } },
              })
            }
          />
        ))}
      </div>
      {check.pills.length > 0 && (
        <ul className="mg-pills">
          {check.pills.map((pill) => (
            <li key={pill.channel}>
              <WhereGlyph where={pill.channel} size={15} />
              {channelWord(pill.channel)} · {pill.count}
            </li>
          ))}
        </ul>
      )}
      {check.smsOff != null && <p className="mg-cant-head">{check.smsOff}</p>}
      {check.cantTell > 0 && (
        <div className="mg-cant">
          <p className="mg-cant-head">{filled(MW.cantBeTold, { count: check.cantTell })}</p>
          {check.cant.map((one) => (
            <p key={one.name}>{[one.name, ...one.why].join(' · ')}</p>
          ))}
          {check.cantTell > check.cant.length && (
            <button
              type="button"
              className="desk-text"
              onClick={() =>
                tell(`${filled(MW.seeAll, { count: check.cantTell })} has its own design.`)
              }
            >
              {filled(MW.seeAll, { count: check.cantTell })}
            </button>
          )}
        </div>
      )}
      {check.credits != null && <p className="mg-credits">{check.credits}</p>}
      {waits != null && <WaitBlock waits={waits} />}
      <div className="mg-check-acts">
        <button
          type="button"
          className="button button-primary mg-go"
          data-focus="go"
          onClick={() => {
            act({ kind: 'go' });
            focus('cancel');
          }}
        >
          {many('sendTo', check.count)}
        </button>
        <button type="button" className="desk-text" data-focus="later" onClick={onLater}>
          {MW.later}
        </button>
        <button
          type="button"
          className="desk-text"
          onClick={() => {
            onChange();
            focus('send');
          }}
        >
          {MW.changeIt}
        </button>
      </div>
    </div>
  );
}

/** Resend to those not reached (sc-3966): the message is already on their page, so only the notice goes again. */
export function ResendCard() {
  const { inbox, act, focus, tell, to } = useInbox();
  const resend = inbox.resend;
  const sentenceId = useId();

  if (resend == null) return null;

  const { thread, ticks } = resend;
  const check = resendOf(inbox, thread, ticks, to.book.groups);
  const none = check.count === 0;

  function back(): void {
    act({ kind: 'reached', of: reachedOfThread(thread), thread });
    focus('resend');
  }

  return (
    <div
      className="mg-check"
      role="alertdialog"
      aria-label={MW.checkName}
      aria-describedby={sentenceId}
    >
      <OnEscape then={back} />
      <p id={sentenceId} className="mg-check-sentence" tabIndex={-1} data-focus="check">
        {none ? many('noneTellable', check.waiting) : many('cannotUndo', check.count)}
      </p>
      <p className="mg-check-line">{none ? MW.addFirst : MW.alreadyOnPage}</p>
      {!none && (
        <div className="mg-ticks">
          {CHANNELS.map((channel) => (
            <TickChip
              key={channel}
              word={channelWord(channel)}
              on={ticks[channel]}
              onToggle={() =>
                act({
                  kind: 'resend',
                  resend: { ...ticks, [channel]: !ticks[channel] },
                })
              }
            />
          ))}
        </div>
      )}
      {!none && check.unconfirmed > 0 && (
        <p className="mg-check-ink">{many('notConfirmedIncluded', check.unconfirmed)}</p>
      )}
      {check.still > 0 && (
        <div className="mg-cant">
          <p className="mg-cant-head">{filled(MW.stillCant, { count: check.still })}</p>
          {check.cant.map((line) => (
            <p key={line}>{line}</p>
          ))}
          {check.still > check.cant.length && (
            <button
              type="button"
              className="desk-text"
              onClick={() =>
                tell(`${filled(MW.seeAll, { count: check.still })} has its own design.`)
              }
            >
              {filled(MW.seeAll, { count: check.still })}
            </button>
          )}
        </div>
      )}
      {!none && check.credits > 0 && (
        <p className="mg-credits">
          {many('textsUse', check.credits)}{' '}
          {filled(MW.creditsAfter, { count: inbox.balance - check.credits })}
        </p>
      )}
      <div className="mg-check-acts">
        {none ? (
          <button type="button" className="desk-text" onClick={back}>
            {MW.backToWho}
          </button>
        ) : (
          <>
            <button
              type="button"
              className="button button-primary mg-go"
              onClick={() => {
                act({ kind: 'resend', resend: null });
                tell(many('queued', check.count));
                focus('heading');
              }}
            >
              {many('sendTo', check.count)}
            </button>
            <button type="button" className="desk-text" onClick={back}>
              {MW.changeIt}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function OnEscape({ then }: { then: () => void }) {
  const escape = useEffectEvent(then);

  useEffect(() => {
    const keys = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (document.querySelector('.mg-to-pop, .mg-bell-pop, .desk-ask') != null) return;

      event.preventDefault();
      escape();
    };

    document.addEventListener('keydown', keys);

    return () => document.removeEventListener('keydown', keys);
  }, []);

  return null;
}
