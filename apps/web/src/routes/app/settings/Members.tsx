import {
  type Membership,
  type MembersList,
  type MembersShow,
  type OrganisationMember,
  type OrganisationRole,
  type RecoveryRequest,
  type SentInvitation,
} from '@soirely/api-client';
import {
  type MemberFilter,
  formatDay,
  grantableRoles,
  initials,
  memberHeldNoRole,
  memberIsShown,
  recoveryEndedByRemoval,
  recoveryShownIn,
  MEMBERS_PAGE,
  type MembersMore,
  rereadLimit,
  roleName,
  withChanged,
  withNextPage,
  withPagesSince,
} from '@soirely/domain';
import {
  memo,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

import { api } from '../../../api.ts';
import { Glyph } from '../../../components/Glyph.tsx';
import { Refreshing } from '../../../components/OfflineBand.tsx';
import {
  BackRow,
  Head,
  Menu,
  Tag,
  TextAction,
  TitleRow,
} from '../../../components/SettingsParts.tsx';
import { dateLocale, useShownLanguage } from '../../../i18n/index.ts';
import { focusWhenFree, LayersContext, useDeskLayers, useDeskSplit } from '../../../layers.ts';
import { useOffline } from '../../../offline.ts';
import { dropProviderReturn } from '../../../providerSignIn.ts';
import { useDeskTop } from '../../../deskTop.ts';
import { can, useSession } from '../../../session.ts';
import { Forbidden } from '../Forbidden.tsx';
import { MemberPage } from './MemberPage.tsx';
import {
  type CardStep,
  membersCard,
  type Notice,
  type RecoveryAnswer,
  waitingMembers,
} from './membersCard.ts';
import {
  InvitationLine,
  MemberRow,
  MembersCardView,
  MembersEmpty,
  MembersFailed,
  MembersLoading,
} from '../../../components/MembersParts.tsx';
import { useOwnerClaim } from './MembersClaim.tsx';
import { InviteDialog, RequestDialog } from './MembersDialogs.tsx';
import { RecoveryAsk, RecoveryBlock } from './MembersRecovery.tsx';
import { backToMakeOwner } from './ownerReturn.ts';
import { memberTag } from './memberWords.ts';
import { SEARCHED_MEMBER } from '../../../searchLinks.ts';
import '../../../components/SettingsParts.css';
import './members.css';

type Load =
  | { kind: 'loading' }
  | { kind: 'failed'; retried: boolean }
  | {
      kind: 'loaded';
      list: MembersList;
      /** The option under Show whose people `list.members` holds. */
      listed: MembersShow;
      roles: OrganisationRole[];
      recoveries: RecoveryRequest[];
    };

/** The next page of People: on its way, or failed with the rows already shown kept (sc-49170). */
type More = MembersMore;

type Dialog =
  | { kind: 'invite'; email: string; roleId: string | null; again: string | null }
  | { kind: 'request'; id: string }
  | { kind: 'recovery'; id: string; answer: RecoveryAnswer };

const FILTERS: readonly MemberFilter[] = [
  'all',
  'active',
  'invited',
  'waiting',
  'suspended',
  'former',
];

const title = () => document.querySelector<HTMLElement>('.members-desk h1');
const cardWords = () => document.querySelector<HTMLElement>('.members-desk .desk-said-lines');
const requestOf = (id: string) => document.getElementById(`request-${id}`);
const answerOf = (id: string, answer: RecoveryAnswer) =>
  requestOf(id)?.querySelectorAll<HTMLElement>('.desk-request-answers .desk-text')[
    answer === 'approve' ? 0 : 1
  ] ?? null;

/** Settings › Members at a desk (sc-34200): the card, Waiting, People and the invitations, as the demo's Members draws them. */
export function Members() {
  const { t } = useTranslation();
  const session = useSession();
  const organisation = session.organisation;
  const organisationId = organisation?.id;
  const manages = can(session, 'members.manage');
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const language = useShownLanguage();
  const loadedFor = useRef<string | null>(null);
  const shown = useRef<{ list: MembersList; listed: MembersShow } | null>(null);
  const retrying = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const failedTitle = useRef<HTMLHeadingElement>(null);
  const { layers, covered, setHost } = useDeskLayers();
  const { watch, refreshing } = useOffline({
    loaded: load.kind === 'loaded',
    reload: () => setRefresh((n) => n + 1),
    title: heading,
  });

  useEffect(() => {
    if (organisationId == null) return;
    let current = true;
    const askedAgain = loadedFor.current === organisationId;
    // Asked again, it reads what is on screen: the option under Show, and every row its pages brought.
    const again = askedAgain ? shown.current : null;
    const listed = again?.listed ?? 'all';

    watch(
      Promise.all([
        again == null
          ? api.members(organisationId)
          : api.members(organisationId, { show: listed, limit: rereadLimit(again.list) }),
        api.roles(organisationId),
        manages ? api.recoveryRequests() : Promise.resolve([]),
      ]),
    ).then(
      ([list, catalogue, recoveries]) => {
        if (!current) return;
        loadedFor.current = organisationId;
        setLoad((before) => ({
          kind: 'loaded',
          list:
            again != null && before.kind === 'loaded' && before.listed === listed
              ? withPagesSince(list, before.list)
              : list,
          listed,
          roles: catalogue.roles,
          recoveries: recoveryShownIn(recoveries, organisationId),
        }));
        if (retrying.current) focusWhenFree(title);
        retrying.current = false;
      },
      () => {
        if (!current) return;
        const retried = retrying.current;
        retrying.current = false;
        setLoad((before) =>
          askedAgain && before.kind === 'loaded' ? before : { kind: 'failed', retried },
        );
        if (retried) focusWhenFree(() => failedTitle.current);
      },
    );

    return () => {
      current = false;
    };
  }, [organisationId, manages, attempt, refresh, language, watch]);

  useEffect(() => {
    shown.current = load.kind === 'loaded' ? { list: load.list, listed: load.listed } : null;
  }, [load]);

  useEffect(() => {
    heading.current = title() as HTMLHeadingElement | null;
  });

  const onChange = useCallback(
    (list: MembersList, listed?: MembersShow) =>
      setLoad((was) =>
        was.kind === 'loaded' ? { ...was, list, listed: listed ?? was.listed } : was,
      ),
    [],
  );

  if (organisation == null) return null;
  if (!can(session, 'members.read')) return <Forbidden />;

  return (
    <LayersContext value={layers}>
      <div className="desk members-desk">
        <div className="members-room" inert={covered}>
          {refreshing && <Refreshing />}
          {load.kind === 'loading' && (
            <Column>
              <TitleRow title={t('membersScreen.title')} />
              <MembersLoading words={t('membersScreen.loading')} />
            </Column>
          )}
          {load.kind === 'failed' && (
            <Column>
              <TitleRow title={t('membersScreen.title')} />
              <MembersFailed
                heading={failedTitle}
                alert={!load.retried}
                onRetry={() => {
                  retrying.current = true;
                  setLoad({ kind: 'loading' });
                  setAttempt((n) => n + 1);
                }}
              />
            </Column>
          )}
          {load.kind === 'loaded' && (
            <MembersLoaded
              key={organisation.id}
              organisation={organisation}
              list={load.list}
              listed={load.listed}
              roles={load.roles}
              recoveries={load.recoveries}
              manages={manages}
              onChange={onChange}
              onRecoveries={(recoveries) =>
                setLoad((was) => (was.kind === 'loaded' ? { ...was, recoveries } : was))
              }
            />
          )}
        </div>
        <div ref={setHost} className="desk-layers" />
      </div>
    </LayersContext>
  );
}

/** A member Search opened (sc-39534): their row, or their invitation's, in view and focused, once. */
function useSearchedMember(): void {
  const [params, setParams] = useSearchParams();
  const searched = params.get(SEARCHED_MEMBER);

  useEffect(() => {
    if (searched == null) return;

    const row = () =>
      document.querySelector<HTMLElement>(
        `[data-member="${CSS.escape(searched)}"], [data-invitation="${CSS.escape(searched)}"]`,
      );

    row()?.scrollIntoView?.({ block: 'center' });
    focusWhenFree(row);
    setParams(
      (now) => {
        const next = new URLSearchParams(now);
        next.delete(SEARCHED_MEMBER);

        return next;
      },
      { replace: true },
    );
  }, [searched, setParams]);
}

function Column({ children }: { children: ReactNode }) {
  return <div className="desk-column">{children}</div>;
}

function MembersLoaded({
  organisation,
  list,
  listed,
  roles,
  recoveries,
  manages,
  onChange,
  onRecoveries,
}: {
  organisation: Membership;
  list: MembersList;
  listed: MembersShow;
  roles: OrganisationRole[];
  recoveries: RecoveryRequest[];
  manages: boolean;
  onChange: (list: MembersList, listed?: MembersShow) => void;
  onRecoveries: (recoveries: RecoveryRequest[]) => void;
}) {
  const { t } = useTranslation();
  const desk = useDeskTop();
  // Back from Google or Apple, started by Confirm it's you before making an owner: once, on arrival.
  const [returned] = useState(backToMakeOwner);
  const [open, setOpen] = useState<string | null>(() =>
    returned != null && 'member' in returned.purpose.to ? returned.purpose.to.member : null,
  );
  const [dialog, setDialog] = useState<Dialog | null>(() =>
    returned != null && !('member' in returned.purpose.to)
      ? { kind: 'invite', ...returned.purpose.to, roleId: returned.purpose.roleId }
      : null,
  );
  const [notice, setNotice] = useState<Notice | null>(null);
  const [filter, setFilter] = useState<MemberFilter>('all');
  const [menu, setMenu] = useState(false);
  const [lit, setLit] = useState<string | null>(null);
  const split = useDeskSplit();
  const claim = useOwnerClaim(
    organisation.id,
    organisation.name,
    organisation.role.seededAs === 'administrator',
  );
  const moved = useRef(false);
  const toSays = useRef(false);
  const granted = grantableRoles(roles, organisation);
  const [more, setMore] = useState<More>('idle');
  const [switched, setSwitched] = useState(0);
  // A pick made with more than a page held reads its option again from the first page, so its time does not grow with the rows shown before.
  const [restart, setRestart] = useState(false);
  const rows = useRef<HTMLUListElement>(null);
  const wanted: MembersShow | null = filter === 'invited' || filter === 'waiting' ? null : filter;
  const switching = wanted != null && (wanted !== listed || restart);
  const held = [...list.members, ...list.waiting, ...list.faces];
  const found = open == null ? null : (held.find((one) => one.id === open) ?? null);
  // A change can take an open person out of the option being read; their page stays as last read.
  const [seen, setSeen] = useState<OrganisationMember | null>(null);
  if (found != null && found !== seen) setSeen(found);
  const person = found ?? (seen != null && seen.id === open ? seen : null);

  // Removed only once committed: React may abandon a render and run the initializer again.
  useEffect(() => {
    if (returned != null) dropProviderReturn();
  }, [returned]);

  // Another option under Show starts again from its own first page (sc-49170).
  useEffect(() => {
    if (wanted == null || !switching) return;
    let current = true;

    api.members(organisation.id, { show: wanted }).then(
      (page) => {
        if (!current) return;
        setMore('idle');
        setRestart(false);
        onChange(page, wanted);
      },
      () => current && setMore('failed'),
    );

    return () => {
      current = false;
    };
  }, [organisation.id, wanted, switching, switched, onChange]);

  const reread = (changed: string) =>
    Promise.all([
      api.members(organisation.id, { show: listed, limit: rereadLimit(list) }),
      api.member(organisation.id, changed),
    ]).then(([again, one]) => withChanged(again, list, one, listed));

  /** The next 50 under the rows shown; the focus goes to the first of them. A press while they load does nothing. */
  const showMore = async () => {
    if (more === 'loading') return;
    if (switching) {
      setMore('idle');
      setSwitched((n) => n + 1);
      return;
    }

    const first = list.members.length;
    setMore('loading');

    try {
      const page = await api.members(organisation.id, { show: listed, after: list.next });
      onChange(withNextPage(list, page), listed);
      setMore('idle');
      focusWhenFree(
        () => rows.current?.children[first]?.querySelector<HTMLElement>('button, a') ?? null,
      );
    } catch {
      setMore('failed');
    }
  };
  const pick = (next: MemberFilter) => {
    setMore('idle');
    if (next === filter) return;
    setRestart(next !== 'invited' && next !== 'waiting' && list.members.length > MEMBERS_PAGE);
    setFilter(next);
  };

  useSearchedMember();

  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    if (toSays.current) focusWhenFree(cardWords);
    else if (!split || open == null) title()?.focus();
    toSays.current = false;
  }, [open, split]);

  const openPerson = useCallback((id: string) => {
    moved.current = true;
    setOpen(id);
    setNotice(null);
  }, []);
  const back = () => {
    moved.current = true;
    setOpen(null);
  };
  const answer = useCallback((id: string) => setDialog({ kind: 'request', id }), []);
  const step = (does: CardStep) => {
    switch (does.does) {
      case 'answer':
        return answer(does.member);
      case 'recover':
        setLit(does.request);
        return focusWhenFree(() => requestOf(does.request));
      case 'see':
        return openPerson(does.member);
      case 'former':
        setNotice(null);
        return pick('former');
      case 'become':
        return claim.become();
      case 'check':
        return claim.check();
    }
  };
  const close = useCallback(() => setDialog(null), []);
  const asking = dialog?.kind === 'request' ? held.find((one) => one.id === dialog.id) : undefined;
  const recovering =
    dialog?.kind === 'recovery' ? recoveries.find((one) => one.id === dialog.id) : undefined;
  const settle = (id: string) => {
    onRecoveries(recoveries.filter((one) => one.id !== id));
    setLit(null);
    close();
  };
  const card = membersCard({
    list,
    recoveries,
    manages,
    notice,
    claim: claim.card,
    organisation: organisation.name,
    t,
  });
  const blocks = {
    organisation,
    list,
    recoveries,
    lit,
    manages,
    filter,
    menu,
    picked: open,
    onMenu: setMenu,
    onFilter: pick,
    switching,
    more,
    rowsRef: rows,
    onMore: () => void showMore(),
    onPerson: openPerson,
    onAnswer: answer,
    onRecovery: (id: string, answer: RecoveryAnswer) => setDialog({ kind: 'recovery', id, answer }),
    onMoveOn: () => setLit(null),
    onRevoked: (invitation: SentInvitation) =>
      onChange({
        ...list,
        invitations: list.invitations.map((one) => (one.id === invitation.id ? invitation : one)),
      }),
    onAgain: (invitation: SentInvitation) =>
      setDialog({
        kind: 'invite',
        email: invitation.email,
        roleId: invitation.role?.id ?? null,
        again: invitation.id,
      }),
  };
  const invite = manages ? (
    <TextAction
      label={t('membersScreen.invite')}
      before="plus"
      onClick={() => setDialog({ kind: 'invite', email: '', roleId: null, again: null })}
    />
  ) : undefined;
  const dialogs = (
    <>
      {dialog?.kind === 'invite' && (
        <InviteDialog
          organisation={organisation}
          roles={granted}
          start={dialog}
          returned={returned != null && !('member' in returned.purpose.to) ? returned : null}
          onClose={close}
          onSent={(invitation) => {
            onChange({
              ...list,
              invitations: [
                invitation,
                ...list.invitations.filter((one) => one.id !== invitation.id),
              ],
            });
            setNotice({ kind: 'sent', email: invitation.email });
            pick('all');
            close();
          }}
        />
      )}
      {asking != null && (
        <RequestDialog
          organisation={organisation}
          member={asking}
          roles={granted}
          reread={reread}
          onClose={close}
          onAnswered={(changed, answered) => {
            onChange(changed);
            setNotice(answered);
            close();
            focusWhenFree(title);
          }}
        />
      )}
      {dialog?.kind === 'recovery' && recovering != null && (
        <RecoveryAsk
          key={`${dialog.id}:${dialog.answer}`}
          request={recovering}
          answer={dialog.answer}
          onKeep={() => {
            close();
            focusWhenFree(() => answerOf(dialog.id, dialog.answer));
          }}
          onAnswered={() => {
            settle(dialog.id);
            setNotice({ kind: 'recovered', name: recovering.name, answer: dialog.answer });
            focusWhenFree(cardWords);
          }}
          onGone={() => {
            const next = recoveries.find((one) => one.id !== dialog.id);
            settle(dialog.id);
            setNotice((was) => (was?.kind === 'recovered' ? was : null));
            focusWhenFree(() => (next == null ? cardWords() : requestOf(next.id)));
          }}
        />
      )}
      {claim.dialog}
    </>
  );

  if (person != null) {
    const page = (
      <MemberPage
        key={person.id}
        organisation={organisation}
        member={person}
        list={list}
        roles={roles}
        manages={manages}
        level={split ? 2 : 1}
        returned={
          returned != null &&
          'member' in returned.purpose.to &&
          returned.purpose.to.member === person.id
            ? returned
            : null
        }
        reread={reread}
        onChanged={(changed) => onChange(changed)}
        onRemoved={(changed, name, handed) => {
          onChange(changed);
          onRecoveries(recoveryEndedByRemoval(recoveries, person.user.id));
          setNotice({ kind: 'removed', name, handed });
          toSays.current = true;
          back();
        }}
        onBack={back}
      />
    );

    return split ? (
      <div className="members-split">
        <div className="desk-split">
          <TitleRow title={t('membersScreen.title')} action={invite} compact />
          <MembersCard card={card} size="column" onStep={step} />
          {claim.under}
          <MembersBlocks {...blocks} column />
        </div>
        <div className="members-side">
          {desk.above}
          {desk.bell != null && <div className="desk-top is-end">{desk.bell}</div>}
          {page}
        </div>
        {dialogs}
      </div>
    ) : (
      <Column>
        <BackRow to={t('membersScreen.title')} onBack={back} bell={desk.bell} />
        {page}
        {dialogs}
      </Column>
    );
  }

  return (
    <Column>
      <TitleRow title={t('membersScreen.title')} action={invite} />
      <MembersCard card={card} onStep={step} />
      {claim.under}
      <MembersBlocks {...blocks} column={false} />
      {dialogs}
    </Column>
  );
}

