import { formattingLocale } from '@soirely/domain';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useDeskSplit } from '../layers.ts';
import { ClaimDialog, InviteDialog, RequestDialog } from './MembersDialogs.tsx';
import { PersonPage, RoleDialog } from './MembersPerson.tsx';
import {
  approvalRoles,
  approved,
  type CardStep,
  counts,
  EMPTY,
  type Filter,
  filtersFor,
  filterWord,
  firstName,
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
  removed,
  removesLine,
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
  Bell,
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

/** Members at a desk in B (Web-Members-*.dc.html): the list, a person in its place, and every dialog, on sample data. */
export function Members({ viewer, state, tell }: { viewer: Viewer; state: string; tell: Tell }) {
  const say = useMemo(() => settingsSayIn(formattingLocale('en', navigator.language)), []);
  const [start] = useState(() => membersStart(state, viewer));
  const [load, setLoad] = useState<Load | 'retrying'>(start.load);
  const [people, setPeople] = useState(start.people);
  const [invitations, setInvitations] = useState(start.invitations);
  const [filter, setFilter] = useState(start.filter);
  const [menu, setMenu] = useState(start.menu);
  const [open, setOpen] = useState(start.open);
  const [event, setEvent] = useState(start.event);
  const [notice, setNotice] = useState(start.notice);
  const [claim, setClaim] = useState(start.claim);
  const [dialog, setDialog] = useState<MembersDialog | null>(start.dialog);
  const [proved, setProved] = useState(false);
  const split = useDeskSplit();
  const moved = useRef(false);

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
    if (!split || open == null) document.querySelector<HTMLElement>('.desk-main h1')?.focus();
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
    invitations,
    filter,
    menu,
    say,
    picked: open,
    onMenu: setMenu,
    onFilter: setFilter,
    onPerson: openPerson,
    onAnswer: answer,
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
  const card = membersCard({ people, viewer, notice, claim, say });
  const dialogs = (
    <MembersDialogs
      dialog={dialog}
      viewer={viewer}
      people={people}
      proved={proved}
      say={say}
      tell={tell}
      onClose={close}
      onPeople={(next, then) => {
        setPeople(next);
        if (then.event != null) setEvent(then.event);
        if (then.notice != null) setNotice(then.notice);
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
    />
  );

  if (load !== 'loaded')
    return (
      <Page>
        <TitleRow title="Members" tell={tell} />
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
      />
    );

    return split ? (
      <>
        <Column
          title={<TitleRow title="Members" action={invite} tell={tell} bell={false} compact />}
        >
          <MembersCardView card={card} size="column" onStep={step} />
          <MembersBlocks {...list} column />
        </Column>
        <Page>
          <div className="desk-top is-end">
            <Bell tell={tell} />
          </div>
          {page}
        </Page>
        {dialogs}
      </>
    ) : (
      <Page>
        <BackRow to="Members" onBack={back} tell={tell} />
        {page}
        {dialogs}
      </Page>
    );
  }

  return (
    <Page>
      <TitleRow title="Members" action={invite} tell={tell} />
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
      <Says>{card.says}</Says>
      {card.lines.map((line) => (
        <OnCard key={line}>{line}</OnCard>
      ))}
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
  onRevoke: (email: string) => void;
  onAgain: (invitation: Invitation) => void;
}

/** Waiting, then People with its filter, then the invitations: the list's blocks under the card. */
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
  proved: boolean;
  say: SettingsSay;
  tell: Tell;
  onClose: () => void;
  onPeople: (people: Person[], then: Then) => void;
  onInvited: (email: string, role: string, proved: boolean) => void;
  onClaim: (claim: 'found' | 'withdrawn') => void;
}

interface Then {
  event?: PersonEvent;
  notice?: Notice;
  leave?: boolean;
  proved?: boolean;
}

function MembersDialogs(props: MembersDialogsProps) {
  const { dialog, viewer, people, onClose, onPeople } = props;
  const person =
    dialog != null && 'id' in dialog ? people.find((one) => one.id === dialog.id) : null;

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
    case 'remove':
      return (
        person != null && (
          <Ask
            title={`Remove ${person.name} from ${ORGANISATION}?`}
            line={LOSES}
            keep={`Keep ${firstName(person.name)}`}
            go="Remove"
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
