import type {
  Membership,
  MembersList,
  OrganisationMember,
  OrganisationRole,
} from '@soirely/api-client';
import {
  type MemberFilter,
  type MemberStanding,
  formatDay,
  initials,
  memberIsShown,
  memberRowLine,
  memberStanding,
  memberStatusWord,
  roleName,
} from '@soirely/domain';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { currentLocale } from '../i18n/index.ts';
import { membersAfterWrite, withRemoved, withRole } from '../kit/membersAfterWrite.ts';
import { refusalTitle } from '../kit/refusal.ts';
import { type LayoutKind } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { PrimaryButton, QuietButton, SecondaryButton } from './Buttons.tsx';
import { cardFrame } from './cardFrame.ts';
import { FieldError } from './Field.tsx';
import { Notice } from './Notice.tsx';
import { Text } from './Text.tsx';

const AVATAR = 40;
const AVATAR_LARGE = 48;

/** The web's chips less Invited and Awaiting approval: the app lists memberships, and does not invite. */
export const APP_FILTERS: readonly MemberFilter[] = ['all', 'active', 'suspended', 'former'];

export function activeCount(list: MembersList): number {
  return list.members.filter((member) => member.status === 'active').length;
}

const FORMER_MARK = {
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
      <View style={[styles.mark, { backgroundColor: mark.fill, borderColor: mark.ring }]}>
        <Text
          size={tokens.typeMeta.size}
          weight="bold"
          style={{ color: mark.ink }}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          {mark.glyph}
        </Text>
      </View>
      <Text size={tokens.typeSmall.size} weight="semibold" style={word}>
        {memberStatusWord(t, member)}
      </Text>
    </View>
  );
}

function Avatar({ name, large = false }: { name: string; large?: boolean }) {
  const size = large ? AVATAR_LARGE : AVATAR;

  return (
    <View
      style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <Text size={large ? tokens.typeBodyPhone.size : tokens.typeSmall.size} weight="bold" muted>
        {initials(name)}
      </Text>
    </View>
  );
}