function MembersCard({
  card,
  size = 'page',
  onStep,
}: {
  card: ReturnType<typeof membersCard>;
  size?: 'page' | 'column';
  onStep: (step: CardStep) => void;
}) {
  return (
    <MembersCardView
      card={{
        ...card,
        faces: card.faces.map((face, tone) => ({
          key: face.id,
          initials: initials(face.user.name),
          tone,
        })),
      }}
      size={size}
      onStep={onStep}
    />
  );
}

interface BlocksProps {
  organisation: Membership;
  list: MembersList;
  recoveries: readonly RecoveryRequest[];
  lit: string | null;
  manages: boolean;
  filter: MemberFilter;
  menu: boolean;
  picked: string | null;
  column: boolean;
  /** The option picked is not yet the one whose people the list holds. */
  switching: boolean;
  more: More;
  rowsRef: RefObject<HTMLUListElement | null>;
  onMore: () => void;
  onMenu: (open: boolean) => void;
  onFilter: (filter: MemberFilter) => void;
  onPerson: (id: string) => void;
  onAnswer: (id: string) => void;
  onRecovery: (id: string, answer: RecoveryAnswer) => void;
  onMoveOn: () => void;
  onRevoked: (invitation: SentInvitation) => void;
  onAgain: (invitation: SentInvitation) => void;
}

