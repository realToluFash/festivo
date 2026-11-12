import { formattingLocale } from '@soirely/domain';
import {
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
import { Link, useNavigate, useSearchParams } from 'react-router';

import { EventsShell } from './EventParts.tsx';
import { EventSidebar } from './EventSidebar.tsx';
import { type SampleEvent, TODAY_IDS, sampleEvent } from './events.ts';
import { TodaySidebar } from './TodaySidebar.tsx';
import { Glyph } from '../components/Glyph.tsx';
import { AddForm, EditForm, RecordForm } from './GuestForms.tsx';
import { type GuestActions, GuestView } from './GuestColumn.tsx';
import { AgreeForm } from './GuestWhatsApp.tsx';
import {
  CHOICES,
  LINK,
  type Choice,
  type Guest,
  type GuestsStart,
  type Invite,
  type ListRow,
  type Pane,
  type Reply,
  type ViewInAddress,
  addGuest,
  agreeToWhatsApp,
  choiceWord,
  countsOf,
  guestsAt,
  guestsCardOf,
  guestsStart,
  guestsStateOf,
  markInvited,
  markNotInvited,
  recordReply,
  reopen,
  replaceLink,
  replyByOf,
  saveGuest,
  todayOf,
  viewBase,
  viewOf,
} from './guests.ts';
import { pageKey, useGuestsAddress } from './useGuestsAddress.ts';
import { GuestBones, GuestsCardView, ListBones, MarkLead } from './GuestsParts.tsx';
import {
  EMEKA,
  type TheirState,
  erasedIn,
  erasedLine,
  theirStart,
  theirStateOf,
  theirViewerKey,
} from './guestRequest.ts';
import { zoneFor } from './dataControl.ts';
import { SIDEBAR_EVENTS, type Viewer, viewerOf } from './settings.ts';
import { TheirData } from './TheirData.tsx';
import { GW, REPLY_WORDS, figure } from './guestsWords.ts';
import { LayersContext, focusWhenFree } from '../layers.ts';
import {
  MESSAGES_AT,
  NOT_REPLIED,
  changed,
  draftOf,
  freshId,
  keepInbox,
  keptInbox,
} from './messages.ts';
import {
  Ask,
  Chevron,
  Menu,
  RowWords,
  TextAction,
  type Tell,
} from '../components/SettingsParts.tsx';
import { DemoBell } from './DemoBell.tsx';
import { useSwitcherStart } from './switcher.ts';
import { useLeaveAsk } from './useLeaveAsk.ts';
import './guests.css';

const FOCUSABLE = 'button, a[href], input, textarea, select, [tabindex]';

/** Where each state puts the focus as it opens: the field a form starts on, or what it asks about. */
function firstFocus(start: GuestsStart): string[] {
  const pane = start.pane;

  if (pane.kind === 'edit') {
    if (pane.start.conflict === true) return ['conflict'];
    if (pane.start.duplicate === true) return ['duplicate'];
    return [pane.start.at ?? 'name'];
  }
  if (pane.kind === 'record')
    return pane.start.replace === true ? ['replace-heading'] : ['answer-coming'];
  if (pane.kind === 'add')
    return pane.start.duplicate === true ? ['duplicate'] : [pane.start.at ?? 'name'];
  if (pane.kind === 'whatsApp') return ['agree-0'];
  if (pane.kind === 'guest' && pane.invite === 'copied') return ['copy'];
  if (pane.kind === 'guest' && start.list.some((one) => one.replaced != null)) return ['replace'];

  return [];
}

/** Guests at a desk in A · Summary first (Guests-A-Web, page e30): the event's sidebar with Guests lit, the card, the list at 520 and the guest at 380 beside it. */
export function Guests() {
  const [params] = useSearchParams();
  useSwitcherStart();

  return <GuestsAt key={pageKey(params)} params={params} />;
}

function GuestsAt({ params }: { params: URLSearchParams }) {
  const [their] = useState(() => {
    const state = theirStateOf(params.get('data'));

    return { state, viewer: viewerOf(theirViewerKey(state, params.get('as'))) };
  });
  const [start] = useState(() => {
    const opened = guestsStart(guestsStateOf(params.get('state')), params);

    return their.state === 'erased' ? { ...opened, list: erasedIn(opened.list, EMEKA.id) } : opened;
  });
  const event = params.get('state') === 'eventDeleted' ? null : sampleEvent(start.event);

  if (event == null) return <EventGone id={start.event} />;

  return (
    <EventsShell
      told={start.told}
      renderSide={(tell, covered) => (
        <EventSidebar event={event} area="guests" now={start.clock} tell={tell} inert={covered} />
      )}
    >
      {(tell) => (
        <GuestsPage
          event={event}
          start={start}
          base={viewBase(guestsStateOf(params.get('state')))}
          their={their}
          tell={tell}
        />
      )}
    </EventsShell>
  );
}

/** sc-1468: a deleted event's Guests answers as an event that never existed does (sc-64), under the organisation's sidebar without it. */
function EventGone({ id }: { id: string }) {
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => heading.current?.focus(), []);

  return (
    <EventsShell
      renderSide={(tell, covered) => (
        <TodaySidebar
          events={SIDEBAR_EVENTS.filter(
            (key) => TODAY_IDS[key] !== id && sampleEvent(TODAY_IDS[key]) != null,
          )}
          tell={tell}
          listing
          inert={covered}
        />
      )}
    >
      {() => (
        <div className="gs">
          <header className="gs-top">
            <h1 ref={heading} className="gs-title" tabIndex={-1}>
              {GW.eventGone}
            </h1>
          </header>
        </div>
      )}
    </EventsShell>
  );
}

