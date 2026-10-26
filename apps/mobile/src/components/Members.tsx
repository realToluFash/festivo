import {
  ApiError,
  type Suspension,
  type Membership,
  type MembersList,
  type OrganisationMember,
  type OrganisationRole,
} from '@soirely/api-client';
import {
  type MemberFilter,
  type MemberStanding,
  approvalRoles,
  formatDay,
  memberHeldNoRole,
  memberIsShown,
  memberRowLine,
  memberStanding,
  memberStatusWord,
  ownRoleLine,
  roleName,
} from '@soirely/domain';
import { type Ref, type RefObject, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { dateLocale } from '../i18n/index.ts';
import {
  membersAfterWrite,
  withApproved,
  withRemoved,
  withRestored,
  withRole,
  withTurnedDown,
} from '../kit/membersAfterWrite.ts';
import { refusalFor, refusalTitle } from '../kit/refusal.ts';
import { breakableEmail } from '../layout/textSize.ts';
import { type LayoutKind, useAccessibilitySizes } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { PrimaryButton, QuietButton, SecondaryButton } from './Buttons.tsx';
import { cardFrame } from './cardFrame.ts';
import { useComeForward } from './comeForward.ts';
import { FieldError } from './Field.tsx';
import { Initials } from './Initials.tsx';
import { Notice } from './Notice.tsx';
import { OwnerClaimBanner } from './OwnerClaimBanner.tsx';
import { GlyphMark, type Mark } from './StatusMark.tsx';
import { AnswerHeading } from './AnswerHeading.tsx';
import {
  type StepClosed,
  stepClosed,
  useBroughtIntoView,
  useFocusBackToOpener,
  useScrolledToTop,
} from './Screen.tsx';
import { type TextHandle, Text } from './Text.tsx';

const AVATAR = 40;
const AVATAR_LARGE = 48;

/** What answering a request to join leaves on the list (sc-392): the done line and its next step. */
export interface Answered {
  text: string;
  next: { label: string; member: string } | { label: string; filter: MemberFilter };
}

/** The web's chips less Invited and Awaiting approval: the app lists memberships, and does not invite. */
export const APP_FILTERS: readonly MemberFilter[] = ['all', 'active', 'suspended', 'former'];

export function activeCount(list: MembersList): number {
  return list.members.filter((member) => member.status === 'active').length;
}

const MEMBER_MARK = 18;

const FORMER_MARK: Mark = {
  glyph: tokens.marks.broken.glyph,
  fill: tokens.colorCard,
  ring: tokens.colorInkSecondary,
  ink: tokens.colorInkSecondary,
};

/** A member's state as a shape and a word, never colour alone. */
function MemberState({ member }: { member: OrganisationMember }) {
  const { t } = useTranslation();
  const mark =
    member.status === 'active'
      ? tokens.marks.done
      : member.status === 'pending_approval'
        ? tokens.marks.progress
        : member.status === 'suspended'
          ? tokens.marks.skipped
          : FORMER_MARK;
  const word = member.status === 'active' ? styles.wordActive : styles.wordQuiet;

  return (
    <View style={styles.state}>
      <GlyphMark mark={mark} side={MEMBER_MARK} />
      <Text size={tokens.typeSmall.size} weight="semibold" style={word}>
        {memberStatusWord(t, member)}
      </Text>
    </View>
  );
}

function Avatar({ name, large = false }: { name: string; large?: boolean }) {
  const size = large ? AVATAR_LARGE : AVATAR;
  const giveWay = useAccessibilitySizes() && !large;
  // It repeats the name beside it, and at the accessibility sizes takes the width the name needs (sc-13496).
  if (giveWay) return null;

  return (
    <View
      style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Initials
        name={name}
        size={large ? tokens.typeBodyPhone.size : tokens.typeSmall.size}
        weight="bold"
        muted
      />
    </View>
  );
}

/** Scrolled into view when it appears, since the answer was given further down the list. */
function AnsweredLine({ answered, onNext }: { answered: Answered; onNext: () => void }) {
  const top = useScrolledToTop();

  return (
    <View ref={top}>
      <Notice
        tone="done"
        mark={tokens.marks.done.glyph}
        body={answered.text}
        action={{ label: answered.next.label, onPress: onNext, testID: 'members.answered.next' }}
        answer={answered}
        takesFocus
      />
    </View>
  );
}

/** Answers a tap that may sit far below it, so it comes wholly into view and takes screen reader focus (sc-10639). */
function NoticeInView({
  tone,
  mark,
  title,
  body,
}: {
  tone: 'quiet' | 'done';
  mark: string;
  title?: string;
  body: string;
}) {
  const { shown, read } = useBroughtIntoView();

  return (
    <View ref={shown}>
      <Notice
        tone={tone}
        mark={mark}
        {...(title != null && { title })}
        body={body}
        wordsRef={read}
      />
    </View>
  );
}

/** The list half of `MembersApp-*`: the chips, the rows, and the line that says where invitations are sent. */
export function MemberList({
  kind,
  organisation,
  list,
  roles,
  manages,
  open,
  flash,
  answered,
  closed,
  title,
  onAnswered,
  onOpen,
}: {
  kind: LayoutKind;
  organisation: Membership;
  list: MembersList;
  roles: OrganisationRole[];
  manages: boolean;
  open: string | null;
  flash: string | null;
  answered: Answered | null;
  /** A member's page was left, back to their row (sc-11173). */
  closed: StepClosed | undefined;
  /** The Members heading, where focus goes when the row it was going back to has gone. */
  title: RefObject<TextHandle | null>;
  onAnswered: (list: MembersList, answered: Answered) => void;
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<MemberFilter>('all');
  const [closedFor, setClosedFor] = useState(closed);
  const [back, setBack] = useState(closed);
  const opener = useFocusBackToOpener(back, title);
  if (closedFor !== closed) {
    setClosedFor(closed);
    setBack(closed);
  }
  const shown = list.members.filter((member) => memberIsShown(member.status, filter));
  const waiting = list.members.filter((member) => member.status === 'pending_approval');
  const removedNext = t('membersScreen.removedNext');
  const count = (one: MemberFilter) =>
    list.members.filter((member) => memberIsShown(member.status, one)).length;

  return (
    <View style={styles.stack}>
      {organisation.role.seededAs === 'administrator' && (
        <OwnerClaimBanner
          kind={kind}
          organisationId={organisation.id}
          organisation={organisation.name}
          title={title}
        />
      )}

      {flash != null && (
        <Notice
          tone="done"
          mark={tokens.marks.done.glyph}
          title={flash}
          accentTitle
          body={removedNext}
          answer={flash}
          takesFocus
        />
      )}

      {answered != null && (
        <AnsweredLine
          key={answered.text}
          answered={answered}
          onNext={() => {
            const next = answered.next;
            if ('member' in next) onOpen(next.member);
            else setFilter(next.filter);
          }}
        />
      )}

      {manages && waiting.length > 0 && (
        <View style={cardFrame(kind)} testID="members.awaiting">
          <Text size={tokens.typeTitleSection.size} weight="bold" accessibilityRole="header">
            {t('membersScreen.awaiting.title')}
          </Text>
          <Text size={tokens.typeBody.size} muted>
            {t('membersScreen.awaiting.note')}
          </Text>
          {waiting.map((member, index) => (
            <View key={member.id} style={[styles.request, index > 0 && styles.rowDivider]}>
              <Pressable
                style={styles.requestHead}
                onPress={() => onOpen(member.id)}
                accessibilityRole="button"
                testID={`members.request.${member.id}`}
              >
                <Avatar name={member.user.name} />
                <View style={styles.rowText}>
                  <Text size={tokens.typeRowTitle.size} weight="semibold">
                    {member.user.name}
                  </Text>
                  {member.user.email != null && (
                    <Text size={tokens.typeBody.size} accessibilityLabel={member.user.email}>
                      {breakableEmail(member.user.email)}
                    </Text>
                  )}
                  <RequestLines organisation={organisation} member={member} />
                </View>
              </Pressable>
              <JoinRequestAnswer
                organisation={organisation}
                member={member}
                list={list}
                roles={roles}
                onAnswered={onAnswered}
              />
            </View>
          ))}
        </View>
      )}

      <View style={styles.chips}>
        {APP_FILTERS.map((one) => (
          <Pressable
            key={one}
            style={[styles.chip, filter === one && styles.chipOn]}
            onPress={() => setFilter(one)}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === one }}
            testID={`members.filter.${one}`}
          >
            <Text size={tokens.typeBody.size} weight="semibold">
              {t(`membersScreen.filter.${one}`)}
            </Text>
            <Text size={tokens.typeBody.size} weight="semibold" muted>
              {String(count(one))}
            </Text>
          </Pressable>
        ))}
      </View>

      {shown.length === 0 ? (
        <View style={styles.empty}>
          <Text size={tokens.typeBodyPhone.size} weight="semibold">
            {t(`membersScreen.empty.${filter}.title`)}
          </Text>
          {(filter === 'suspended' || filter === 'former') && (
            <Text size={tokens.typeBody.size} muted>
              {t(`membersScreen.empty.${filter}.body`, { organisation: organisation.name })}
            </Text>
          )}
          <SecondaryButton
            label={t('membersScreen.showEveryone')}
            onPress={() => {
              const first = list.members.find((member) => memberIsShown(member.status, 'all'));
              setFilter('all');
              setBack(first == null ? undefined : stepClosed(`row.${first.id}`));
            }}
            testID="members.showEveryone"
          />
        </View>
      ) : (
        <View style={styles.rows}>
          {shown.map((member, index) => (
            <MemberRow
              key={member.id}
              organisation={organisation}
              member={member}
              first={index === 0}
              open={open === member.id}
              opener={opener(`row.${member.id}`)}
              onOpen={() => onOpen(member.id)}
            />
          ))}
        </View>
      )}

      {manages && (
        <Text size={tokens.typeBody.size} muted>
          {t('membersScreen.fromTheWeb')}
        </Text>
      )}
    </View>
  );
}