/** Requests to get back in, then Waiting, People with its filter, and the invitations: the list's blocks under the card. */
function MembersBlocks(props: BlocksProps) {
  const { list, manages, filter, menu, column, onMenu, onFilter } = props;
  const { t } = useTranslation();
  const waiting = waitingMembers(list, manages);
  const invitations = list.invitations.filter((one) => one.status !== 'accepted');
  const { switching, more } = props;
  const listed = list.members.filter((one) => memberIsShown(one.status, filter));
  const shown =
    filter === 'waiting' ? list.waiting : switching ? listed.slice(0, MEMBERS_PAGE) : listed;
  const count = (one: MemberFilter) =>
    one === 'invited'
      ? invitations.filter((invitation) => invitation.status === 'pending').length
      : list.counts[one];
  const total = count(filter);
  const moreToShow = switching ? more === 'failed' : list.next != null && shown.length < total;
  const items = FILTERS.filter((one) => manages || one !== 'waiting').map((key) => ({
    key,
    word: t(`membersScreen.filter.${key}`),
    count: count(key),
  }));
  const onClose = useCallback(() => onMenu(false), [onMenu]);
  const soonest = waiting
    .map((one) => one.removesAt)
    .filter((at) => at != null)
    .sort((one, other) => Date.parse(one.at) - Date.parse(other.at))[0];

  const everyone = list.members.filter((one) => memberIsShown(one.status, 'all'));
  const tones = new Map(everyone.map((one, tone) => [one.user.id, tone]));

  return (
    <>
      {props.recoveries.length > 0 && (
        <RecoveryBlock
          recoveries={props.recoveries}
          tones={tones}
          lit={props.lit}
          column={column}
          onAnswer={props.onRecovery}
          onMoveOn={props.onMoveOn}
        />
      )}
      {waiting.length > 0 && (
        <section className="desk-block">
          <Head title={t('membersScreen.waitingTitle')} />
          <ul className="desk-rows has-lead">
            {waiting.map((one, tone) => (
              <li key={one.id}>
                <WaitingRow member={one} tone={tone} onAnswer={props.onAnswer} />
              </li>
            ))}
          </ul>
          {soonest != null && (
            <p className="desk-foot">
              {t('membersScreen.waitingRemoves', { deadline: soonest.written })}
            </p>
          )}
        </section>
      )}
      <section className="desk-block">
        <Head title={t('membersScreen.peopleTitle')}>
          <Menu
            items={items}
            picked={filter}
            open={menu}
            onOpen={() => onMenu(true)}
            onClose={onClose}
            onPick={(key) => onFilter(key as MemberFilter)}
          />
        </Head>
        {filter === 'invited' && invitations.length > 0 ? (
          <>
            <InvitationRows {...props} invitations={invitations} />
            <p className="desk-foot">{t('membersScreen.invitationsNote')}</p>
          </>
        ) : filter !== 'invited' && (shown.length > 0 || moreToShow) ? (
          <>
            {shown.length > 0 && <PeopleRows key={filter} {...props} shown={shown} />}
            {moreToShow && (
              <MorePeople shown={shown.length} total={total} more={more} onMore={props.onMore} />
            )}
          </>
        ) : (
          filter !== 'all' &&
          !switching && (
            <MembersEmpty
              title={
                filter === 'invited'
                  ? t('membersScreen.noInvitations')
                  : t(`membersScreen.empty.${filter}.title`)
              }
              line={
                filter === 'invited'
                  ? undefined
                  : t(`membersScreen.empty.${filter}.body`, {
                      organisation: props.organisation.name,
                    })
              }
              onEveryone={() => onFilter('all')}
            />
          )
        )}
      </section>
      {filter === 'all' && !column && invitations.length > 0 && (
        <section className="desk-block">
          <Head title={t('membersScreen.invitations')} />
          <InvitationRows {...props} invitations={invitations} />
          <p className="desk-foot">{t('membersScreen.invitationsNote')}</p>
        </section>
      )}
    </>
  );
}