type Leaving = { then: 'back' } | { then: 'open'; id: string } | { then: 'add' } | null;

function GuestsPage({
  event,
  start,
  base,
  their,
  tell,
}: {
  event: SampleEvent;
  start: GuestsStart;
  base: ViewInAddress;
  their: { state: TheirState; viewer: Viewer };
  tell: Tell;
}) {
  const locale = useMemo(() => formattingLocale('en', navigator.language), []);
  const [erase, setErase] = useState<'erasing' | 'erased' | null>(
    their.state === 'erasing' || their.state === 'erased' ? their.state : null,
  );
  const navigate = useNavigate();
  const root = useRef<HTMLDivElement>(null);
  const column = useRef<HTMLElement>(null);
  const pending = useRef<string[]>(firstFocus(start));
  const [, rerender] = useReducer((count: number) => count + 1, 0);
  const [list, setList] = useState<Guest[]>(start.list);
  const [status, setStatus] = useState(start.status);
  const { choice, q, setChoice, setQ, clear } = useGuestsAddress(base);
  const [menu, setMenu] = useState(start.menu);
  const [expanded, setExpanded] = useState<ReadonlySet<Reply>>(new Set());
  const [pane, setPane] = useState<Pane>(start.pane);
  const [asking, setAsking] = useState(start.asking);
  const [dirty, setDirty] = useState(false);
  const [leaving, setLeaving] = useState<Leaving>(
    start.pane.kind === 'edit' && start.pane.start.discard === true ? { then: 'back' } : null,
  );
  const lastRow = useRef<string | null>(start.pane.kind === 'guest' ? start.pane.id : null);
  const away = useLeaveAsk(dirty);
  const { stack } = useContext(LayersContext);
  const manages = start.role === 'owner';
  const today = todayOf(start.clock);
  const counts = countsOf(list);
  const card = guestsCardOf(event, list, start.card, start.clock, manages);
  const { view, shown } = viewOf(list, choice, q, expanded, replyByOf(event.id), manages);
  const looking = choice !== 'all' || q.trim() !== '';
  const open = pane.kind === 'guest' ? pane.id : null;
  const paneGuest = 'id' in pane ? (list.find((one) => one.id === pane.id) ?? null) : null;

  const focus = useCallback((...keys: string[]) => {
    pending.current = keys;
    rerender();
  }, []);

  useEffect(() => {
    const keys = pending.current;

    if (keys.length === 0) return;
    pending.current = [];
    focusWhenFree(() => {
      for (const key of keys) {
        const at = root.current?.querySelector<HTMLElement>(`[data-focus="${key}"]`);

        if (at == null) continue;

        return at.matches(FOCUSABLE) ? at : at.querySelector<HTMLElement>(FOCUSABLE);
      }

      return null;
    });
  });

  function go(next: Leaving & object): void {
    setDirty(false);
    if (next.then === 'open') openGuest(next.id, true);
    else if (next.then === 'add') startAdd(true);
    else back();
  }

  function guarded(next: Leaving & object): void {
    if (dirty && (pane.kind === 'edit' || pane.kind === 'record')) setLeaving(next);
    else go(next);
  }

  function openGuest(id: string, sure = false): void {
    if (!sure) return guarded({ then: 'open', id });
    lastRow.current = id;
    setPane({ kind: 'guest', id });
    focus('guest-heading');
  }

  function close(): void {
    setPane({ kind: 'none' });
    focus(`row:${lastRow.current ?? ''}`, 'title');
  }

  /** Cancel, Done, Keep their reply: back to where the form opened from. */
  function back(): void {
    if (pane.kind === 'edit') {
      setPane({ kind: 'guest', id: pane.id });
      focus('edit');
    } else if (pane.kind === 'record') {
      setPane({ kind: 'guest', id: pane.id });
      focus('record', 'step');
    } else if (pane.kind === 'whatsApp') {
      setPane({ kind: 'guest', id: pane.id });
      focus('whatsapp-agree');
    } else if (pane.kind === 'add') {
      setPane(lastRow.current == null ? { kind: 'none' } : { kind: 'guest', id: lastRow.current });
      focus('add', 'title');
    } else close();
  }

  function startAdd(sure = false): void {
    if (!sure) return guarded({ then: 'add' });
    setPane({ kind: 'add', start: {} });
    focus('name');
  }

  function invite(id: string, next: Invite | null): void {
    setPane(next == null ? { kind: 'guest', id } : { kind: 'guest', id, invite: next });
    if (next == null) focus('guest-heading');
  }

  const actions = (id: string): GuestActions => ({
    onRecord: () => {
      setPane({ kind: 'record', id, start: {} });
      focus('answer-coming');
    },
    onEdit: () => {
      setPane({ kind: 'edit', id, start: {} });
      focus('name');
    },
    onReopen: () => {
      setList((was) => reopen(was, id, today));
      focus('step');
    },
    onCopy: () => {
      const refused = () => invite(id, 'refused');

      if (navigator.clipboard == null) refused();
      else void navigator.clipboard.writeText(LINK).then(() => invite(id, 'copied'), refused);
    },
    onReplace: () => setAsking('replace'),
    onInvite: (next) => invite(id, next),
    onMark: (how) => {
      setList((was) => markInvited(was, id, how, today));
      invite(id, null);
    },
    onUnmark: () => {
      setList((was) => markNotInvited(was, id));
      setPane({ kind: 'guest', id, note: 'unmarked' });
      focus('guest-heading');
    },
    onAgree: () => {
      setPane({ kind: 'whatsApp', id, start: {} });
      focus('agree-0');
    },
  });

  function writeToThem(): void {
    const inbox = keptInbox();

    keepInbox(
      changed(inbox, {
        kind: 'compose',
        draft: draftOf(NOT_REPLIED, 'write', false, freshId(inbox)),
      }),
    );
    void navigate(MESSAGES_AT);
  }

  function onStep(): void {
    if (card.step === 'add') startAdd();
    else if (card.step === 'write') writeToThem();
    else tell('Make live has its own design.');
  }

  const onEscape = useEffectEvent((event: KeyboardEvent) => {
    if (event.key !== 'Escape' || stack.length > 0 || event.defaultPrevented) return;
    if (pane.kind === 'none') return;
    event.preventDefault();
    if (
      pane.kind === 'edit' ||
      pane.kind === 'record' ||
      pane.kind === 'add' ||
      pane.kind === 'whatsApp'
    )
      guarded({ then: 'back' });
    else close();
  });

  useEffect(() => {
    const at = column.current;
    const listen = (event: KeyboardEvent) => onEscape(event);

    at?.addEventListener('keydown', listen);

    return () => at?.removeEventListener('keydown', listen);
  });

  const plus = manages && status === 'ready' && list.length > 0;
  const columns = list.length > 0 || pane.kind === 'add';
  const stepWord =
    card.step === 'add'
      ? GW.addGuest
      : card.step === 'write'
        ? GW.writeToThem
        : card.step === 'makeLive'
          ? GW.makeLive
          : null;

  return (
    <div ref={root} className="desk-page ev-page gs">
      <div className="ev-wide gs-page">
        <div className="ev-crumb-row">
          <nav className="ev-crumb" aria-label={GW.crumb}>
            <ol>
              <li className="ev-crumb-part">
                <Link to="/demo/events">{GW.events}</Link>
              </li>
              <li className="ev-crumb-part">
                <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
                <Link className="ev-crumb-name" to={`/demo/events/${event.id}`}>
                  {event.name}
                </Link>
              </li>
              <li className="ev-crumb-part" aria-current="page">
                <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
                <span className="ev-crumb-name">{GW.title}</span>
              </li>
            </ol>
          </nav>
          <DemoBell tell={tell} />
        </div>
        <header className="gs-top">
          <h1 className="gs-title" tabIndex={-1} data-focus="title">
            {GW.title}
          </h1>
          {plus && (
            <button type="button" className="ev-new" data-focus="add" onClick={() => startAdd()}>
              <Glyph name="plus" size={18} weight={2.4} />
              {GW.addGuest}
            </button>
          )}
        </header>
        {status === 'loading' ? (
          <ListBones />
        ) : status === 'failed' ? (
          <div className="desk-failed gs-failed" role="alert">
            <h2>{GW.loadFailed}</h2>
            <p className="desk-line">{GW.loadFailedLine}</p>
            <TextAction label={GW.retry} onClick={() => setStatus('ready')} />
          </div>
        ) : (
          <>
            <GuestsCardView card={card} mesh={event.mesh} step={stepWord} onStep={onStep} />
            {columns && (
              <div className="gs-cols">
                <section className="gs-list" aria-label={GW.title}>
                  {list.length > 0 && (
                    <>
                      <SearchRow
                        q={q}
                        choice={choice}
                        counts={counts}
                        menu={menu}
                        onQ={setQ}
                        onChoice={setChoice}
                        onMenu={setMenu}
                      />
                      {looking && (
                        <div className="gs-shown">
                          <p role="status">{GW.shown(shown, counts.all)}</p>
                          <TextAction label={GW.clear} onClick={clear} />
                        </div>
                      )}
                      {shown === 0 ? (
                        <div className="gs-none" role="status">
                          <h2>{GW.noMatch}</h2>
                          <p className="desk-line">{GW.noMatchLine}</p>
                          <TextAction
                            label={GW.clear}
                            onClick={() => {
                              clear();
                              focus('find');
                            }}
                          />
                        </div>
                      ) : view.kind === 'rows' ? (
                        <Rows rows={view.rows} open={open} event={event.id} onOpen={openGuest} />
                      ) : (
                        view.groups.map((group) => (
                          <Group
                            key={group.reply}
                            reply={group.reply}
                            count={group.count}
                            rows={group.rows}
                            collapsed={group.collapsed}
                            open={open}
                            event={event.id}
                            onOpen={openGuest}
                            onAll={() => {
                              setExpanded((was) => new Set([...was, group.reply]));
                              focus(`row:${group.next ?? ''}`);
                            }}
                          />
                        ))
                      )}
                    </>
                  )}
                </section>
                <section
                  ref={column}
                  className="gs-column"
                  aria-label={paneGuest?.name ?? GW.title}
                >
                  {pane.kind === 'none' && shown > 0 && event.status !== 'draft' && (
                    <p className="gs-pick">{GW.pick}</p>
                  )}
                  {pane.kind === 'loading' && <GuestBones />}
                  {pane.kind === 'notFound' && (
                    <div className="gs-gone" role="alert">
                      <h2 tabIndex={-1} data-focus="guest-heading">
                        {GW.notFound}
                      </h2>
                      <p className="desk-line">{GW.notFoundLine}</p>
                      <button type="button" className="gs-pill is-secondary" onClick={close}>
                        {GW.backToGuests}
                      </button>
                    </div>
                  )}
                  {pane.kind === 'guest' && paneGuest != null && (
                    <GuestView
                      key={paneGuest.id}
                      guest={paneGuest}
                      event={event}
                      clock={start.clock}
                      manages={manages}
                      note={pane.note}
                      invite={pane.invite}
                      actions={actions(paneGuest.id)}
                      erase={paneGuest.id === EMEKA.id ? erase : null}
                      erasedLine={erasedLine(locale, zoneFor(their.viewer))}
                      theirData={
                        paneGuest.id === EMEKA.id &&
                        manages &&
                        their.viewer.manages &&
                        erase !== 'erased' && (
                          <TheirData
                            start={theirStart(their.state)}
                            locale={locale}
                            zone={zoneFor(their.viewer)}
                            level={3}
                            onErasing={() => setErase('erasing')}
                            onErased={() => {
                              setErase('erased');
                              setList((was) => erasedIn(was, EMEKA.id));
                            }}
                          />
                        )
                      }
                    />
                  )}
                  {pane.kind === 'edit' && paneGuest != null && (
                    <EditForm
                      key={paneGuest.id}
                      guest={paneGuest}
                      list={list}
                      start={pane.start}
                      focus={focus}
                      onDirty={setDirty}
                      onCancel={() => guarded({ then: 'back' })}
                      onSave={(values) => {
                        setList((was) => saveGuest(was, paneGuest.id, values));
                        setDirty(false);
                        setPane({ kind: 'guest', id: paneGuest.id });
                        tell(GW.saved);
                        focus('edit');
                      }}
                    />
                  )}
                  {pane.kind === 'record' && paneGuest != null && (
                    <RecordForm
                      key={paneGuest.id}
                      guest={paneGuest}
                      start={pane.start}
                      focus={focus}
                      onDirty={setDirty}
                      onCancel={() => guarded({ then: 'back' })}
                      onSave={(answer, how, ticked) => {
                        setList((was) =>
                          recordReply(was, paneGuest.id, answer, how, ticked, today),
                        );
                        setDirty(false);
                        setPane({ kind: 'guest', id: paneGuest.id, note: 'recorded' });
                        focus('guest-heading');
                      }}
                    />
                  )}
                  {pane.kind === 'whatsApp' && paneGuest != null && (
                    <AgreeForm
                      key={paneGuest.id}
                      guest={paneGuest}
                      start={pane.start}
                      focus={focus}
                      onCancel={back}
                      onSave={(how) => {
                        setList((was) => agreeToWhatsApp(was, paneGuest.id, how, today));
                        setPane({ kind: 'guest', id: paneGuest.id });
                        tell(GW.saved);
                        focus('whatsapp');
                      }}
                    />
                  )}
                  {pane.kind === 'add' && (
                    <AddForm
                      list={list}
                      start={pane.start}
                      focus={focus}
                      onDone={back}
                      onAdd={(values) => setList((was) => addGuest(was, values, today))}
                    />
                  )}
                </section>
              </div>
            )}
          </>
        )}
      </div>
      {asking === 'replace' && paneGuest != null && (
        <Ask
          title={GW.replaceTitle(paneGuest.name)}
          line={GW.replaceLine}
          keep={GW.keepIt}
          go={GW.replace}
          red={false}
          onKeep={() => setAsking(null)}
          onGo={() => {
            setList((was) => replaceLink(was, paneGuest.id, today));
            setAsking(null);
          }}
        />
      )}
      {leaving != null && (
        <Ask
          title={GW.discardTitle}
          line={GW.discardLine(paneGuest?.name ?? '')}
          keep={GW.keepEditing}
          go={GW.discard}
          onKeep={() => setLeaving(null)}
          onGo={() => {
            const next = leaving;

            setLeaving(null);
            go(next);
          }}
        />
      )}
      {away.blocked && (
        <Ask
          title={GW.discardTitle}
          line={GW.discardLine(paneGuest?.name ?? '')}
          keep={GW.keepEditing}
          go={GW.discard}
          onKeep={away.stay}
          onGo={() => {
            setDirty(false);
            away.go();
          }}
        />
      )}
    </div>
  );
}

