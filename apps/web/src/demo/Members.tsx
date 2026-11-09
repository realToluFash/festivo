import { DemoBell } from './DemoBell.tsx';
import { formattingLocale } from '@soirely/domain';
import { type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import { HandoverAsk } from './Handover.tsx';
import {
  type Handed,
  handedOver,
  HANDOVER_WORDS,
  handStart,
  type Leads,
  ledBy,
  offeredFor,
} from './handover.ts';
import { focusWhenFree, useDeskSplit } from '../layers.ts';
import { ClaimDialog, InviteDialog, RecoveryAsk, RequestDialog } from './MembersDialogs.tsx';
import { PersonPage, RoleDialog } from './MembersPerson.tsx';
import {
  approvalRoles,
  ALSO_MEMBER,
  approved,
  type CardStep,
  counts,
  EMPTY,
  type Filter,
  filtersFor,
  filterWord,
  firstName,
  handoverAsk,
  INVITATIONS_NOTE,
  type Invitation,
  invitationRow,
  invited,
  isShown,
  type Load,
  LOSES,
  membersCard,
  type MembersDialog,
  membersStart,
  type Notice,
  ORGANISATION,
  type Person,
  type PersonEvent,
  PROOF_MINUTES,
  RECOVERY_WORDS as RR,
  type Recovery,
  type RecoveryAnswer,
  recoveryRow,
  removed,
  removesLine,
  removeWords,
  restoredBy,
  revoked,
  rowLine,
  suspendAsk,
  suspendedBy,
  tagOf,
  waitingLine,
} from './members.ts';
import { type SettingsSay, settingsSayIn, type Viewer } from './settings.ts';
import {
  Ask,
  Avatar,
  BackRow,
  Card,
  CardStep as Step,
  Chevron,
  Head,
  Menu,
  OnCard,
  RowWords,
  Says,
  Tag,
  TextAction,
  TitleRow,
} from '../components/SettingsParts.tsx';
import type { Tell } from '../components/SettingsParts.tsx';

const RETRY_MS = 1200;

const buttonNamed = (label: string) =>
  [...document.querySelectorAll<HTMLElement>('.desk-main button')].find(
    (one) => one.textContent === label,
  ) ?? null;
const requestOf = (id: string) => document.getElementById(`request-${id}`);
const answerOf = (id: string, answer: RecoveryAnswer) =>
  requestOf(id)?.querySelectorAll<HTMLElement>('.desk-text')[answer === 'approve' ? 0 : 1] ?? null;
const cardWords = () => document.querySelector<HTMLElement>('.desk-main .desk-said-lines');

/** Members at a desk in B (Web-Members-*.dc.html): the list, a person in its place, and every dialog, on sample data. */
export function Members({ viewer, state, tell }: { viewer: Viewer; state: string; tell: Tell }) {
  const say = useMemo(() => settingsSayIn(formattingLocale('en', navigator.language)), []);
  const [start] = useState(() => membersStart(state, viewer));
  const [load, setLoad] = useState<Load | 'retrying'>(start.load);
  const [leadsLoad, setLeadsLoad] = useState<Load | 'retrying'>(start.leadsLoad);
  const [people, setPeople] = useState(start.people);
  const [recoveries, setRecoveries] = useState(start.recoveries);
  const [lit, setLit] = useState<string | null>(null);
  const [invitations, setInvitations] = useState(start.invitations);
  const [filter, setFilter] = useState(start.filter);
  const [menu, setMenu] = useState(start.menu);
  const [open, setOpen] = useState(start.open);
  const [event, setEvent] = useState(start.event);
  const [notice, setNotice] = useState(start.notice);
  const [claim, setClaim] = useState(start.claim);
  const [dialog, setDialog] = useState<MembersDialog | null>(start.dialog);
  const [proved, setProved] = useState(false);
  const [leads, setLeads] = useState(start.leads);
  const [handed, setHanded] = useState(start.handed);
  const split = useDeskSplit();
  const landsOnCard =
    start.notice?.kind === 'recovered' ||
    (start.notice?.kind === 'removed' && start.notice.handed != null);
  const toSays = useRef(landsOnCard);
  const moved = useRef(landsOnCard);

  useEffect(() => {
    if (leadsLoad !== 'retrying') return;
    const timer = setTimeout(() => setLeadsLoad('loaded'), RETRY_MS);

    return () => clearTimeout(timer);
  }, [leadsLoad]);

  useEffect(() => {
    if (load !== 'retrying') return;
    const timer = setTimeout(() => setLoad('loaded'), RETRY_MS);

    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!proved) return;
    const timer = setTimeout(() => setProved(false), PROOF_MINUTES * 60_000);

    return () => clearTimeout(timer);
  }, [proved]);

  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    if (toSays.current) focusWhenFree(cardWords);
    else if (!split || open == null) document.querySelector<HTMLElement>('.desk-main h1')?.focus();
    toSays.current = false;
  }, [open, split]);

  const close = useCallback(() => setDialog(null), []);
  const person = open == null ? null : (people.find((one) => one.id === open) ?? null);
  const openPerson = (id: string) => {
    moved.current = true;
    setOpen(id);
    setEvent(null);
    setNotice(null);
  };
  const back = () => {
    moved.current = true;
    setOpen(null);
    setEvent(null);
  };
  const answer = (id: string) =>
    setDialog({ kind: 'request', id, picked: approvalRoles(viewer)[0] ?? '', ask: null });
  const step = (does: CardStep) => {
    switch (does.does) {
      case 'answer':
        return answer(does.id);
      case 'recover':
        setLit(does.id);
        return focusWhenFree(() => requestOf(does.id));
      case 'see':
        return openPerson(does.id);
      case 'former':
        setNotice(null);
        return setFilter('former');
      case 'become':
        setClaim('open');
        return setDialog({ kind: 'claim', check: 'resting', copied: null, ask: false });
      case 'check':
        return setDialog({ kind: 'claim', check: 'checking', copied: null, ask: false });
    }
  };
  const list = {
    viewer,
    people,
    recoveries,
    lit,
    invitations,
    filter,
    menu,
    say,
    picked: open,
    onMenu: setMenu,
    onFilter: setFilter,
    onPerson: openPerson,
    onAnswer: answer,
    onRecovery: (id: string, answer: RecoveryAnswer) =>
      setDialog({ kind: 'recovery', id, answer, phase: 'asking' }),
    onMoveOn: () => setLit(null),
    onRevoke: (email: string) => setInvitations((now) => revoked(now, email)),
    onAgain: (invitation: Invitation) =>
      setDialog({ kind: 'invite', email: invitation.email, role: invitation.role, problem: null }),
  };
  const invite = viewer.manages ? (
    <TextAction
      label="Invite somebody"
      before="plus"
      onClick={() => setDialog({ kind: 'invite', email: '', role: 'Member', problem: null })}
    />
  ) : undefined;
  const card = membersCard({ people, recoveries, viewer, notice, claim, say });
  const dialogs = (
    <MembersDialogs
      dialog={dialog}
      viewer={viewer}
      people={people}
      leads={leads}
      recoveries={recoveries}
      proved={proved}
      say={say}
      tell={tell}
      onClose={close}
      onPeople={(next, then) => {
        setPeople(next);
        if (then.leads != null) setLeads(then.leads);
        if (then.handed != null) setHanded(then.handed);
        if (then.says === true) toSays.current = true;
        if (then.event != null) setEvent(then.event);
        if (then.notice != null) setNotice(then.notice);
        if (then.notice?.kind === 'removed') {
          const gone = then.notice.id;
          setRecoveries((now) => now.filter((one) => one.id !== gone));
        }
        if (then.leave === true) back();
        if (then.proved === true) setProved(true);
      }}
      onInvited={(email, role, proof) => {
        setInvitations((now) => invited(now, email, role, viewer.id));
        setNotice({ kind: 'sent', email: email.trim() });
        setFilter('all');
        if (proof) setProved(true);
      }}
      onClaim={setClaim}
      onRecoveryKept={(id, answer) => {
        close();
        focusWhenFree(() => answerOf(id, answer));
      }}
      onRecovered={(id, answer) => {
        setRecoveries((now) => now.filter((one) => one.id !== id));
        setNotice({ kind: 'recovered', id, answer });
        setLit(null);
        close();
        focusWhenFree(cardWords);
      }}
      onRecoveryGone={(id) => {
        const next = recoveries.find((one) => one.id !== id);
        setRecoveries((now) => now.filter((one) => one.id !== id));
        setNotice(null);
        setLit(null);
        close();
        focusWhenFree(() => (next == null ? cardWords() : requestOf(next.id)));
      }}
    />
  );

  if (load !== 'loaded')
    return (
      <Page>
        <TitleRow title="Members" bell={<DemoBell tell={tell} />} />
        {load === 'failed' ? <Failed onRetry={() => setLoad('retrying')} /> : <Loading />}
      </Page>
    );

  if (person != null) {
    const page = (
      <PersonPage
        person={person}
        people={people}
        viewer={viewer}
        event={event}
        handed={handed}
        events={ledBy(leads, person.id)}
        leadsLoad={leadsLoad}
        onLoadLeads={() => setLeadsLoad('retrying')}
        alsoMember={state === 'alsoMember' ? (ALSO_MEMBER[person.id] ?? null) : null}
        say={say}
        level={split ? 2 : 1}
        tell={tell}
        onRole={() =>
          setDialog({
            kind: 'role',
            id: person.id,
            picked: person.role ?? '',
            ask: false,
            proving: null,
          })
        }
        onRestore={() => {
          setPeople((now) => restoredBy(now, person.id, viewer.id));
          setEvent('restored');
        }}
        onSuspend={() => setDialog({ kind: 'suspend', id: person.id })}
        onRemove={() => setDialog({ kind: 'remove', id: person.id })}
        onHandOver={() => setDialog({ kind: 'handOver', id: person.id })}
      />
    );

    return split ? (
      <>
        <Column title={<TitleRow title="Members" action={invite} compact />}>
          <MembersCardView card={card} size="column" onStep={step} />
          <MembersBlocks {...list} column />
        </Column>
        <Page>
          <div className="desk-top is-end">
            <DemoBell tell={tell} />
          </div>
          {page}
        </Page>
        {dialogs}
      </>
    ) : (
      <Page>
        <BackRow to="Members" onBack={back} bell={<DemoBell tell={tell} />} />
        {page}
        {dialogs}
      </Page>
    );
  }

  return (
    <Page>
      <TitleRow title="Members" action={invite} bell={<DemoBell tell={tell} />} />
      <MembersCardView card={card} onStep={step} />
      {claim === 'found' && (
        <TextAction label="Withdraw my claim" onClick={() => setDialog({ kind: 'withdraw' })} />
      )}
      <MembersBlocks {...list} column={false} />
      {dialogs}
    </Page>
  );
}

