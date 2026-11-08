import {
  type Dispatch,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useId,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { useSearchParams } from 'react-router';

import { EventsShell } from './EventParts.tsx';
import { EventSidebar } from './EventSidebar.tsx';
import type { SampleEvent } from './events.ts';
import { Glyph } from '../components/Glyph.tsx';
import { focusWhenFree, LayersContext } from '../layers.ts';
import {
  type Change,
  type ConvoId,
  type Inbox,
  type MessagesState,
  type Row,
  type Tag as RowTag,
  GUESTS,
  MESSAGES_AT,
  MW,
  NOW,
  changed,
  closedOf,
  freshId,
  isNew,
  outReach,
  outsIn,
  draftOf,
  filled,
  isGuest,
  keepInbox,
  keptInbox,
  many,
  rowsInOrder,
  sectionsOf,
  seedOf,
  setSingleKeys,
  singleKeys,
  waitingLine,
  litOf,
} from './messages.ts';
import { ConversationPane } from './MessagesThread.tsx';
import { InboxContext, type InboxApi } from './messagesContext.ts';
import { LeadMark, WhyNot } from './MessagesParts.tsx';
import { UntoldBanner } from './MessagesTell.tsx';
import { MESSAGES_WORD } from './messagesWords.ts';
import { offButton } from '../offButton.ts';
import { Tag } from '../components/SettingsParts.tsx';
import type { Tell } from '../components/SettingsParts.tsx';
import './messages.css';

const ARRIVES_MS = 1200;
const WASH_MS = 2000;
const SENDING_MS = 3000;
const TOLD_MS = 900;

/** Where each ?state= puts the focus when it opens. */
function firstFocus(state: MessagesState | null): string | null {
  switch (state) {
    case 'channelReply':
    case 'matched':
      return 'answer';
    case 'notMatched':
      return 'choose';
    case 'scheduledEdit':
    case 'followUp':
      return state === 'followUp' ? 'follow' : 'body';
    case 'sendNow':
    case 'checkAll':
    case 'checkNotReplied':
    case 'checkChannels':
      return 'check';
    case 'cancelAsk':
      return 'keep';
    case 'fixed':
      return 'again';
    case 'invitedReached':
    case 'sentReached':
    case 'sentAgain':
      return 'heading';
    case 'write':
    case 'cancelled':
      return 'body';
    case 'check':
      return 'check';
    case 'countdown':
      return 'cancel';
    case 'failed':
      return 'try';
    case 'resend':
      return 'check';
    case 'to':
      return 'to-pick';
    default:
      return null;
  }
}

/** Messages at a desk in B · Conversations: the event's sidebar, the list and the open conversation. */
export function MessagesPage({
  event,
  state,
  now,
}: {
  event: SampleEvent;
  state: MessagesState | null;
  now: Date;
}) {
  const [params] = useSearchParams();
  const [inbox, act] = useReducer(changed, null, () => {
    const start = state != null ? seedOf(state) : keptInbox();
    const asked = params.get('c') as ConvoId | null;

    return asked != null && start.present.includes(asked)
      ? changed(start, { kind: 'open', id: asked })
      : start;
  });

  useEffect(() => keepInbox(inbox), [inbox]);

  return (
    <EventsShell
      renderSide={(tell, covered) => (
        <EventSidebar
          event={event}
          area="messages"
          now={now}
          tell={tell}
          inert={covered}
          waiting={waitingLine(inbox)}
        />
      )}
    >
      {(tell) => <Messages inbox={inbox} act={act} tell={tell} state={state} mesh={event.mesh} />}
    </EventsShell>
  );
}

function inField(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

function Messages({
  inbox,
  act,
  tell,
  state,
  mesh,
}: {
  inbox: Inbox;
  act: Dispatch<Change>;
  tell: Tell;
  state: MessagesState | null;
  mesh: SampleEvent['mesh'];
}) {
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const pending = useRef<string | null>(firstFocus(state));
  const closed = closedOf(state);
  const whyId = useId();
  const [said, setSaid] = useState('');
  const [keys, setKeys] = useState(singleKeys);
  const [keysSaid, setKeysSaid] = useState('');
  const [bellRead, setBellRead] = useState(false);
  const bellFirst = useRef(state === 'bell');
  const takeFirst = useCallback(() => {
    const first = bellFirst.current;

    bellFirst.current = false;
    return first;
  }, []);
  const { stack } = useContext(LayersContext);
  const titleId = useId();
  const sections = useMemo(() => sectionsOf(inbox), [inbox]);
  const lit = litOf(inbox);

  const say = useCallback((words: string) => {
    window.setTimeout(() => setSaid(''), 0);
    window.setTimeout(() => setSaid(words), 60);
  }, []);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const focus = useCallback((key: string) => {
    pending.current = key;
    rerender();
  }, []);

  useEffect(() => {
    const key = pending.current;

    if (key == null) return;
    pending.current = null;
    focusWhenFree(() => root.current?.querySelector<HTMLElement>(`[data-focus="${key}"]`) ?? null);
  });

  const counting = inbox.outs.find((out) => out.stage === 'countdown');
  const sending = inbox.outs.some((out) => out.stage === 'sending');

  const onTick = useEffectEvent(() => {
    if (counting != null && counting.left <= 1) focus('follow');
    act({ kind: 'tick' });
  });

  useEffect(() => {
    if (counting == null) return;

    const timer = window.setInterval(() => onTick(), 1000);

    return () => window.clearInterval(timer);
  }, [counting]);

  useEffect(() => {
    if (!sending) return;

    const timer = window.setTimeout(
      () => act({ kind: 'stage', from: 'sending', to: 'sent' }),
      SENDING_MS,
    );

    return () => window.clearTimeout(timer);
  }, [sending, act]);

  const arriving = state === 'replyArrived' && !inbox.present.includes('lucia');

  useEffect(() => {
    if (!arriving) return;

    const timer = window.setTimeout(() => {
      act({ kind: 'arrive', id: 'lucia' });
      tell(filled(MW.arrived, { name: GUESTS.lucia.name }));
    }, ARRIVES_MS);

    return () => window.clearTimeout(timer);
  }, [arriving, act, tell]);

  useEffect(() => {
    if (inbox.arrived == null) return;

    const timer = window.setTimeout(() => act({ kind: 'settle' }), WASH_MS);

    return () => window.clearTimeout(timer);
  }, [inbox.arrived, act]);

  const sendingAnswer = Object.entries(inbox.answers).find(([, answers]) =>
    answers.some((answer) => answer.stage === 'sending'),
  )?.[0];

  useEffect(() => {
    if (sendingAnswer == null || !isGuest(sendingAnswer as ConvoId)) return;

    const timer = window.setTimeout(
      () => act({ kind: 'told', id: sendingAnswer as 'ines' }),
      TOLD_MS,
    );

    return () => window.clearTimeout(timer);
  }, [sendingAnswer, act]);

  function openRow(id: ConvoId, toHeading: boolean): void {
    const drafting = isNew(id) && outsIn(inbox, id).length === 0;

    if (drafting) {
      if (inbox.draft != null) act({ kind: 'compose', draft: inbox.draft });
    } else act({ kind: 'open', id });
    if (toHeading) focus(drafting ? 'subject' : 'heading');
  }

  function markDone(id: ConvoId): void {
    const needs: ConvoId[] = sections.needs.map((row) => row.id).filter((one) => isGuest(one));
    const at = needs.indexOf(id);
    const rest = needs.filter((one) => one !== id);
    const next = rest[at] ?? rest[at - 1] ?? null;

    act({ kind: 'done', id, at: NOW });
    say(MW.doneSaid);
    focus(next == null ? 'title' : `row:${next}`);
  }

  function startNew(): void {
    if (closed != null) return;
    if (inbox.pane.kind !== 'compose')
      act({
        kind: 'compose',
        draft: draftOf({ kind: 'all' }, 'write', false, freshId(inbox)),
      });
    focus('subject');
  }

  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (stack.length > 0 || event.defaultPrevented) return;

    const command = event.metaKey || event.ctrlKey;

    if (command && event.key.toLowerCase() === 'z') {
      if (counting != null) {
        event.preventDefault();
        act({ kind: 'cancel' });
        focus('body');
      }
      return;
    }
    if (command || event.altKey || !keys || inField(event.target)) return;
    if (document.querySelector('.mg-pop') != null) return;

    const key = event.key.toLowerCase();
    const inList = list.current?.contains(document.activeElement) === true;
    const inMessages = root.current?.contains(document.activeElement) === true;

    if ((key === 'j' || key === 'k') && inList) {
      event.preventDefault();
      const rows = rowsInOrder(sections);
      const here = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>(
        '[data-row]',
      )?.dataset.row;
      const at = rows.findIndex((row) => row.id === here);
      const next = at < 0 ? rows[0] : rows[key === 'j' ? at + 1 : at - 1];

      if (next == null) return;
      openRow(next.id, false);
      focus(`row:${next.id}`);
    } else if (key === 'e' && (inList || inMessages) && lit != null) {
      if (!isGuest(lit) && lit !== 'unknown') return;
      event.preventDefault();
      if (inbox.done.includes(lit)) act({ kind: 'waiting', id: lit });
      else markDone(lit);
    } else if (key === 'r' && inbox.pane.kind === 'convo' && isGuest(inbox.pane.id)) {
      event.preventDefault();
      focus('answer');
    } else if (key === 'c') {
      event.preventDefault();
      startNew();
    }
  });

  useEffect(() => {
    const listen = (event: KeyboardEvent) => onKey(event);

    document.addEventListener('keydown', listen);

    return () => document.removeEventListener('keydown', listen);
  }, []);

  function turn(on: boolean): void {
    setSingleKeys(on);
    setKeys(on);
    setKeysSaid(on ? '' : MW.keysOff);
    focus(on ? 'keys-off' : 'keys-on');
  }

  const api: InboxApi = {
    inbox,
    act,
    tell,
    say,
    focus,
    mesh,
    keys,
    bell: { read: bellRead, markRead: () => setBellRead(true), takeFirst },
  };
  const empty = inbox.present.length === 0 && sections.top.length === 0;

  return (
    <InboxContext value={api}>
      <div ref={root} className="mg">
        <section className="mg-list" aria-labelledby={titleId}>
          <div className="mg-list-top">
            <h1 id={titleId} className="mg-title" tabIndex={-1} data-focus="title">
              {MESSAGES_WORD}
            </h1>
            <button
              type="button"
              className="mg-new"
              aria-keyshortcuts={keys && closed == null ? 'C' : undefined}
              aria-describedby={closed == null ? undefined : whyId}
              onClick={startNew}
              {...offButton(closed != null)}
            >
              <Glyph name="plus" size={18} weight={2.4} />
              {MW.new}
            </button>
          </div>
          {closed != null && <WhyNot id={whyId} words={closed} />}
          <div ref={list} className="mg-list-body">
            {inbox.loading ? (
              <Loading />
            ) : empty ? (
              <div className="mg-empty">
                <h2>{MW.noneYet}</h2>
                <p>{MW.noneLine}</p>
              </div>
            ) : (
              <>
                {inbox.untold.length > 0 && <UntoldBanner />}
                {sections.top.length > 0 && <Rows rows={sections.top} lit={lit} onOpen={openRow} />}
                <Section name={MW.needsYou} rows={sections.needs} lit={lit} onOpen={openRow} />
                <Section name={MW.scheduled} rows={sections.scheduled} lit={lit} onOpen={openRow} />
                <Section
                  name={MW.done}
                  rows={sections.done}
                  lit={lit}
                  onOpen={openRow}
                  counted={false}
                />
              </>
            )}
          </div>
          <div className="mg-keys">
            {keys ? (
              <>
                <p className="mg-keys-list" aria-hidden="true">
                  <span>
                    <kbd>J</kbd>
                    <kbd>K</kbd>
                    {MW.move}
                  </span>
                  <span>
                    <kbd>E</kbd>
                    {MW.markAsDone}
                  </span>
                  <span>
                    <kbd>R</kbd>
                    {MW.reply}
                  </span>
                  <span>
                    <kbd>C</kbd>
                    {MW.new}
                  </span>
                </p>
                <button
                  type="button"
                  className="desk-text mg-keys-turn"
                  aria-label={MW.turnOffName}
                  data-focus="keys-off"
                  onClick={() => turn(false)}
                >
                  {MW.turnOff}
                </button>
              </>
            ) : (
              <>
                <p className="mg-keys-list">{MW.keysOff}</p>
                <button
                  type="button"
                  className="desk-text mg-keys-turn"
                  aria-label={MW.turnOnName}
                  data-focus="keys-on"
                  onClick={() => turn(true)}
                >
                  {MW.turnOn}
                </button>
              </>
            )}
            <p className="desk-unseen" role="status">
              {keysSaid}
            </p>
          </div>
        </section>
        <ConversationPane state={state} onDone={markDone} />
        <p className="desk-unseen" role="status">
          {said}
        </p>
        <p className="desk-unseen" role="status">
          {sendingSaid(inbox)}
        </p>
      </div>
    </InboxContext>
  );
}