function SearchRow({
  q,
  choice,
  counts,
  menu,
  onQ,
  onChoice,
  onMenu,
}: {
  q: string;
  choice: Choice;
  counts: ReturnType<typeof countsOf>;
  menu: boolean;
  onQ: (q: string) => void;
  onChoice: (choice: Choice) => void;
  onMenu: (open: boolean) => void;
}) {
  const field = useRef<HTMLInputElement>(null);
  const items = CHOICES.filter(
    (key) => (key !== 'walkIn' && key !== 'notYet') || counts[key] > 0,
  ).map((key) => ({
    key,
    word: choiceWord(key),
    count: counts[key],
  }));

  return (
    <div className="ev-search-row gs-search-row">
      <div className="ev-search" role="search">
        <div className="ev-field">
          <Glyph name="search" size={18} weight={2.2} />
          <input
            ref={field}
            type="search"
            aria-label={GW.find}
            placeholder={GW.find}
            value={q}
            spellCheck={false}
            data-focus="find"
            onChange={(event) => onQ(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && q !== '') {
                event.preventDefault();
                onQ('');
              }
            }}
          />
          {q !== '' && (
            <button
              type="button"
              className="ev-clear"
              aria-label={GW.clearSearch}
              onClick={() => {
                onQ('');
                field.current?.focus();
              }}
            >
              <span className="ev-clear-disc" aria-hidden="true">
                <Glyph name="clear" size={12} weight={3} />
              </span>
            </button>
          )}
        </div>
      </div>
      <div className="gs-menu">
        <Menu
          items={items}
          picked={choice}
          open={menu}
          onOpen={() => onMenu(true)}
          onClose={() => onMenu(false)}
          onPick={(key) => onChoice(key as Choice)}
        />
      </div>
    </div>
  );
}

