import {
  type KeyboardEvent,
  type RefObject,
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
  type Audience,
  type Condition,
  type Draft,
  type Segment,
  type Ticks,
  type Token,
  CHANNELS,
  CONDITIONS,
  SCHEDULED,
  EVENT_NAME,
  GUESTS_N,
  HOSTS,
  MW,
  ORGANISATION,
  PAGE_WHEN,
  PREVIEWED,
  THEIR_LINK,
  TOKENS,
  blank,
  channelWord,
  checkOf,
  chipWords,
  dayWords,
  conditionWord,
  countOf,
  fill,
  filled,
  isNew,
  outsIn,
  many,
  refusalOf,
  tokenWord,
} from './messages.ts';
import { useInbox } from './messagesContext.ts';
import { LaterDialog } from './MessagesDialogs.tsx';
import { WhereGlyph } from './MessagesParts.tsx';
import { StreamItems } from './MessagesStream.tsx';

function commandEnter(event: KeyboardEvent, then: () => void): void {
  if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey)) return;

  event.preventDefault();
  then();
}

/** Writing to many: To and Let them know by at the head, the check or the preview in the stream, the composer at the foot. */
export function ComposePane({ opening, later: laterFirst }: { opening: boolean; later: boolean }) {
  const { inbox, act, focus, say } = useInbox();
  const draft = inbox.draft;
  const [toOpen, setToOpen] = useState(opening || draft?.openTo === true);
  const [later, setLater] = useState(laterFirst);
  const [refused, setRefused] = useState<string | null>(null);
  const chip = useRef<HTMLButtonElement>(null);
  const byId = useId();

  if (draft == null) return null;

  const current = draft;
  const following = !isNew(draft.thread) || outsIn(inbox, draft.thread).length > 0;

  function send(): void {
    if (blank(current.body)) return;

    const why = refusalOf(current.to);

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
                {chipWords(draft.to)}
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

function ToPopover({
  to,
  chip,
  onPick,
  onClose,
}: {
  to: Audience;
  chip: RefObject<HTMLButtonElement | null>;
  onPick: (to: Audience) => void;
  onClose: (back: boolean) => void;
}) {
  const { tell } = useInbox();
  const box = useRef<HTMLDivElement>(null);
  const add = useRef<HTMLButtonElement>(null);
  const [kept, setKept] = useState<readonly Condition[]>(
    to.kind === 'who' ? to.conditions : ['coming'],
  );
  const [adding, setAdding] = useState(false);
  const titleId = useId();
  const name = useId();
  const count = countOf(to);
  const who = to.kind === 'who' ? to.conditions : null;
  const left = CONDITIONS.filter((condition) => !(who ?? []).includes(condition));

  useEffect(() => {
    box.current?.querySelector<HTMLInputElement>('input:checked')?.focus();
  }, []);

  useEffect(() => {
    const keys = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      event.preventDefault();
      if (adding) {
        setAdding(false);
        add.current?.focus();
      } else onClose(true);
    };
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;

      if (!box.current?.contains(target) && !chip.current?.contains(target)) onClose(false);
    };

    document.addEventListener('keydown', keys);
    document.addEventListener('pointerdown', outside);

    return () => {
      document.removeEventListener('keydown', keys);
      document.removeEventListener('pointerdown', outside);
    };
  }, [adding, chip, onClose]);

  function conditions(next: readonly Condition[]): void {
    setKept(next);
    onPick({ kind: 'who', conditions: next });
  }

  return (
    <div ref={box} className="mg-pop mg-to-pop" role="dialog" aria-labelledby={titleId}>
      <div className="mg-pop-head">
        <h3 id={titleId} className="mg-to-title">
          {MW.to}
        </h3>
        <button
          type="button"
          className="mg-close"
          aria-label={MW.closeTo}
          onClick={() => onClose(true)}
        >
          <Glyph name="clear" size={18} weight={2.4} />
        </button>
      </div>
      <fieldset className="mg-radios">
        <legend className="desk-unseen">{MW.to}</legend>
        <label className="mg-radio-row">
          <input
            type="radio"
            name={name}
            className="desk-radio"
            data-focus="to-pick"
            checked={to.kind === 'all'}
            onChange={() => onPick({ kind: 'all' })}
          />
          <span className="today-grow">{MW.allGuests}</span>
          <span className="mg-radio-count">{GUESTS_N}</span>
        </label>
        <label className="mg-radio-row">
          <input
            type="radio"
            name={name}
            className="desk-radio"
            checked={false}
            onChange={() => tell(`${MW.chooseGuests} has its own design.`)}
          />
          <span className="today-grow">{MW.chooseGuests}</span>
        </label>
        <label className="mg-radio-row">
          <input
            type="radio"
            name={name}
            className="desk-radio"
            checked={who != null}
            onChange={() => onPick({ kind: 'who', conditions: kept })}
          />
          <span className="today-grow">{MW.guestsWho}</span>
        </label>
      </fieldset>
      {who != null && (
        <div className="mg-who-block">
          <ul className="mg-conds">
            {who.map((condition) => (
              <li key={condition} className="mg-cond">
                {conditionWord(condition)}
                <button
                  type="button"
                  aria-label={filled(MW.removeCondition, { condition: conditionWord(condition) })}
                  onClick={() => {
                    conditions(who.filter((one) => one !== condition));
                    add.current?.focus();
                  }}
                >
                  <Glyph name="clear" size={13} weight={2.6} />
                </button>
              </li>
            ))}
            {left.length > 0 && (
              <li className="mg-add-at">
                <button
                  ref={add}
                  type="button"
                  className="desk-text"
                  aria-expanded={adding}
                  onClick={() => setAdding((open) => !open)}
                >
                  <Glyph name="plus" size={17} weight={2.3} />
                  {MW.addCondition}
                </button>
                {adding && (
                  <ul className="mg-add-list">
                    {left.map((condition) => (
                      <li key={condition}>
                        <button
                          type="button"
                          onClick={() => {
                            conditions([...who, condition]);
                            setAdding(false);
                          }}
                        >
                          {conditionWord(condition)}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )}
          </ul>
          <p className="mg-pop-line">{MW.matchEvery}</p>
          <div className="mg-pop-count">
            <p role="status">
              {count == null ? '' : count === 0 ? MW.nobodyMatches : many('guests', count)}
            </p>
            {count != null && count > 0 && (
              <button
                type="button"
                className="desk-text"
                onClick={() => tell(`${MW.seeWho} has its own design.`)}
              >
                {MW.seeWho}
              </button>
            )}
          </div>
          <button
            type="button"
            className="desk-text"
            onClick={() => tell(`${MW.saveAudience} has its own design.`)}
          >
            {MW.saveAudience}
          </button>
        </div>
      )}
    </div>
  );
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

  useLayoutEffect(() => {
    box.current?.replaceChildren(...first.current.map(nodeOf));
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
}: {
  draft: Pick<Draft, 'subject' | 'body' | 'seed'>;
  tools: boolean;
  refused: string | null;
  onSend: () => void;
  onPreview: () => void;
  onDraft: (draft: Partial<Draft>) => void;
  editing?: { onChangeWhen: () => void };
}) {
  const [inserting, setInserting] = useState(false);
  const optionalId = useId();
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
    setInserting(false);
    onDraft({ body: read(field) });
    field.focus();
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
      {tools && (
        <div className="mg-tools">
          <div className="mg-insert-at">
            <button
              type="button"
              className="desk-text"
              aria-expanded={inserting}
              onClick={() => setInserting((open) => !open)}
            >
              <Glyph name="braces" size={17} weight={2.2} />
              {MW.insert}
            </button>
            {inserting && (
              <ul className="mg-pop mg-insert-list">
                {TOKENS.map((token) => (
                  <li key={token}>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => insert(token)}
                    >
                      {tokenWord(token)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button type="button" className="desk-text" onClick={onPreview}>
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
      {refused != null && (
        <p className="desk-error" role="alert" tabIndex={-1} data-focus="refused">
          <Glyph name="alert" size={15} weight={2.2} />
          {refused}
        </p>
      )}
    </form>
  );
}

function Preview({ draft }: { draft: Draft }) {
  const { mesh } = useInbox();
  const shown = CHANNELS.filter(
    (channel) => draft.ticks[channel] && PREVIEWED.has.includes(channel),
  );
  const sendsId = useId();

  return (
    <div className="mg-preview">
      <p className="mg-preview-as">
        {filled(MW.previewAs, { name: PREVIEWED.name })} · {PREVIEWED.language}
      </p>
      <div className="mg-preview-cols">
        <div className="mg-page">
          <div className={`mg-page-cover today-cover is-${mesh}`}>
            <span className="desk-piece p1" aria-hidden="true" />
            <span className="desk-piece p2" aria-hidden="true" />
            <span className="desk-piece p4" aria-hidden="true" />
            <p className="mg-page-name">{EVENT_NAME}</p>
            <p className="mg-page-when">{PAGE_WHEN}</p>
          </div>
          <figure className="mg-page-figure">
            {draft.subject.trim() !== '' && <p className="mg-page-subject">{draft.subject}</p>}
            <blockquote>{fill(draft.body, PREVIEWED.name)}</blockquote>
            <figcaption>{HOSTS}</figcaption>
          </figure>
        </div>
        {shown.length > 0 && (
          <section className="mg-sends" aria-labelledby={sendsId}>
            <h3 id={sendsId}>{MW.whatSoirelySends}</h3>
            {shown.includes('email') && (
              <div className="mg-email">
                <p className="mg-notice-head">
                  <WhereGlyph where="email" />
                  {filled(MW.emailFrom, { organisation: ORGANISATION })}
                </p>
                <p className="mg-email-subject">
                  {filled(MW.noticeSubject, { event: EVENT_NAME, hosts: HOSTS })}
                </p>
                <p>
                  {filled(MW.dear, { greeting: PREVIEWED.name })}
                  <br />
                  {filled(MW.noticeBody, { hosts: HOSTS, event: EVENT_NAME })}
                </p>
                <span className="mg-email-button">{MW.readOnPage}</span>
                <span className="mg-email-stop">
                  {filled(MW.stopEmails, { organisation: ORGANISATION })}
                </span>
              </div>
            )}
            {shown.includes('sms') && (
              <div className="mg-notice">
                <p className="mg-notice-head">
                  <WhereGlyph where="sms" />
                  {many('smsParts', 1)}
                </p>
                <p className="mg-notice-bubble">
                  {filled(MW.noticeSms, { hosts: HOSTS, event: EVENT_NAME, link: THEIR_LINK })}
                </p>
              </div>
            )}
            {shown.includes('whatsApp') && (
              <div className="mg-notice">
                <p className="mg-notice-head">
                  <WhereGlyph where="whatsApp" />
                  {MW.whatsAppTemplate}
                </p>
                <div className="mg-notice-bubble is-wa">
                  <p>{filled(MW.noticeBody, { hosts: HOSTS, event: EVENT_NAME })}</p>
                  <span>{MW.readOnPage}</span>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
      <ul className="mg-preview-lines">
        <li>{filled(MW.greetedAs, { name: PREVIEWED.name })}</li>
        <li>{filled(MW.inLanguage, { language: PREVIEWED.language })}</li>
        <li>{MW.onlyOurs}</li>
      </ul>
    </div>
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
  const { act, focus, tell } = useInbox();
  const check = checkOf(draft.to, draft.ticks);
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

const RESEND = { count: 3, unconfirmed: 2, still: 8, balance: 1500 };

/** Resend to those not reached (sc-3966): the message is already on their page, so only the notice goes again. */
export function ResendCard() {
  const { inbox, act, focus, tell } = useInbox();
  const resend = inbox.resend;
  const sentenceId = useId();

  if (resend == null) return null;

  const ticks: Ticks = resend;
  const credits = (ticks.sms ? 2 : 0) + (ticks.whatsApp ? 1 : 0);

  function back(): void {
    act({ kind: 'reached', of: 'parking', thread: 'parking' });
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
        {many('cannotUndo', RESEND.count)}
      </p>
      <p className="mg-check-line">{MW.alreadyOnPage}</p>
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
      <p className="mg-check-ink">{many('notConfirmedIncluded', RESEND.unconfirmed)}</p>
      <div className="mg-cant">
        <p className="mg-cant-head">{filled(MW.stillCant, { count: RESEND.still })}</p>
        <p>{['Joaquín Ruiz', MW.noEmail, MW.noPhone].join(' · ')}</p>
        <p>{['Sophie Laurent', MW.unsubscribed, MW.textedStop].join(' · ')}</p>
        <button
          type="button"
          className="desk-text"
          onClick={() => tell(`${filled(MW.seeAll, { count: RESEND.still })} has its own design.`)}
        >
          {filled(MW.seeAll, { count: RESEND.still })}
        </button>
      </div>
      {credits > 0 && (
        <p className="mg-credits">
          {many('textsUse', credits)} {filled(MW.creditsAfter, { count: RESEND.balance - credits })}
        </p>
      )}
      <div className="mg-check-acts">
        <button
          type="button"
          className="button button-primary mg-go"
          onClick={() => {
            act({ kind: 'resend', resend: null });
            tell(many('queued', RESEND.count));
            focus('heading');
          }}
        >
          {many('sendTo', RESEND.count)}
        </button>
        <button type="button" className="desk-text" onClick={back}>
          {MW.changeIt}
        </button>
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