function WaitingRow({
  member,
  tone,
  onAnswer,
}: {
  member: OrganisationMember;
  tone: number;
  onAnswer: (id: string) => void;
}) {
  const { t } = useTranslation();
  const tag = memberTag(t, member);
  const asked = member.since == null ? '' : formatDay(member.since, dateLocale());

  return (
    <MemberRow
      member={member.id}
      initials={initials(member.user.name)}
      tone={tone}
      name={member.user.name}
      tag={<Tag {...tag} />}
      line={[member.user.email, t('membersScreen.when.asked', { date: asked })]
        .filter((one) => one != null && one !== '')
        .join(' · ')}
      onPress={() => onAnswer(member.id)}
    />
  );
}

/** Under the rows while more remain: their shapes while the next page comes, Show more, why it failed, and how far down the list is (sc-49170). */
function MorePeople({
  shown,
  total,
  more,
  onMore,
}: {
  shown: number;
  total: number;
  more: More;
  onMore: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="members-more">
      {more === 'loading' && (
        <ul className="desk-rows has-lead" aria-hidden="true">
          {[1, 2].map((bar) => (
            <li key={bar} className="desk-row is-bones">
              <span className="desk-sunk is-face" />
              <span className="desk-row-words">
                <span className={`desk-sunk is-title b${bar}`} />
                <span className={`desk-sunk is-line b${bar}`} />
              </span>
            </li>
          ))}
        </ul>
      )}
      <TextAction label={t('membersScreen.more.showMore')} onClick={onMore} />
      {more === 'failed' && (
        <p className="desk-error" role="alert">
          <Glyph name="alert" size={15} weight={2.2} />
          {t('membersScreen.more.failed')}
        </p>
      )}
      <p className="desk-note" role="status">
        {more === 'loading'
          ? t('membersScreen.more.loading')
          : t('membersScreen.more.showing', { shown, total })}
      </p>
    </div>
  );
}