function Group({
  reply,
  count,
  rows,
  collapsed,
  open,
  event,
  onOpen,
  onAll,
}: {
  reply: Reply;
  count: number;
  rows: readonly ListRow[];
  collapsed: boolean;
  open: string | null;
  event: string;
  onOpen: (id: string) => void;
  onAll: () => void;
}) {
  const id = useId();
  const word = REPLY_WORDS[reply];

  return (
    <section className="gs-group" aria-labelledby={id}>
      <h2 id={id} className="gs-group-head">
        {word}
        <span className="gs-group-count"> · {figure(count)}</span>
      </h2>
      <Rows rows={rows} open={open} event={event} onOpen={onOpen} />
      {collapsed && <TextAction label={GW.showAll(count)} onClick={onAll} />}
    </section>
  );
}

/** Flat rows: the reply's mark, the full name exactly as typed, one line; a companion indented under their guest, opening them. */
function Rows({
  rows,
  open,
  event,
  onOpen,
}: {
  rows: readonly ListRow[];
  open: string | null;
  event: string;
  onOpen: (id: string) => void;
}) {
  return (
    <ul className="desk-rows gs-rows">
      {rows.map((row) => {
        const on = row.person.companion == null && row.person.id === open;

        return (
          <li key={row.person.id} className={row.indent ? 'is-companion' : undefined}>
            <a
              href={guestsAt(event, { guest: row.person.guest.id })}
              className={on ? 'desk-row gs-row is-on' : 'desk-row gs-row'}
              aria-label={row.label}
              aria-current={on ? 'true' : undefined}
              data-focus={`row:${row.person.id}`}
              onClick={(click) => {
                click.preventDefault();
                onOpen(row.person.guest.id);
              }}
            >
              <MarkLead reply={row.person.reply} />
              <RowWords title={row.person.name} lines={[row.line]} />
              <Chevron />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
