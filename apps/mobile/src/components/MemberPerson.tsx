import {
  ApiError,
  type Membership,
  type MembersList,
  type OrganisationMember,
  type OrganisationRole,
} from '@soirely/api-client';
import {
  formatDay,
  type MemberStanding,
  memberChannelWords,
  memberStanding,
  memberStatusWord,
} from '@soirely/domain';
import type { TFunction } from 'i18next';
import { type Ref, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type ViewInstance } from 'react-native';

import { api } from '../api.ts';
import { dateLocale } from '../i18n/index.ts';
import { membersAfterWrite, withRemoved, withRestored } from '../kit/membersAfterWrite.ts';
import { firstName, memberMark, memberRole, whenKey } from '../kit/membersSummary.ts';
import { refusalTitle } from '../kit/refusal.ts';
import { FieldError } from './Field.tsx';
import { RoleScreen } from './MemberRole.tsx';
import { readOut } from './ReadOut.tsx';
import {
  Ask,
  CardFace,
  CardSays,
  GlassTag,
  Line,
  OnCard,
  Row,
  RowList,
  Section,
  SummaryCard,
  TextAction,
} from './Summary.tsx';
import type { TextHandle } from './Text.tsx';

/** Who they are on the card with the one next step, the details, why their role is fixed, and removing them. */
export function PersonBody({
  pane,
  organisation,
  member,
  list,
  roles,
  withheld,
  manages,
  nameRef,
  onChanged,
  onRemoved,
  onGoToOrganisation,
}: {
  pane: boolean;
  organisation: Membership;
  member: OrganisationMember;
  list: MembersList;
  roles: readonly OrganisationRole[];
  withheld: readonly OrganisationRole[];
  manages: boolean;
  nameRef?: Ref<TextHandle> | undefined;
  onChanged: (list: MembersList) => void;
  onRemoved: (list: MembersList, name: string) => void;
  onGoToOrganisation: () => void;
}) {
  const { t } = useTranslation();
  const callerOwns = organisation.role.seededAs === 'owner';
  const standing = memberStanding(member, list.members, {
    owns: callerOwns,
    manages,
    withholds: withheld,
  });
  const acts = standing === 'manageable' || standing === 'suspendedOnlyOwner';
  const suspendedNow = member.status === 'suspended';
  const changes = standing === 'manageable' && !suspendedNow;
  const waiting = member.status === 'pending_approval';
  const former = member.status === 'left_or_removed';
  const name = member.user.name;
  const first = firstName(name);
  const [said, setSaid] = useState<readonly string[]>([]);
  const [roleVisit, setRoleVisit] = useState(0);
  const [roleOpen, setRoleOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [refused, setRefused] = useState<{ on: 'restore' | 'remove'; words: string } | null>(null);
  const stepRef = useRef<ViewInstance>(null);
  const removeRef = useRef<ViewInstance>(null);
  const named = {
    name,
    organisation: organisation.name,
    domain: member.suspension?.domain ?? '',
  };

  function tell(lines: readonly string[]): void {
    setSaid(lines);
    readOut(lines.join(' '));
  }

  function changedElsewhere(): void {
    void api
      .members(organisation.id)
      .then(onChanged)
      .catch(() => undefined)
      .finally(() => tell([t('membersScreen.accessConflict', { name })]));
  }

  async function restore(): Promise<void> {
    const byHand = member.suspension?.reason === 'manual';
    setRestoring(true);
    setRefused(null);
    try {
      await api.restoreMember(organisation.id, member.id);
    } catch (error) {
      setRestoring(false);
      if (error instanceof ApiError && error.is('conflict')) {
        changedElsewhere();
        return;
      }
      setRefused({
        on: 'restore',
        words:
          error instanceof ApiError && error.is('restore_needs_address')
            ? t('membersScreen.restoreNeedsAddress', named)
            : error instanceof ApiError && error.is('team_seats_in_use')
              ? t('membersScreen.seatsInUse', { count: error.problem.limit ?? 0 })
              : refusalTitle(error, t('membersScreen.actionFailed')),
      });
      return;
    }
    const role = memberRole(t, member);
    onChanged(
      await membersAfterWrite(() => api.members(organisation.id), list, withRestored(member.id)),
    );
    setRestoring(false);
    tell(
      byHand
        ? [
            t('membersScreen.restoredNow', { name, role }),
            t('membersScreen.restoredNowNext', { organisation: organisation.name }),
          ]
        : [t('membersScreen.restored', { name, organisation: organisation.name })],
    );
  }

  async function remove(): Promise<void> {
    setRemoveBusy(true);
    setRefused(null);
    try {
      await api.removeMember(organisation.id, member.id);
    } catch (error) {
      setRemoveBusy(false);
      setRefused({ on: 'remove', words: refusalTitle(error, t('membersScreen.actionFailed')) });
      return;
    }
    onRemoved(
      await membersAfterWrite(() => api.members(organisation.id), list, withRemoved(member.id)),
      name,
    );
  }

  const step = changes
    ? {
        label: t('membersScreen.changeRole'),
        onPress: () => {
          setSaid([]);
          setRoleVisit((count) => count + 1);
          setRoleOpen(true);
        },
        testID: 'members.changeRole',
        ref: stepRef,
      }
    : suspendedNow && acts
      ? {
          label: t(
            member.suspension?.reason === 'manual'
              ? 'membersScreen.restoreAccess'
              : 'membersScreen.restore',
            named,
          ),
          onPress: () => void restore(),
          testID: 'members.restore',
          ref: stepRef,
          busy: restoring,
        }
      : null;
  const lines =
    said.length > 0 ? said : suspendedNow ? suspensionLines(t, member, standing, acts, named) : [];
  const onlyOwnerSuspended = member.suspension?.onlyOwner === true;
  const asked = member.since == null ? '' : formatDay(member.since, dateLocale());

  return (
    <>
      <SummaryCard height={pane ? 196 : 216} step={step} testID={`members.person.${member.id}`}>
        <View style={styles.who}>
          <CardFace name={name} side={pane ? 64 : 56} />
          <View style={styles.whoWords}>
            <CardSays ref={nameRef} text={name} size={pane ? 26 : 22} heading />
            {member.user.email != null && <OnCard text={member.user.email} />}
          </View>
        </View>
        <View style={styles.tags}>
          <GlassTag word={memberRole(t, member)} />
          <GlassTag word={memberStatusWord(t, member)} mark={memberMark(member)} />
        </View>
        {lines.map((line) => (
          <OnCard key={line} text={line} />
        ))}
      </SummaryCard>
      {refused?.on === 'restore' && (
        <View accessibilityRole="alert">
          <FieldError message={refused.words} />
        </View>
      )}
      <Section title={t('membersScreen.details')}>
        <RowList
          items={[
            {
              key: 'how',
              row: (
                <Row
                  title={memberChannelWords(t, member, organisation.name)}
                  line={t('membersScreen.howJoined')}
                  weight="medium"
                />
              ),
            },
            ...(asked === ''
              ? []
              : [
                  {
                    key: 'when',
                    row: <Row title={asked} line={t(whenKey(member))} weight="medium" />,
                  },
                ]),
          ]}
        />
      </Section>
      {!waiting && !former && (
        <FixedRole
          standing={standing}
          member={member}
          callerOwns={callerOwns}
          suspended={suspendedNow}
          onGoToOrganisation={onGoToOrganisation}
        />
      )}
      {acts && !waiting && (
        <View>
          <TextAction
            ref={removeRef}
            label={t('membersScreen.removeButtonOpen', { organisation: organisation.name })}
            removes
            off={removeBusy}
            onPress={() => {
              setRefused(null);
              if (onlyOwnerSuspended) void remove();
              else setRemoving(true);
            }}
            consequence={t('membersScreen.removeBody', { organisation: organisation.name })}
            testID="members.remove"
          />
          {onlyOwnerSuspended && refused?.on === 'remove' && (
            <View accessibilityRole="alert" style={styles.lines}>
              <FieldError message={refused.words} />
              <Line text={t('membersScreen.onlyOwnerNotRemovable', { name })} />
              {member.suspension?.reason === 'address_gone' && (
                <Line
                  text={t('membersScreen.onlyOwnerRestoreNeedsAddress', {
                    domain: member.suspension.domain ?? '',
                  })}
                />
              )}
            </View>
          )}
        </View>
      )}
      <Ask
        open={removing}
        opener={removeRef}
        title={t('membersScreen.removeAsk', { name, organisation: organisation.name })}
        line={t('membersScreen.removeBody', { organisation: organisation.name })}
        keep={{
          label: t('membersScreen.removeKeep', { name: first }),
          testID: 'members.remove.keep',
          off: removeBusy,
        }}
        confirm={{
          label: t('membersScreen.removeVerb'),
          testID: 'members.remove.confirm',
          removes: true,
          busy: removeBusy ? t('membersScreen.removing') : undefined,
        }}
        failed={!onlyOwnerSuspended && refused?.on === 'remove' ? refused.words : null}
        onKeep={() => {
          if (removeBusy) return;
          setRefused(null);
          setRemoving(false);
        }}
        onConfirm={() => void remove()}
        testID="members.remove.ask"
      />
      {changes && (
        <RoleScreen
          key={roleVisit}
          organisation={organisation}
          member={member}
          list={list}
          roles={roles}
          open={roleOpen}
          opener={stepRef}
          onClose={() => setRoleOpen(false)}
          onChanged={(next, words) => {
            setRoleOpen(false);
            onChanged(next);
            tell([words]);
          }}
          onChangedElsewhere={() => {
            setRoleOpen(false);
            changedElsewhere();
          }}
        />
      )}
    </>
  );
}

function suspensionLines(
  t: TFunction,
  member: OrganisationMember,
  standing: MemberStanding,
  acts: boolean,
  named: { name: string; organisation: string; domain: string },
): string[] {
  const suspension = member.suspension;
  if (suspension == null) return [];
  const why =
    suspension.reason === 'manual'
      ? [t('membersScreen.suspendedBody', named)]
      : [t(`membersScreen.suspendedBecause.${suspension.reason}`, named)];
  const after = suspension.onlyOwner
    ? [t('membersScreen.suspendedOnlyOwner', named)]
    : suspension.removesAt == null
      ? []
      : [t('membersScreen.suspendedRemovedOn', { when: suspension.removesAt.written })];
  const cannot =
    acts || (standing !== 'ownerOnly' && standing !== 'beyondGrant')
      ? []
      : [t(`membersScreen.${standing}`)];

  return [...why, ...after, ...cannot];
}

/** Why the role cannot change here, under Details. */
function FixedRole({
  standing,
  member,
  callerOwns,
  suspended,
  onGoToOrganisation,
}: {
  standing: MemberStanding;
  member: OrganisationMember;
  callerOwns: boolean;
  suspended: boolean;
  onGoToOrganisation: () => void;
}) {
  const { t } = useTranslation();
  const name = member.user.name;

  switch (standing) {
    case 'selfOwner':
      return (
        <View>
          <Line text={t('membersScreen.ownRole')} />
          <TextAction
            label={t('membersScreen.goToOrganisationPlain')}
            after="chevron"
            onPress={onGoToOrganisation}
            testID="members.goToOrganisation"
          />
        </View>
      );
    case 'self':
      return <Line text={t('membersScreen.ownRoleOwnerCan')} />;
    case 'onlyOwner':
      return (
        <View style={styles.lines}>
          <Line text={t('membersScreen.onlyOwner', { name })} />
          {!callerOwns && <Line text={t('membersScreen.askOwner', { name })} />}
        </View>
      );
    case 'ownerOnly':
    case 'beyondGrant':
      return suspended ? null : <Line text={t(`membersScreen.${standing}`)} />;
    case 'manageable':
      return suspended ? <Line text={t('membersScreen.roleKeptWhileSuspended')} /> : null;
    case 'suspendedOnlyOwner':
    case 'readOnly':
      return null;
  }
}

const styles = StyleSheet.create({
  who: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  whoWords: { flex: 1, minWidth: 0, gap: 2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  lines: { gap: 8 },
});