function PeopleRows({
  shown,
  picked,
  column,
  rowsRef,
  onPerson,
  onAnswer,
}: BlocksProps & { shown: readonly OrganisationMember[] }) {
  return (
    <ul className="desk-rows has-lead" ref={rowsRef}>
      {shown.map((one, tone) => (
        <li key={one.id}>
          <PersonRow
            member={one}
            tone={tone}
            column={column}
            on={column && one.id === picked}
            onPerson={onPerson}
            onAnswer={onAnswer}
          />
        </li>
      ))}
    </ul>
  );
}

/** Drawn again only when its props change, so a page added under thousands of rows costs its own 50 (sc-49170). */
const PersonRow = memo(function PersonRow({
  member,
  tone,
  column,
  on,
  onPerson,
  onAnswer,
}: {
  member: OrganisationMember;
  tone: number;
  column: boolean;
  on: boolean;
  onPerson: (id: string) => void;
  onAnswer: (id: string) => void;
}) {
  const { t } = useTranslation();

  if (member.status === 'pending_approval') {
    return <WaitingRow member={member} tone={tone} onAnswer={onAnswer} />;
  }

  const line = [
    memberHeldNoRole(member) ? t('membersScreen.noRoleYet') : roleName(t, member.role),
    ...(member.self ? [t('membersScreen.you')] : []),
  ].join(' · ');

  return (
    <MemberRow
      member={member.id}
      initials={initials(member.user.name)}
      tone={tone}
      name={member.user.name}
      tag={member.status === 'active' ? undefined : <Tag {...memberTag(t, member)} />}
      line={line}
      {...(member.status === 'left_or_removed'
        ? {}
        : { size: column ? 'small' : 'row', on, onPress: () => onPerson(member.id) })}
    />
  );
});