function MemberRow({
  organisation,
  member,
  first,
  open,
  opener,
  onOpen,
}: {
  organisation: Membership;
  member: OrganisationMember;
  first: boolean;
  open: boolean;
  opener: Ref<View>;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const former = member.status === 'left_or_removed';
  const content = (
    <>
      <Avatar name={member.user.name} />
      <View style={styles.rowText}>
        <Text size={tokens.typeRowTitle.size} weight="semibold">
          {member.user.name}
        </Text>
        {member.user.email != null && (
          <Text size={tokens.typeBody.size} accessibilityLabel={member.user.email}>
            {breakableEmail(member.user.email)}
          </Text>
        )}
        <Text size={tokens.typeSmall.size} muted>
          {memberRowLine(t, member, organisation.name, (at) => formatDay(at, dateLocale()))}
        </Text>
        <MemberState member={member} />
      </View>
    </>
  );

  if (former) {
    return <View style={[styles.row, !first && styles.rowDivider]}>{content}</View>;
  }

  return (
    <Pressable
      ref={opener}
      style={[styles.row, !first && styles.rowDivider, open && styles.rowOpen]}
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityState={{ selected: open }}
      testID={`members.row.${member.id}`}
    >
      {content}
      <Text
        size={tokens.typeTitleDialog.size}
        muted
        accessibilityElementsHidden
        importantForAccessibility="no"
        accessible={false}
      >
        ›
      </Text>
    </Pressable>
  );
}

/** What the last restore or stale answer came to; `seen` keys each answer so its notice mounts afresh. */
type AccessOutcome = { seen: number } & (
  { kind: 'conflict' } | { kind: 'restored'; byHand: boolean; role: string }
);

type Removal = 'resting' | 'confirming' | 'removing';

/** One member, `MembersApp-*` state `member` and on: the web's `MemberDetail` without the history. */
export function MemberPage({
  kind,
  organisation,
  member,
  list,
  roles,
  withheld,
  manages,
  onChanged,
  onRemoved,
  onAnswered,
  onGoToOrganisation,
  nameRef,
}: {
  kind: LayoutKind;
  organisation: Membership;
  member: OrganisationMember;
  list: MembersList;
  roles: OrganisationRole[];
  withheld: OrganisationRole[];
  manages: boolean;
  onChanged: (list: MembersList) => void;
  onRemoved: (list: MembersList) => void;
  onAnswered: (list: MembersList, answered: Answered) => void;
  onGoToOrganisation: () => void;
  nameRef?: Ref<TextHandle> | undefined;
}) {
  const { t } = useTranslation();
  const callerOwns = organisation.role.seededAs === 'owner';
  const standing = memberStanding(member, list.members, {
    owns: callerOwns,
    manages,
    withholds: withheld,
  });
  const waiting = member.status === 'pending_approval';
  const role = memberHeldNoRole(member) ? t('membersScreen.noRoleYet') : roleName(t, member.role);
  const acts = standing === 'manageable' || standing === 'suspendedOnlyOwner';
  const [outcome, setOutcome] = useState<AccessOutcome | null>(null);
  const restored = outcome?.kind === 'restored' ? outcome : null;

  function changedElsewhere(): Promise<void> {
    // Shown once the member is reloaded, so the role card has settled under it before it is brought into view.
    return api
      .members(organisation.id)
      .then(onChanged)
      .catch(() => undefined)
      .finally(() => setOutcome((last) => ({ seen: (last?.seen ?? 0) + 1, kind: 'conflict' })));
  }

  return (
    <View style={styles.stack}>
      <View style={styles.person}>
        <Avatar name={member.user.name} large />
        <View style={styles.rowText}>
          {kind !== 'phone' && (
            <Text
              size={tokens.typeTitleDialog.size}
              weight="bold"
              accessibilityRole="header"
              ref={nameRef}
            >
              {member.user.name}
            </Text>
          )}
          <View style={styles.headLine}>
            <Text size={tokens.typeBodyPhone.size}>
              {member.self ? t('membersScreen.youAs', { role }) : role}
            </Text>
            <Text
              size={tokens.typeBodyPhone.size}
              muted
              accessibilityElementsHidden
              importantForAccessibility="no"
              accessible={false}
            >
              ·
            </Text>
            <MemberState member={member} />
          </View>
          {member.user.email != null && (
            <Text size={tokens.typeBody.size} muted accessibilityLabel={member.user.email}>
              {breakableEmail(member.user.email)}
            </Text>
          )}
        </View>
      </View>

      {outcome?.kind === 'conflict' ? (
        <NoticeInView
          key={outcome.seen}
          tone="quiet"
          mark={tokens.marks.info.glyph}
          body={t('membersScreen.accessConflict', { name: member.user.name })}
        />
      ) : (
        restored?.byHand === true && (
          <NoticeInView
            key={restored.seen}
            tone="done"
            mark={tokens.marks.done.glyph}
            title={t('membersScreen.restoredNow', { name: member.user.name, role: restored.role })}
            body={t('membersScreen.restoredNowNext', { organisation: organisation.name })}
          />
        )
      )}

      <View style={cardFrame(kind)}>
        <Text size={tokens.typeTitleSection.size} weight="bold" accessibilityRole="header">
          {t('membersScreen.roleTitle')}
        </Text>
        {waiting ? (
          <>
            <Text size={tokens.typeTitleSection.size} weight="semibold">
              {role}
            </Text>
            <RequestLines organisation={organisation} member={member} />
            {manages && (
              <JoinRequestAnswer
                organisation={organisation}
                member={member}
                list={list}
                roles={roles}
                onAnswered={onAnswered}
              />
            )}
          </>
        ) : standing === 'manageable' && member.status === 'suspended' ? (
          <>
            <Text size={tokens.typeTitleSection.size} weight="semibold">
              {role}
            </Text>
            <Text size={tokens.typeBodyPhone.size} muted>
              {t('membersScreen.roleKeptWhileSuspended')}
            </Text>
          </>
        ) : standing === 'manageable' ? (
          <RolePicker
            organisation={organisation}
            member={member}
            list={list}
            roles={roles}
            onChanged={onChanged}
            onChangedElsewhere={changedElsewhere}
          />
        ) : (
          <FixedRole
            standing={standing}
            member={member}
            role={role}
            callerOwns={callerOwns}
            onGoToOrganisation={onGoToOrganisation}
          />
        )}
      </View>

      {restored?.byHand === false ? (
        <NoticeInView
          key={restored.seen}
          tone="done"
          mark={tokens.marks.done.glyph}
          body={t('membersScreen.restored', {
            name: member.user.name,
            organisation: organisation.name,
          })}
        />
      ) : (
        member.suspension != null && (
          <Suspension
            kind={kind}
            organisation={organisation}
            member={member}
            list={list}
            suspension={member.suspension}
            standing={standing}
            acts={acts}
            onRestored={(list) => {
              onChanged(list);
              setOutcome((last) => ({
                seen: (last?.seen ?? 0) + 1,
                kind: 'restored',
                byHand: member.suspension?.reason === 'manual',
                role,
              }));
            }}
            onChangedElsewhere={changedElsewhere}
          />
        )
      )}

      {acts && !waiting && (
        <Remove
          kind={kind}
          organisation={organisation}
          member={member}
          list={list}
          onlyOwner={member.suspension?.onlyOwner === true}
          onRemoved={onRemoved}
        />
      )}
    </View>
  );
}

/** How and when somebody asked, and the instant their request is removed, as the server wrote it for the reader. */
function RequestLines({
  organisation,
  member,
}: {
  organisation: Membership;
  member: OrganisationMember;
}) {
  const { t } = useTranslation();

  return (
    <>
      <Text size={tokens.typeSmall.size} muted>
        {t('membersScreen.awaiting.asked', {
          channel: t(`membersScreen.how.${member.channel ?? 'request'}`, {
            organisation: organisation.name,
          }),
          date: member.since == null ? '' : formatDay(member.since, dateLocale()),
        })}
      </Text>
      {member.removesAt != null && (
        <Text size={tokens.typeSmall.size} muted>
          {t('membersScreen.awaiting.removes', { deadline: member.removesAt.written })}
        </Text>
      )}
    </>
  );
}

type Answering = 'resting' | 'approving' | 'turningDown';

/** Approve, with a role that starts on Read-only and always has a value, or Turn down, asked first (sc-392). */
function JoinRequestAnswer({
  organisation,
  member,
  list,
  roles,
  onAnswered,
}: {
  organisation: Membership;
  member: OrganisationMember;
  list: MembersList;
  roles: OrganisationRole[];
  onAnswered: (list: MembersList, answered: Answered) => void;
}) {
  const { t } = useTranslation();
  const offered = approvalRoles(roles);
  const [answering, setAnswering] = useState<Answering>('resting');
  const [picked, setPicked] = useState(offered[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [closed, setClosed] = useState<StepClosed | undefined>(undefined);
  const opener = useFocusBackToOpener(answering === 'resting' ? closed : undefined);
  const comeForward = useComeForward();
  const role = offered.find((one) => one.id === picked);
  const name = member.user.name;
  const read = () => api.members(organisation.id);

  async function answer(): Promise<void> {
    setBusy(true);
    setFailed(null);

    try {
      if (answering === 'approving' && role != null) {
        await api.approveMember(organisation.id, member.id, role.id);
      } else {
        await api.turnDownMember(organisation.id, member.id);
      }
    } catch (error) {
      setFailed(refusalFor(error, 'roleId', t('membersScreen.actionFailed')));
      setBusy(false);
      comeForward();
      return;
    }

    if (answering === 'approving' && role != null) {
      onAnswered(await membersAfterWrite(read, list, withApproved(member.id, role)), {
        text: t('membersScreen.awaiting.approved', { name, role: roleName(t, role) }),
        next: { label: t('membersScreen.awaiting.approvedNext', { name }), member: member.id },
      });
    } else {
      onAnswered(await membersAfterWrite(read, list, withTurnedDown(member.id)), {
        text: t('membersScreen.awaiting.turnedDown', { name }),
        next: { label: t('membersScreen.awaiting.turnedDownNext'), filter: 'former' },
      });
    }
  }

  function back(): void {
    setFailed(null);
    setClosed(stepClosed(answering === 'approving' ? 'approve' : 'turnDown'));
    setAnswering('resting');
  }

  function open(next: Answering): void {
    setClosed(undefined);
    setAnswering(next);
  }

  const refusal = failed != null && (
    <View accessibilityRole="alert">
      <FieldError message={failed} />
    </View>
  );

  if (answering === 'resting') {
    return (
      <View style={styles.actions}>
        <PrimaryButton
          ref={opener('approve')}
          label={t('membersScreen.awaiting.approve')}
          onPress={() => open('approving')}
          testID={`members.approve.${member.id}`}
        />
        <SecondaryButton
          ref={opener('turnDown')}
          label={t('membersScreen.awaiting.turnDown')}
          onPress={() => open('turningDown')}
          testID={`members.turnDown.${member.id}`}
        />
      </View>
    );
  }

  if (answering === 'turningDown') {
    return (
      <View style={styles.actions}>
        <AnswerHeading size={tokens.typeRowTitle.size} weight="bold" answer={answering}>
          {t('membersScreen.awaiting.turnDownTitle', { name })}
        </AnswerHeading>
        <Text size={tokens.typeBodyPhone.size}>
          {t('membersScreen.awaiting.turnDownBody', { name, organisation: organisation.name })}
        </Text>
        {refusal}
        <PrimaryButton
          label={t('membersScreen.awaiting.turnDownConfirm', { name })}
          busy={busy}
          onPress={() => void answer()}
          testID={`members.turnDown.confirm.${member.id}`}
        />
        <SecondaryButton
          label={t('membersScreen.awaiting.keep')}
          off={busy}
          onPress={back}
          testID={`members.turnDown.keep.${member.id}`}
        />
      </View>
    );
  }

  return (
    <View style={styles.actions}>
      <View style={styles.choices} accessibilityRole="radiogroup">
        {offered.map((one) => (
          <Pressable
            key={one.id}
            style={[styles.choice, picked === one.id && styles.choiceOn]}
            onPress={() => setPicked(one.id)}
            disabled={busy}
            accessibilityRole="radio"
            accessibilityState={{ checked: picked === one.id, disabled: busy }}
            testID={`members.approve.role.${one.seededAs ?? one.id}`}
          >
            <View style={[styles.radio, picked === one.id && styles.radioOn]}>
              {picked === one.id && <View style={styles.radioDot} />}
            </View>
            <View style={styles.rowText}>
              <Text size={tokens.typeRowTitle.size} weight="semibold">
                {roleName(t, one)}
              </Text>
              {one.seededAs != null && (
                <Text size={tokens.typeSmall.size} muted>
                  {t(`membersScreen.roleMeans.${one.seededAs}`)}
                </Text>
              )}
            </View>
          </Pressable>
        ))}
      </View>
      {refusal}
      <PrimaryButton
        label={t('membersScreen.awaiting.approveAs', {
          role: role == null ? '' : roleName(t, role),
        })}
        off={role == null}
        busy={busy}
        onPress={() => void answer()}
        testID={`members.approve.confirm.${member.id}`}
      />
      <SecondaryButton
        label={t('membersScreen.awaiting.cancel')}
        off={busy}
        onPress={back}
        testID={`members.approve.cancel.${member.id}`}
      />
    </View>
  );
}

function OwnRole({
  standing,
  onGoToOrganisation,
}: {
  standing: 'self' | 'selfOwner';
  onGoToOrganisation: () => void;
}) {
  const { t } = useTranslation();
  const line = ownRoleLine(standing);

  return (
    <>
      <Text size={tokens.typeBodyPhone.size} muted>
        {t(`membersScreen.${line.key}`)}
      </Text>
      {line.handsOn && (
        <View style={styles.start}>
          <QuietButton
            label={t('membersScreen.goToOrganisation')}
            onPress={onGoToOrganisation}
            testID="members.goToOrganisation"
          />
        </View>
      )}
    </>
  );
}

function FixedRole({
  standing,
  member,
  role,
  callerOwns,
  onGoToOrganisation,
}: {
  standing: Exclude<MemberStanding, 'manageable'>;
  member: OrganisationMember;
  role: string;
  callerOwns: boolean;
  onGoToOrganisation: () => void;
}) {
  const { t } = useTranslation();
  const name = member.user.name;

  return (
    <>
      <Text size={tokens.typeTitleSection.size} weight="semibold">
        {role}
      </Text>
      {(standing === 'self' || standing === 'selfOwner') && (
        <OwnRole standing={standing} onGoToOrganisation={onGoToOrganisation} />
      )}
      {standing === 'onlyOwner' && (
        <>
          <Notice
            tone="quiet"
            mark={tokens.marks.info.glyph}
            body={t('membersScreen.onlyOwner', { name })}
          />
          {!callerOwns && (
            <Text size={tokens.typeBody.size} muted>
              {t('membersScreen.askOwner', { name })}
            </Text>
          )}
        </>
      )}
      {member.suspension == null && <FixedLine standing={standing} />}
    </>
  );
}

/** Why a manager can't change this member: an owner's role, or one holding what the viewer lacks (sc-11160). */
function FixedLine({ standing }: { standing: MemberStanding }) {
  const { t } = useTranslation();

  if (standing !== 'ownerOnly' && standing !== 'beyondGrant') return null;

  return (
    <Text size={tokens.typeBodyPhone.size} muted>
      {t(`membersScreen.${standing}`)}
    </Text>
  );
}

/** Only the roles the caller may give are offered (sc-392); a page opened before a change still meets the API's refusal, under the button. */
function RolePicker({
  organisation,
  member,
  list,
  roles,
  onChanged,
  onChangedElsewhere,
}: {
  organisation: Membership;
  member: OrganisationMember;
  list: MembersList;
  roles: OrganisationRole[];
  onChanged: (list: MembersList) => void;
  onChangedElsewhere: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState(member.role.id);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const offered = roles.some((one) => one.id === member.role.id)
    ? roles
    : [{ ...member.role, fixed: false, removable: false, permissions: [], holders: 0 }, ...roles];
  const role = offered.find((one) => one.id === picked);
  const changed = picked !== member.role.id && role != null;

  async function save(): Promise<void> {
    if (!changed) return;

    setBusy(true);
    setFailed(null);

    try {
      await api.changeMemberRole(organisation.id, member.id, picked);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        await onChangedElsewhere();
      } else {
        setFailed(refusalTitle(error, t('membersScreen.actionFailed')));
      }
      setBusy(false);
      return;
    }

    setDone(t('membersScreen.roleChanged', { name: member.user.name, role: roleName(t, role) }));
    onChanged(
      await membersAfterWrite(() => api.members(organisation.id), list, withRole(member.id, role)),
    );
    setBusy(false);
  }

  return (
    <>
      {done != null && <NoticeInView tone="done" mark={tokens.marks.done.glyph} body={done} />}
      <View style={styles.choices} accessibilityRole="radiogroup">
        {offered.map((one) => (
          <Pressable
            key={one.id}
            style={[styles.choice, picked === one.id && styles.choiceOn]}
            onPress={() => {
              setDone(null);
              setFailed(null);
              setPicked(one.id);
            }}
            disabled={busy}
            accessibilityRole="radio"
            accessibilityState={{ checked: picked === one.id, disabled: busy }}
            testID={`members.role.${one.seededAs ?? one.id}`}
          >
            <View style={[styles.radio, picked === one.id && styles.radioOn]}>
              {picked === one.id && <View style={styles.radioDot} />}
            </View>
            <View style={styles.rowText}>
              <Text size={tokens.typeRowTitle.size} weight="semibold">
                {roleName(t, one)}
              </Text>
              {one.seededAs != null && (
                <Text size={tokens.typeSmall.size} muted>
                  {t(`membersScreen.roleMeans.${one.seededAs}`)}
                </Text>
              )}
            </View>
          </Pressable>
        ))}
      </View>
      <Text size={tokens.typeBody.size} muted>
        {t('membersScreen.roleTakesEffect')}
      </Text>
      {failed != null && (
        <View accessibilityRole="alert">
          <FieldError message={failed} />
        </View>
      )}
      <PrimaryButton
        label={
          changed
            ? t('membersScreen.roleSave', { role: roleName(t, role) })
            : t('membersScreen.rolePick')
        }
        off={!changed}
        busy={busy}
        onPress={() => void save()}
        testID="members.role.save"
      />
    </>
  );
}

/** A domain member paused when the company domain stopped bringing them in (sc-564): Restore, or Remove below; read-only to a viewer who can't act. */
function Suspension({
  kind,
  organisation,
  member,
  suspension,
  list,
  standing,
  acts,
  onRestored,
  onChangedElsewhere,
}: {
  kind: LayoutKind;
  organisation: Membership;
  member: OrganisationMember;
  list: MembersList;
  suspension: Suspension;
  standing: MemberStanding;
  acts: boolean;
  onRestored: (list: MembersList) => void;
  onChangedElsewhere: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const byHand = suspension.reason === 'manual';
  const named = {
    name: member.user.name,
    organisation: organisation.name,
    domain: suspension.domain ?? '',
  };

  async function restore(): Promise<void> {
    setBusy(true);
    setFailed(null);

    try {
      await api.restoreMember(organisation.id, member.id);
    } catch (error) {
      if (error instanceof ApiError && error.is('conflict')) {
        await onChangedElsewhere();
      } else {
        setFailed(
          error instanceof ApiError && error.is('restore_needs_address')
            ? t('membersScreen.restoreNeedsAddress', named)
            : error instanceof ApiError && error.is('team_seats_in_use')
              ? t('membersScreen.seatsInUse', { count: error.problem.limit ?? 0 })
              : refusalTitle(error, t('membersScreen.actionFailed')),
        );
      }
      setBusy(false);
      return;
    }

    onRestored(
      await membersAfterWrite(() => api.members(organisation.id), list, withRestored(member.id)),
    );
  }

  return (
    <View style={cardFrame(kind)}>
      {byHand ? (
        <>
          <Text size={tokens.typeTitleSection.size} weight="bold" accessibilityRole="header">
            {t('membersScreen.suspendedTitle', named)}
          </Text>
          <Text size={tokens.typeBodyPhone.size} muted>
            {t('membersScreen.suspendedBody', named)}
          </Text>
        </>
      ) : (
        <>
          <Notice tone="attention" mark="!" title={t('membersScreen.state.domainSuspended')} />
          <Text size={tokens.typeBodyPhone.size}>
            {t(`membersScreen.suspendedBecause.${suspension.reason}`, named)}
          </Text>
        </>
      )}
      {suspension.onlyOwner ? (
        <Text size={tokens.typeBodyPhone.size} muted>
          {t('membersScreen.suspendedOnlyOwner', named)}
        </Text>
      ) : (
        suspension.removesAt != null && (
          <Text size={tokens.typeBodyPhone.size} muted>
            {t('membersScreen.suspendedRemovedOn', { when: suspension.removesAt.written })}
          </Text>
        )
      )}
      {failed != null && (
        <View accessibilityRole="alert">
          <FieldError message={failed} />
        </View>
      )}
      {acts ? (
        <PrimaryButton
          label={t(byHand ? 'membersScreen.restoreAccess' : 'membersScreen.restore', named)}
          busy={busy}
          onPress={() => void restore()}
          testID="members.restore"
        />
      ) : (
        <FixedLine standing={standing} />
      )}
    </View>
  );
}

function Remove({
  kind,
  organisation,
  member,
  list,
  onlyOwner,
  onRemoved,
}: {
  kind: LayoutKind;
  organisation: Membership;
  member: OrganisationMember;
  list: MembersList;
  /** The suspended only Owner: Remove asks nothing first and shows the server's last_owner refusal. */
  onlyOwner: boolean;
  onRemoved: (list: MembersList) => void;
}) {
  const { t } = useTranslation();
  const [removal, setRemoval] = useState<Removal>('resting');
  const [failed, setFailed] = useState<string | null>(null);
  const [kept, setKept] = useState<StepClosed | undefined>(undefined);
  const opener = useFocusBackToOpener(removal === 'resting' ? kept : undefined);
  const name = member.user.name;
  const organisationName = organisation.name;

  async function remove(): Promise<void> {
    setRemoval('removing');
    setFailed(null);

    try {
      await api.removeMember(organisation.id, member.id);
    } catch (error) {
      setRemoval(onlyOwner ? 'resting' : 'confirming');
      setFailed(refusalTitle(error, t('membersScreen.actionFailed')));
      return;
    }

    onRemoved(
      await membersAfterWrite(() => api.members(organisation.id), list, withRemoved(member.id)),
    );
  }

  if (removal === 'resting' || (onlyOwner && removal === 'removing')) {
    return (
      <View style={cardFrame(kind)}>
        <Text size={tokens.typeTitleSection.size} weight="bold" accessibilityRole="header">
          {t('membersScreen.removeTitle', { name })}
        </Text>
        <Text size={tokens.typeBodyPhone.size} muted>
          {t('membersScreen.removeBody', { organisation: organisationName })}
        </Text>
        {onlyOwner && failed != null && (
          <View accessibilityRole="alert">
            <FieldError message={failed} />
            <Text size={tokens.typeBodyPhone.size} muted>
              {t('membersScreen.onlyOwnerNotRemovable', { name })}
            </Text>
            {member.suspension?.reason === 'address_gone' && (
              <Text size={tokens.typeBodyPhone.size} muted>
                {t('membersScreen.onlyOwnerRestoreNeedsAddress', {
                  domain: member.suspension.domain ?? '',
                })}
              </Text>
            )}
          </View>
        )}
        <SecondaryButton
          ref={opener('remove')}
          label={t('membersScreen.removeButton', { organisation: organisationName })}
          off={removal === 'removing'}
          onPress={() => {
            setKept(undefined);
            if (onlyOwner) void remove();
            else setRemoval('confirming');
          }}
          testID="members.remove"
        />
      </View>
    );
  }

  return (
    <View style={cardFrame(kind)}>
      <AnswerHeading size={tokens.typeTitleDialog.size} weight="bold" answer="confirming">
        {t('membersScreen.removeConfirmTitle', { name })}
      </AnswerHeading>
      <Text size={tokens.typeBodyPhone.size}>
        {t('membersScreen.removeConfirmBody', { name, organisation: organisationName })}
      </Text>
      {failed != null && (
        <View accessibilityRole="alert">
          <FieldError message={failed} />
        </View>
      )}
      <View style={styles.actions}>
        <PrimaryButton
          label={t('membersScreen.removeConfirm', { name })}
          busy={removal === 'removing'}
          onPress={() => void remove()}
          testID="members.remove.confirm"
        />
        <SecondaryButton
          label={t('membersScreen.removeKeep', { name })}
          onPress={() => {
            setFailed(null);
            setKept(stepClosed('remove'));
            setRemoval('resting');
          }}
          testID="members.remove.keep"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: tokens.spaceLg },
  start: { alignSelf: 'flex-start' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceXs },
  chip: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    paddingHorizontal: 14,
    paddingVertical: tokens.spaceXxs,
    borderRadius: tokens.radiusPill,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
    backgroundColor: tokens.colorCard,
  },
  chipOn: {
    borderWidth: 2,
    borderColor: tokens.colorAccent,
    backgroundColor: tokens.colorAccentTint,
  },
  empty: {
    gap: tokens.spaceSm,
    paddingVertical: 14,
    paddingHorizontal: tokens.spaceXl,
    borderRadius: tokens.radiusInset,
    borderWidth: 1,
    borderColor: tokens.colorInsetBorder,
    backgroundColor: tokens.colorInset,
  },
  rows: {
    paddingVertical: tokens.spaceXxs,
    paddingHorizontal: tokens.spaceSm,
    borderRadius: tokens.radiusCardPhone,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceLg,
    paddingVertical: tokens.spaceLg,
    paddingHorizontal: tokens.spaceSm,
    borderRadius: tokens.radiusField,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: tokens.colorInsetBorder },
  request: { gap: tokens.spaceMd, paddingVertical: tokens.spaceMd },
  requestHead: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceLg },
  rowOpen: { backgroundColor: tokens.colorAccentTint },
  rowText: { flex: 1, minWidth: 0, gap: 3 },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorNeutralFill,
  },
  state: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    marginTop: tokens.spaceHair,
  },
  wordActive: { color: tokens.colorAccentText },
  wordQuiet: { color: tokens.colorInkSecondary },
  person: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceLg },
  headLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceSm },
  choices: { gap: tokens.spaceXs },
  choice: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    paddingVertical: tokens.spaceSm,
    paddingHorizontal: 14,
    borderRadius: tokens.radiusInset,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
    backgroundColor: tokens.colorCard,
  },
  choiceOn: {
    borderWidth: 2,
    borderColor: tokens.colorAccent,
    backgroundColor: tokens.colorAccentTint,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: tokens.colorControlBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorCard,
  },
  radioOn: { borderColor: tokens.colorAccent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: tokens.colorAccent },
  actions: { gap: tokens.spaceSm },
});
