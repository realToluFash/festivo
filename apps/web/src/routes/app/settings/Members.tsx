import {
  type Membership,
  type MembersList,
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
  roleName,
} from '@soirely/domain';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { Refreshing } from '../../../components/OfflineBand.tsx';
import {
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
import { MembersLoading } from '../../../components/MembersParts.tsx';
import { useOwnerClaim } from './MembersClaim.tsx';
import { InviteDialog, RequestDialog } from './MembersDialogs.tsx';
import { RecoveryAsk, RecoveryBlock } from './MembersRecovery.tsx';
import { backToMakeOwner } from './ownerReturn.ts';
import { memberTag } from './memberWords.ts';
import '../../../components/SettingsParts.css';
import './members.css';

type Load =
  | { kind: 'loading' }
  | { kind: 'failed'; retried: boolean }
  | {
      kind: 'loaded';
      list: MembersList;
      roles: OrganisationRole[];
      recoveries: RecoveryRequest[];
    };

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

    watch(
      Promise.all([
        api.members(organisationId),
        api.roles(organisationId),
        manages ? api.recoveryRequests() : Promise.resolve([]),
      ]),
    ).then(
      ([list, catalogue, recoveries]) => {
        if (!current) return;
        loadedFor.current = organisationId;
        setLoad({
          kind: 'loaded',
          list,
          roles: catalogue.roles,
          recoveries: recoveryShownIn(recoveries, organisationId),
        });
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
    heading.current = title() as HTMLHeadingElement | null;
  });

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
              <div className="desk-failed" role={load.retried ? undefined : 'alert'}>
                <h2 ref={failedTitle} tabIndex={-1}>
                  {t('membersScreen.failedTitle')}
                </h2>
                <p className="desk-line">{t('membersScreen.failedLine')}</p>
                <TextAction
                  label={t('membersScreen.retry')}
                  onClick={() => {
                    retrying.current = true;
                    setLoad({ kind: 'loading' });
                    setAttempt((n) => n + 1);
                  }}
                />
              </div>
            </Column>
          )}
          {load.kind === 'loaded' && (
            <MembersLoaded
              key={organisation.id}
              organisation={organisation}
              list={load.list}
              roles={load.roles}
              recoveries={load.recoveries}
              manages={manages}
              onChange={(list) =>
                setLoad((was) => (was.kind === 'loaded' ? { ...was, list } : was))
              }
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

function Column({ children }: { children: ReactNode }) {
  return <div className="desk-column">{children}</div>;
}

function MembersLoaded({
  organisation,
  list,
  roles,
  recoveries,
  manages,
  onChange,
  onRecoveries,
}: {
  organisation: Membership;
  list: MembersList;
  roles: OrganisationRole[];
  recoveries: RecoveryRequest[];
  manages: boolean;
  onChange: (list: MembersList) => void;
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
  const person = open == null ? null : (list.members.find((one) => one.id === open) ?? null);

  // Removed only once committed: React may abandon a render and run the initializer again.
  useEffect(() => {
    if (returned != null) dropProviderReturn();
  }, [returned]);

  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    if (toSays.current) focusWhenFree(cardWords);
    else if (!split || open == null) title()?.focus();
    toSays.current = false;
  }, [open, split]);

  const openPerson = (id: string) => {
    moved.current = true;
    setOpen(id);
    setNotice(null);
  };
  const back = () => {
    moved.current = true;
    setOpen(null);
  };
  const answer = (id: string) => setDialog({ kind: 'request', id });
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
        return setFilter('former');
      case 'become':
        return claim.become();
      case 'check':
        return claim.check();
    }
  };
  const close = useCallback(() => setDialog(null), []);
  const asking =
    dialog?.kind === 'request' ? list.members.find((one) => one.id === dialog.id) : undefined;
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
    onFilter: setFilter,
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
            setFilter('all');
            close();
          }}
        />
      )}
      {asking != null && (
        <RequestDialog
          organisation={organisation}
          member={asking}
          roles={granted}
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
        onChanged={onChange}
        onRemoved={(changed, name) => {
          onChange(changed);
          onRecoveries(recoveryEndedByRemoval(recoveries, person.user.id));
          setNotice({ kind: 'removed', name });
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
          <MembersCardView card={card} size="column" onStep={step} />
          {claim.under}
          <MembersBlocks {...blocks} column />
        </div>
        <div className="members-side">
          {desk.offline}
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
      <MembersCardView card={card} onStep={step} />
      {claim.under}
      <MembersBlocks {...blocks} column={false} />
      {dialogs}
    </Column>
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
          {card.faces.map((face, tone) => (
            <Avatar key={face.id} initials={initials(face.user.name)} tone={tone} size="face" />
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
  organisation: Membership;
  list: MembersList;
  recoveries: readonly RecoveryRequest[];
  lit: string | null;
  manages: boolean;
  filter: MemberFilter;
  menu: boolean;
  picked: string | null;
  column: boolean;
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
  const shown = list.members.filter((one) => memberIsShown(one.status, filter));
  const count = (one: MemberFilter) =>
    one === 'invited'
      ? invitations.filter((invitation) => invitation.status === 'pending').length
      : list.members.filter((member) => memberIsShown(member.status, one)).length;
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
        ) : filter !== 'invited' && shown.length > 0 ? (
          <PeopleRows {...props} shown={shown} />
        ) : (
          filter !== 'all' && (
            <div className="desk-empty">
              <p className="desk-empty-title">
                {filter === 'invited'
                  ? t('membersScreen.noInvitations')
                  : t(`membersScreen.empty.${filter}.title`)}
              </p>
              {filter !== 'invited' && (
                <p className="desk-line">
                  {t(`membersScreen.empty.${filter}.body`, {
                    organisation: props.organisation.name,
                  })}
                </p>
              )}
              <TextAction label={t('membersScreen.showEveryone')} onClick={() => onFilter('all')} />
            </div>
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
    <button
      type="button"
      className="desk-row"
      data-member={member.id}
      onClick={() => onAnswer(member.id)}
    >
      <Avatar initials={initials(member.user.name)} tone={tone} />
      <RowWords
        title={member.user.name}
        tag={<Tag {...tag} />}
        lines={[
          [member.user.email, t('membersScreen.when.asked', { date: asked })]
            .filter((one) => one != null && one !== '')
            .join(' · '),
        ]}
      />
      <Chevron />
    </button>
  );
}

function PeopleRows({
  shown,
  picked,
  column,
  onPerson,
  onAnswer,
}: BlocksProps & { shown: readonly OrganisationMember[] }) {
  const { t } = useTranslation();

  return (
    <ul className="desk-rows has-lead">
      {shown.map((one, tone) => {
        const tag = one.status === 'active' ? undefined : <Tag {...memberTag(t, one)} />;
        const line = [
          memberHeldNoRole(one) ? t('membersScreen.noRoleYet') : roleName(t, one.role),
          ...(one.self ? [t('membersScreen.you')] : []),
        ].join(' · ');
        const on = column && one.id === picked;

        return (
          <li key={one.id}>
            {one.status === 'pending_approval' ? (
              <WaitingRow member={one} tone={tone} onAnswer={onAnswer} />
            ) : one.status === 'left_or_removed' ? (
              <div className="desk-row" data-member={one.id}>
                <Avatar initials={initials(one.user.name)} tone={tone} />
                <RowWords title={one.user.name} tag={tag} lines={[line]} />
              </div>
            ) : (
              <button
                type="button"
                className={on ? 'desk-row is-on' : 'desk-row'}
                aria-current={on || undefined}
                data-member={one.id}
                onClick={() => onPerson(one.id)}
              >
                <Avatar
                  initials={initials(one.user.name)}
                  tone={tone}
                  size={column ? 'small' : 'row'}
                />
                <RowWords title={one.user.name} tag={tag} lines={[line]} />
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
    <li className="desk-row">
      <RowWords
        title={invitation.email}
        tag={
          pending ? undefined : (
            <Tag kind="ended" word={t(`membersScreen.invitationState.${invitation.status}`)} />
          )
        }
        lines={[
          invitation.invitedBy?.id === caller
            ? t('membersScreen.invitedAsByYou', { role })
            : t('membersScreen.invitedAs', { role, inviter: invitation.invitedBy?.name ?? '' }),
          t(`membersScreen.dates.${invitation.status}`, {
            sent: day(invitation.sentAt),
            ended: day(ended[invitation.status] ?? null),
          }),
          ...(failed ? [t('membersScreen.revokeFailed')] : []),
        ]}
      />
      {manages && (
        <span data-invite-again={pending ? undefined : invitation.id}>
          {pending ? (
            <TextAction label={t('membersScreen.revoke')} red onClick={() => void revoke()} />
          ) : (
            <TextAction label={t('membersScreen.inviteAgain')} onClick={onAgain} />
          )}
        </span>
      )}
    </li>
  );
}