/** An invitation's address, its role and sender, when it was sent and ends; Revoke while it is pending, Invite again after. */
function InvitationRows({
  organisation,
  list,
  manages,
  invitations,
  onRevoked,
  onAgain,
}: BlocksProps & { invitations: readonly SentInvitation[] }) {
  const caller = list.members.find((one) => one.self)?.user.id ?? null;

  return (
    <ul className="desk-rows">
      {invitations.map((invitation) => (
        <InvitationRow
          key={invitation.id}
          organisation={organisation}
          invitation={invitation}
          caller={caller}
          manages={manages}
          onRevoked={onRevoked}
          onAgain={() => onAgain(invitation)}
        />
      ))}
    </ul>
  );
}

function InvitationRow({
  organisation,
  invitation,
  caller,
  manages,
  onRevoked,
  onAgain,
}: {
  organisation: Membership;
  invitation: SentInvitation;
  caller: string | null;
  manages: boolean;
  onRevoked: (invitation: SentInvitation) => void;
  onAgain: () => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const day = (at: string | null) => (at == null ? '' : formatDay(at, dateLocale()));
  const role = invitation.role == null ? '' : roleName(t, invitation.role);
  const ended: Record<string, string | null> = {
    pending: invitation.expiresAt,
    expired: invitation.expiresAt,
    revoked: invitation.revokedAt,
    declined: invitation.declinedAt,
  };
  const pending = invitation.status === 'pending';

  async function revoke(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setFailed(false);

    try {
      const revoked = await api.revokeInvitation(organisation.id, invitation.id);
      onRevoked(revoked);
      focusWhenFree(() =>
        document.querySelector<HTMLElement>(`[data-invite-again="${invitation.id}"] button`),
      );
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <InvitationLine
      invitation={invitation.id}
      email={invitation.email}
      ended={pending ? undefined : t(`membersScreen.invitationState.${invitation.status}`)}
      lines={[
        invitation.invitedBy?.id === caller
          ? t('membersScreen.invitedAsByYou', { role })
          : t('membersScreen.invitedAs', { role, inviter: invitation.invitedBy?.name ?? '' }),
        invitation.undelivered && invitation.status !== 'accepted' ? (
          <NotDelivered status={invitation.status} ended={day(ended[invitation.status] ?? null)} />
        ) : (
          t(`membersScreen.dates.${invitation.status}`, {
            sent: day(invitation.sentAt),
            ended: day(ended[invitation.status] ?? null),
          })
        ),
        ...(failed ? [t('membersScreen.revokeFailed')] : []),
      ]}
    >
      {manages && (
        <span data-invite-again={pending ? undefined : invitation.id}>
          {pending ? (
            <TextAction label={t('membersScreen.revoke')} red onClick={() => void revoke()} />
          ) : (
            <TextAction label={t('membersScreen.inviteAgain')} onClick={onAgain} />
          )}
        </span>
      )}
    </InvitationLine>
  );
}

/** The broken mark before the words, as a field error has it: the mark is a shape, the words are read (sc-46109). */
function NotDelivered({ status, ended }: { status: SentInvitation['status']; ended: string }) {
  return (
    <span className="not-delivered">
      <span className="mark mark-broken" aria-hidden="true">
        ✕
      </span>
      <span>
        <Trans
          i18nKey={`membersScreen.notDelivered.${status}`}
          values={{ ended }}
          components={{ word: <span className="not-delivered-word" /> }}
        />
      </span>
    </span>
  );
}