function Page({ children }: { children: ReactNode }) {
  return (
    <div className="desk-page">
      <div className="desk-column">{children}</div>
    </div>
  );
}

function Column({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="desk-split">
      {title}
      {children}
    </div>
  );
}

function Loading() {
  return (
    <div className="desk-loading" role="status" aria-label="Loading members…">
      <span className="desk-unseen">Loading members…</span>
      <span className="desk-sunk is-card" aria-hidden="true" />
      <ul className="desk-rows has-lead" aria-hidden="true">
        {[1, 2, 3, 4].map((bar) => (
          <li key={bar} className="desk-row is-bones">
            <span className="desk-sunk is-face" />
            <span className="desk-row-words">
              <span className={`desk-sunk is-title b${bar}`} />
              <span className={`desk-sunk is-line b${bar}`} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Failed({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="desk-failed" role="alert">
      <h2>We could not load the members.</h2>
      <p className="desk-line">Check your connection and try again.</p>
      <TextAction label="Try again" onClick={onRetry} />
    </div>
  );
}

function MembersCardView({
  card,
  size = 'page',
  onStep,
}: {
  card: ReturnType<typeof membersCard>;
  size?: 'page' | 'column';
  onStep: (step: CardStep) => void;
}) {
  return (
    <Card size={size}>
      <div className="desk-said-lines" tabIndex={-1}>
        <Says focusable>{card.says}</Says>
        {card.lines.map((line) => (
          <OnCard key={line}>{line}</OnCard>
        ))}
      </div>
      {card.faces.length > 0 && (
        <div className="desk-faces" aria-hidden="true">
          {card.faces.map((face) => (
            <Avatar key={face.id} initials={face.initials} tone={face.tone} size="face" />
          ))}
          {card.more > 0 && <span className="desk-more">+{card.more}</span>}
        </div>
      )}
      {card.step != null && (
        <Step label={card.step.label} onClick={() => card.step != null && onStep(card.step)} />
      )}
    </Card>
  );
}

interface BlocksProps {
  viewer: Viewer;
  people: readonly Person[];
  recoveries: readonly Recovery[];
  lit: string | null;
  invitations: readonly Invitation[];
  filter: Filter;
  menu: boolean;
  say: SettingsSay;
  picked: string | null;
  column: boolean;
  onMenu: (open: boolean) => void;
  onFilter: (filter: Filter) => void;
  onPerson: (id: string) => void;
  onAnswer: (id: string) => void;
  onRecovery: (id: string, answer: RecoveryAnswer) => void;
  onMoveOn: () => void;
  onRevoke: (email: string) => void;
  onAgain: (invitation: Invitation) => void;
}

/** Requests to get back in, then Waiting, People with its filter, and the invitations: the list's blocks under the card. */
function MembersBlocks(props: BlocksProps) {
  const { viewer, people, invitations, filter, menu, say, column, onMenu, onFilter } = props;
  const waiting = viewer.manages ? people.filter((one) => one.status === 'pendingApproval') : [];
  const shown = people.filter((one) => isShown(one.status, filter));
  const numbers = counts(people, invitations);
  const items = filtersFor(viewer).map((key) => ({
    key,
    word: filterWord(key),
    count: numbers[key],
  }));
  const empty = filter === 'all' ? null : EMPTY[filter];
  const onClose = useCallback(() => onMenu(false), [onMenu]);

  return (
    <>
      {props.recoveries.length > 0 && <RecoveryBlock {...props} />}
      {waiting.length > 0 && (
        <section className="desk-block">
          <Head title="Waiting" />
          <ul className="desk-rows has-lead">
            {waiting.map((one) => (
              <li key={one.id}>
                <WaitingRow person={one} say={say} onAnswer={props.onAnswer} />
              </li>
            ))}
          </ul>
          <p className="desk-foot">{removesLine(say)}</p>
        </section>
      )}
      <section className="desk-block">
        <Head title="People">
          <Menu
            items={items}
            picked={filter}
            open={menu}
            onOpen={() => onMenu(true)}
            onClose={onClose}
            onPick={(key) => onFilter(key as Filter)}
          />
        </Head>
        {filter === 'invited' && invitations.length > 0 ? (
          <>
            <InvitationRows {...props} />
            <p className="desk-foot">{INVITATIONS_NOTE}</p>
          </>
        ) : filter !== 'invited' && shown.length > 0 ? (
          <PeopleRows {...props} shown={shown} />
        ) : (
          empty != null && (
            <div className="desk-empty">
              <p className="desk-empty-title">{empty.title}</p>
              {empty.line != null && <p className="desk-line">{empty.line}</p>}
              <TextAction label="Show everyone" onClick={() => onFilter('all')} />
            </div>
          )
        )}
      </section>
      {filter === 'all' && !column && invitations.length > 0 && (
        <section className="desk-block">
          <Head title="Invitations" />
          <InvitationRows {...props} />
          <p className="desk-foot">{INVITATIONS_NOTE}</p>
        </section>
      )}
    </>
  );
}

/** The product's paragraph once, at the top, and read with each request; each request a row that holds its own answers. */
function RecoveryBlock({
  viewer,
  people,
  recoveries,
  lit,
  say,
  column,
  onRecovery,
  onMoveOn,
}: BlocksProps) {
  const intro = useId();

  return (
    <section className="desk-block">
      <Head title={RR.cardTitle} />
      <p id={intro} className="desk-line desk-request-intro">
        {RR.intro}
      </p>
      <ul className="desk-rows has-lead">
        {recoveries.map((one) => {
          const row = recoveryRow(one, people, viewer, say);
          const face = people.find((person) => person.id === one.id);

          return (
            <li key={one.id}>
              <article
                id={`request-${one.id}`}
                className={one.id === lit ? 'desk-row desk-request is-on' : 'desk-row desk-request'}
                tabIndex={-1}
                aria-labelledby={`request-${one.id}-name`}
                aria-describedby={intro}
                onBlur={(event) => {
                  const to = event.relatedTarget;
                  const away =
                    to instanceof Element &&
                    !event.currentTarget.contains(to) &&
                    to.closest('.desk-layers') == null;

                  if (one.id === lit && away) onMoveOn();
                }}
              >
                <Avatar
                  initials={face?.initials ?? ''}
                  tone={face?.tone ?? 0}
                  size={column ? 'small' : 'row'}
                />
                <div className="desk-row-words">
                  <span className="desk-row-title">
                    <span id={`request-${one.id}-name`} className="desk-row-name">
                      {row.name}
                    </span>
                    <Tag kind="waiting" word={RR.mark} />
                  </span>
                  {row.lines.map((line) => (
                    <span key={line} className="desk-row-line">
                      {line}
                    </span>
                  ))}
                  {row.own == null ? (
                    <div className="desk-request-answers">
                      <TextAction
                        label={RR.approve}
                        onClick={() => onRecovery(one.id, 'approve')}
                      />
                      <TextAction
                        label={RR.turnDown}
                        onClick={() => onRecovery(one.id, 'turnDown')}
                      />
                    </div>
                  ) : (
                    <p className="desk-request-own">{row.own}</p>
                  )}
                </div>
              </article>
            </li>
          );
        })}
      </ul>
      <p className="desk-foot">{RR.cardNote}</p>
    </section>
  );
}

function WaitingRow({
  person,
  say,
  onAnswer,
}: {
  person: Person;
  say: SettingsSay;
  onAnswer: (id: string) => void;
}) {
  return (
    <button type="button" className="desk-row" onClick={() => onAnswer(person.id)}>
      <Avatar initials={person.initials} tone={person.tone} />
      <RowWords
        title={person.name}
        tag={<Tag {...tagOf(person)} />}
        lines={[waitingLine(person, say)]}
      />
      <Chevron />
    </button>
  );
}

function PeopleRows({
  shown,
  viewer,
  say,
  picked,
  column,
  onPerson,
  onAnswer,
}: BlocksProps & { shown: readonly Person[] }) {
  return (
    <ul className="desk-rows has-lead">
      {shown.map((one) => {
        const tag = one.status === 'active' ? undefined : <Tag {...tagOf(one)} />;
        const on = column && one.id === picked;

        return (
          <li key={one.id}>
            {one.status === 'pendingApproval' ? (
              <WaitingRow person={one} say={say} onAnswer={onAnswer} />
            ) : one.status === 'former' ? (
              <div className="desk-row">
                <Avatar initials={one.initials} tone={one.tone} />
                <RowWords title={one.name} tag={tag} lines={[rowLine(one, viewer)]} />
              </div>
            ) : (
              <button
                type="button"
                className={on ? 'desk-row is-on' : 'desk-row'}
                aria-current={on || undefined}
                onClick={() => onPerson(one.id)}
              >
                <Avatar initials={one.initials} tone={one.tone} size={column ? 'small' : 'row'} />
                <RowWords title={one.name} tag={tag} lines={[rowLine(one, viewer)]} />
                <Chevron />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** An invitation's address, its role and sender, when it was sent and ends; Revoke while it is pending, Invite again after. */
function InvitationRows({ invitations, people, viewer, say, onRevoke, onAgain }: BlocksProps) {
  return (
    <ul className="desk-rows">
      {invitations.map((invitation) => {
        const row = invitationRow(invitation, people, viewer, say);

        return (
          <li key={invitation.email} className="desk-row">
            <RowWords
              title={invitation.email}
              tag={row.tag == null ? undefined : <Tag kind="ended" word={row.tag} />}
              lines={[row.line, row.dates]}
            />
            {viewer.manages &&
              (invitation.status === 'pending' ? (
                <TextAction label="Revoke" red onClick={() => onRevoke(invitation.email)} />
              ) : (
                <TextAction label="Invite again" onClick={() => onAgain(invitation)} />
              ))}
          </li>
        );
      })}
    </ul>
  );
}

interface MembersDialogsProps {
  dialog: MembersDialog | null;
  viewer: Viewer;
  people: readonly Person[];
  leads: Leads;
  recoveries: readonly Recovery[];
  proved: boolean;
  say: SettingsSay;
  tell: Tell;
  onClose: () => void;
  onPeople: (people: Person[], then: Then) => void;
  onInvited: (email: string, role: string, proved: boolean) => void;
  onClaim: (claim: 'found' | 'withdrawn') => void;
  onRecoveryKept: (id: string, answer: RecoveryAnswer) => void;
  onRecovered: (id: string, answer: RecoveryAnswer) => void;
  onRecoveryGone: (id: string) => void;
}

interface Then {
  event?: PersonEvent;
  notice?: Notice;
  leave?: boolean;
  proved?: boolean;
  leads?: Leads;
  handed?: Handed;
  says?: boolean;
}

function MembersDialogs(props: MembersDialogsProps) {
  const { dialog, viewer, people, leads, onClose, onPeople } = props;
  const person =
    dialog != null && 'id' in dialog ? people.find((one) => one.id === dialog.id) : null;
  const events = person == null ? [] : ledBy(leads, person.id);
  const handing = (kind: 'remove' | 'hand', hand = handStart(viewer.id)) =>
    person != null && (
      <HandoverAsk
        words={handoverAsk(kind, person.name, events.length)}
        events={events}
        offered={offeredFor(people, person.id)}
        viewer={viewer.id}
        start={hand}
        onKeep={() => {
          onClose();
          const opener =
            kind === 'hand' ? HANDOVER_WORDS.handOverNow : `Remove from ${ORGANISATION}…`;
          focusWhenFree(() => buttonNamed(opener));
        }}
        onDone={(chosen) => {
          const to = chosen ?? viewer.id;
          const moved = { to, count: events.length };

          onClose();
          if (kind === 'hand')
            onPeople([...people], {
              event: 'handedOver',
              handed: moved,
              leads: handedOver(leads, person.id, to),
            });
          else
            onPeople(removed(people, person.id), {
              notice: { kind: 'removed', id: person.id, handed: moved },
              leave: true,
              leads: handedOver(leads, person.id, to),
              says: true,
            });
        }}
      />
    );

  switch (dialog?.kind) {
    case undefined:
      return null;
    case 'invite':
      return <InviteDialog {...props} start={dialog} />;
    case 'request':
      return (
        person != null && (
          <RequestDialog
            {...props}
            person={person}
            start={dialog}
            onApprove={(role) =>
              onPeople(approved(people, person.id, role, viewer.id), {
                notice: { kind: 'approved', id: person.id, role },
              })
            }
            onTurnDown={() =>
              onPeople(removed(people, person.id), {
                notice: { kind: 'turnedDown', id: person.id },
              })
            }
          />
        )
      );
    case 'role':
      return person != null && <RoleDialog {...props} person={person} start={dialog} />;
    case 'handOver':
      return handing('hand', dialog.hand);
    case 'remove':
      if (events.length > 0) return handing('remove', dialog.hand);

      return (
        person != null && (
          <Ask
            {...removeWords(person.name)}
            line={LOSES}
            onKeep={onClose}
            onGo={() => {
              onClose();
              onPeople(removed(people, person.id), {
                notice: { kind: 'removed', id: person.id },
                leave: true,
              });
            }}
          />
        )
      );
    case 'suspend':
      return (
        person != null && (
          <Ask
            {...suspendAsk(person.name)}
            keep={`Keep ${firstName(person.name)}`}
            go="Suspend"
            onKeep={onClose}
            onGo={() => {
              onClose();
              onPeople(suspendedBy(people, person.id, viewer.id), { event: 'justSuspended' });
            }}
          />
        )
      );
    case 'claim':
      return <ClaimDialog {...props} start={dialog} />;
    case 'recovery': {
      const { answer } = dialog;

      return (
        person != null && (
          <RecoveryAsk
            name={person.name}
            answer={answer}
            phase={dialog.phase}
            ended={props.recoveries.find((one) => one.id === person.id)?.ended ?? true}
            onKeep={() => props.onRecoveryKept(person.id, answer)}
            onAnswer={() => props.onRecovered(person.id, answer)}
            onGone={() => props.onRecoveryGone(person.id)}
          />
        )
      );
    }
    case 'withdraw':
      return (
        <Ask
          title="Withdraw your claim?"
          line={`You won’t become the owner of ${ORGANISATION}. Any admin, you included, can start a new claim.`}
          keep="Keep my claim"
          go="Withdraw"
          onKeep={onClose}
          onGo={() => {
            onClose();
            props.onClaim('withdrawn');
          }}
        />
      );
  }
}