/** The list half of `MembersApp-*`: the chips, the rows, and the line that says where invitations are sent. */
export function MemberList({
  organisation,
  list,
  manages,
  open,
  flash,
  onOpen,
}: {
  organisation: Membership;
  list: MembersList;
  manages: boolean;
  open: string | null;
  flash: string | null;
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<MemberFilter>('all');
  const shown = list.members.filter((member) => memberIsShown(member.status, filter));
  const count = (one: MemberFilter) =>
    list.members.filter((member) => memberIsShown(member.status, one)).length;

  return (
    <View style={styles.stack}>
      {flash != null && (
        <View accessibilityLiveRegion="polite">
          <Notice
            tone="done"
            mark={tokens.marks.done.glyph}
            title={flash}
            accentTitle
            body={t('membersScreen.removedNext')}
          />
        </View>
      )}

      <View style={styles.chips} accessibilityLabel={t('membersScreen.show')}>
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
            onPress={() => setFilter('all')}
            testID="members.showEveryone"
          />
        </View>
      ) : (
        <View style={styles.rows} accessibilityLabel={t('membersScreen.shown')}>
          {shown.map((member, index) => (
            <MemberRow
              key={member.id}
              organisation={organisation}
              member={member}
              first={index === 0}
              open={open === member.id}
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
  onOpen,
}: {
  organisation: Membership;
  member: OrganisationMember;
  first: boolean;
  open: boolean;
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
        {member.user.email != null && <Text size={tokens.typeBody.size}>{member.user.email}</Text>}
        <Text size={tokens.typeSmall.size} muted>
          {memberRowLine(t, member, organisation.name, (at) => formatDay(at, currentLocale()))}
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
      >
        ›
      </Text>
    </Pressable>
  );
}

type Removal = 'resting' | 'confirming' | 'removing';

/** One member, `MembersApp-*` state `member` and on: the web's `MemberDetail` without the history. */
export function MemberPage({
  kind,
  organisation,
  member,
  list,
  roles,
  manages,
  onChanged,
  onRemoved,
  onGoToOrganisation,
}: {
  kind: LayoutKind;
  organisation: Membership;
  member: OrganisationMember;
  list: MembersList;
  roles: OrganisationRole[];
  manages: boolean;
  onChanged: (list: MembersList) => void;
  onRemoved: (list: MembersList) => void;
  onGoToOrganisation: () => void;
}) {
  const { t } = useTranslation();
  const callerOwns = organisation.role.seededAs === 'owner';
  const standing = memberStanding(member, list.members, { owns: callerOwns, manages });
  const role = roleName(t, member.role);

  return (
    <View style={styles.stack}>
      <View style={styles.person}>
        <Avatar name={member.user.name} large />
        <View style={styles.rowText}>
          {kind !== 'phone' && (
            <Text size={tokens.typeTitleDialog.size} weight="bold" accessibilityRole="header">
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
            >
              ·
            </Text>
            <MemberState member={member} />
          </View>
          {member.user.email != null && (
            <Text size={tokens.typeBody.size} muted>
              {member.user.email}
            </Text>
          )}
        </View>
      </View>

      <View style={cardFrame(kind)}>
        <Text size={tokens.typeTitleSection.size} weight="bold" accessibilityRole="header">
          {t('membersScreen.roleTitle')}
        </Text>
        {standing === 'manageable' ? (
          <RolePicker
            organisation={organisation}
            member={member}
            list={list}
            roles={roles}
            onChanged={onChanged}
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

      {standing === 'manageable' && (
        <Remove
          kind={kind}
          organisation={organisation}
          member={member}
          list={list}
          onRemoved={onRemoved}
        />
      )}
    </View>
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
      {standing === 'self' && (
        <>
          <Text size={tokens.typeBodyPhone.size} muted>
            {t('membersScreen.ownRole')}
          </Text>
          <View style={styles.start}>
            <QuietButton
              label={t('membersScreen.goToOrganisation')}
              onPress={onGoToOrganisation}
              testID="members.goToOrganisation"
            />
          </View>
        </>
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
      {standing === 'ownerOnly' && (
        <Text size={tokens.typeBodyPhone.size} muted>
          {t('membersScreen.ownerOnly')}
        </Text>
      )}
    </>
  );
}

/** Every role is offered, Owner too: the API answers a grant the caller may not make, under the button. */
function RolePicker({
  organisation,
  member,
  list,
  roles,
  onChanged,
}: {
  organisation: Membership;
  member: OrganisationMember;
  list: MembersList;
  roles: OrganisationRole[];
  onChanged: (list: MembersList) => void;
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
      setFailed(refusalTitle(error, t('membersScreen.actionFailed')));
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
      {done != null && (
        <View accessibilityLiveRegion="polite">
          <Notice tone="done" mark={tokens.marks.done.glyph} body={done} />
        </View>
      )}
      <View
        style={styles.choices}
        accessibilityRole="radiogroup"
        accessibilityLabel={t('membersScreen.roleFor', { name: member.user.name })}
      >
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

function Remove({
  kind,
  organisation,
  member,
  list,
  onRemoved,
}: {
  kind: LayoutKind;
  organisation: Membership;
  member: OrganisationMember;
  list: MembersList;
  onRemoved: (list: MembersList) => void;
}) {
  const { t } = useTranslation();
  const [removal, setRemoval] = useState<Removal>('resting');
  const [failed, setFailed] = useState<string | null>(null);
  const name = member.user.name;
  const organisationName = organisation.name;

  async function remove(): Promise<void> {
    setRemoval('removing');
    setFailed(null);

    try {
      await api.removeMember(organisation.id, member.id);
    } catch (error) {
      setRemoval('confirming');
      setFailed(refusalTitle(error, t('membersScreen.actionFailed')));
      return;
    }

    onRemoved(
      await membersAfterWrite(() => api.members(organisation.id), list, withRemoved(member.id)),
    );
  }

  if (removal === 'resting') {
    return (
      <View style={cardFrame(kind)}>
        <Text size={tokens.typeTitleSection.size} weight="bold" accessibilityRole="header">
          {t('membersScreen.removeTitle', { name })}
        </Text>
        <Text size={tokens.typeBodyPhone.size} muted>
          {t('membersScreen.removeBody', { organisation: organisationName })}
        </Text>
        <SecondaryButton
          label={t('membersScreen.removeButton', { organisation: organisationName })}
          onPress={() => setRemoval('confirming')}
          testID="members.remove"
        />
      </View>
    );
  }

  return (
    <View style={cardFrame(kind)}>
      <Text size={tokens.typeTitleDialog.size} weight="bold" accessibilityRole="header">
        {t('membersScreen.removeConfirmTitle', { name })}
      </Text>
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
    height: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    paddingHorizontal: 14,
    borderRadius: tokens.sizeHit / 2,
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
  mark: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
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