/** What the ten seconds and the send say, once each (WCAG 2.2 SC 4.1.3): 10, 5, then queued, then the result. */
function sendingSaid(inbox: Inbox): string {
  const out = inbox.outs.find((one) => one.stage === 'countdown') ?? inbox.outs.at(-1);

  if (out == null) return '';

  const reach = outReach(out);

  switch (out.stage) {
    case 'countdown':
      return filled(MW.sendingIn, { count: out.left > 5 ? 10 : 5 });
    case 'sending':
      return many('queued', reach.count);
    case 'sent':
      return filled(MW.reached, { count: reach.reached, total: reach.count });
    default:
      return '';
  }
}

function Loading() {
  return (
    <div className="mg-loading" role="status">
      <p>{MW.loading}</p>
      <ul aria-hidden="true">
        {[1, 2, 3, 4, 5, 6].map((one) => (
          <li key={one} className={`mg-bones b${one}`}>
            <span className="mg-bone-face" />
            <span className="mg-bone-words">
              <span className="mg-bone-title" />
              <span className="mg-bone-line" />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Section({
  name,
  rows,
  lit,
  onOpen,
  counted = true,
}: {
  name: string;
  rows: readonly Row[];
  lit: ConvoId | null;
  onOpen: (id: ConvoId, toHeading: boolean) => void;
  counted?: boolean;
}) {
  if (rows.length === 0) return null;

  return (
    <div className="mg-section">
      <h2 className="mg-section-head">
        {name}
        {counted && <span className="mg-section-count"> · {rows.length}</span>}
      </h2>
      <Rows rows={rows} lit={lit} onOpen={onOpen} />
    </div>
  );
}

function RowTagMark({ tag }: { tag: RowTag }) {
  return tag.kind !== 'notyet' ? (
    <Tag kind={tag.kind} word={tag.word} />
  ) : (
    <span className="desk-tag mg-tag">
      <span className="mg-tag-ring" aria-hidden="true" />
      {tag.word}
    </span>
  );
}

function Rows({
  rows,
  lit,
  onOpen,
}: {
  rows: readonly Row[];
  lit: ConvoId | null;
  onOpen: (id: ConvoId, toHeading: boolean) => void;
}) {
  return (
    <ul className="mg-rows">
      {rows.map((row) => {
        const on = row.id === lit;
        const name = [row.title, row.line, row.when, row.tag?.word]
          .filter((part) => part != null && part !== '')
          .join(', ');

        return (
          <li key={row.id}>
            <a
              href={`${MESSAGES_AT}?c=${row.id}`}
              className={['mg-row', on && 'is-on', row.arrived && 'is-arrived']
                .filter(Boolean)
                .join(' ')}
              aria-label={name}
              aria-current={on ? 'true' : undefined}
              data-row={row.id}
              data-focus={`row:${row.id}`}
              onClick={(event) => {
                event.preventDefault();
                onOpen(row.id, true);
              }}
            >
              <LeadMark lead={row.lead} />
              <span className="desk-row-words">
                <span className="desk-row-title">
                  <span className="desk-row-name">{row.title}</span>
                  {row.tag != null && <RowTagMark tag={row.tag} />}
                </span>
                <span className="desk-row-line">{row.line}</span>
              </span>
              {row.when !== '' && <span className="mg-when">{row.when}</span>}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
