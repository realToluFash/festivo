import {
  ApiError,
  type LedEvent,
  type Membership,
  type MembersList,
  type OrganisationMember,
  type OrganisationRole,
} from '@soirely/api-client';
import {
  formatDay,
  type LimitRefusal,
  limitRefusalOf,
  type MemberStanding,
  memberChannelWords,
  memberStanding,
  memberStatusWord,
  roleHolds,
} from '@soirely/domain';
import type { TFunction } from 'i18next';
import { type Ref, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type ViewInstance } from 'react-native';

import { api } from '../api.ts';
import { dateLocale } from '../i18n/index.ts';
import { membersAfterWrite, withRemoved, withRestored } from '../kit/membersAfterWrite.ts';
import { memberMark, memberRole, whenKey } from '../kit/membersSummary.ts';
import { refusalTitle } from '../kit/refusal.ts';
import { FieldError } from './Field.tsx';
import { LeadsBlock, LeadsNotIn } from './Handover.tsx';
import { type Handed, MemberHandover } from './MemberHandover.tsx';
import { LimitRefusalSheet } from './LimitRefusal.tsx';
import { RoleScreen } from './MemberRole.tsx';
import { readOut } from './ReadOut.tsx';
import {
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
  reread,
  roles,
  withheld,
  manages,
  nameRef,
  onChanged,
  onRemoved,
  onGoToOrganisation,
  onMembers,
}: {
  pane: boolean;
  organisation: Membership;
  member: OrganisationMember;
  list: MembersList;
  /** Every row the screen holds, as they now are. */
  /** The rows on screen read again after a change to `changed`, with their row as it now is wherever it is held. */
  reread: (changed: string) => Promise<MembersList>;
  roles: readonly OrganisationRole[];
  withheld: readonly OrganisationRole[];
  manages: boolean;
  nameRef?: Ref<TextHandle> | undefined;
  onChanged: (list: MembersList) => void;
  onRemoved: (list: MembersList, name: string, handed: Handed | null) => void;
  onGoToOrganisation: () => void;
  /** Withdraw an invitation and Remove a member, from a restore the seats refused. */
  onMembers: () => void;
}) {
  const { t } = useTranslation();
  const callerOwns = organisation.role.seededAs === 'owner';
  const standing = memberStanding(member, list.owners, {
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
  const [said, setSaid] = useState<readonly string[]>([]);
  const [roleVisit, setRoleVisit] = useState(0);
  const [roleOpen, setRoleOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [handing, setHanding] = useState(false);
  const seesLeads = suspendedNow && manages;
  const [leads, setLeads] = useState<LedEvent[] | 'checking' | 'failed'>('checking');
  const [leadsAsked, setLeadsAsked] = useState(0);
  const handRef = useRef<ViewInstance>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [refused, setRefused] = useState<{ on: 'restore' | 'remove'; words: string } | null>(null);
  const [limited, setLimited] = useState<LimitRefusal | null>(null);
  const stepRef = useRef<ViewInstance>(null);
  const removeRef = useRef<ViewInstance>(null);
  const named = {
    name,
    organisation: organisation.name,
    domain: member.suspension?.domain ?? '',
  };

  useEffect(() => {
    if (!seesLeads) return;
    let live = true;
    api
      .memberWork(organisation.id, member.id)
      .then((events) => live && setLeads(events))
      .catch(() => live && setLeads('failed'));

    return () => {
      live = false;
    };
  }, [seesLeads, organisation.id, member.id, leadsAsked]);

  function rereadLeads(): void {
    setLeads('checking');
    setLeadsAsked((now) => now + 1);
  }

  function tell(lines: readonly string[]): void {
    setSaid(lines);
    readOut(lines.join(' '));
  }

  function changedElsewhere(): void {
    void reread(member.id)
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
      const limit = limitRefusalOf(error, 'seatRestore', t, dateLocale(), name);
      if (limit != null) {
        setLimited(limit);
        return;
      }
      setRefused({
        on: 'restore',
        words:
          error instanceof ApiError && error.is('restore_needs_address')
            ? t('membersScreen.restoreNeedsAddress', named)
            : refusalTitle(error, t('membersScreen.actionFailed')),
      });
      return;
    }
    const role = memberRole(t, member);
    onChanged(await membersAfterWrite(() => reread(member.id), list, withRestored(member.id)));
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
      await membersAfterWrite(() => reread(member.id), list, withRemoved(member.id)),
      name,
      null,
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
      {(member.alsoMemberOf ?? 0) > 0 && (
        <Line text={t('membersScreen.alsoMemberOf', { count: member.alsoMemberOf })} />
      )}
      {refused?.on === 'restore' && (
        <View accessibilityRole="alert">
          <FieldError message={refused.words} />
        </View>
      )}
      {seesLeads && !Array.isArray(leads) && (
        <LeadsNotIn name={name} failed={leads === 'failed'} onRetry={rereadLeads} />
      )}
      {seesLeads && Array.isArray(leads) && leads.length > 0 && (
        <LeadsBlock
          events={leads}
          onHandOver={
            acts
              ? () => {
                  setSaid([]);
                  setHanding(true);
                }
              : null
          }
          handRef={handRef}
        />
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
            wraps
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
      {!onlyOwnerSuspended && (
        <MemberHandover
          kind="remove"
          open={removing}
          opener={removeRef}
          organisation={organisation}
          member={member}
          onKeep={() => setRemoving(false)}
          failedOf={(error) => refusalTitle(error, t('membersScreen.actionFailed'))}
          onDone={async (handed) => {
            onRemoved(
              await membersAfterWrite(() => reread(member.id), list, withRemoved(member.id)),
              name,
              handed,
            );
          }}
        />
      )}
      {seesLeads && acts && (
        <MemberHandover
          kind="hand"
          open={handing}
          opener={handRef}
          organisation={organisation}
          member={member}
          onKeep={() => setHanding(false)}
          failedOf={(error) => refusalTitle(error, t('membersScreen.actionFailed'))}
          onDone={(handed) => {
            setHanding(false);
            rereadLeads();
            if (handed != null)
              tell([
                handed.to == null
                  ? t('handover.ledByYou', { count: handed.count })
                  : t('handover.ledBy', { count: handed.count, name: handed.to }),
                t('handover.handTail', { name, count: handed.count }),
              ]);
          }}
        />
      )}
      <LimitRefusalSheet
        refusal={limited}
        billing={roleHolds(organisation, 'billing.manage')}
        opener={stepRef}
        onMembers={() => {
          setLimited(null);
          onMembers();
        }}
        onBack={() => setLimited(null)}
        testID="members.restore.limit"
      />
      {changes && (
        <RoleScreen
          key={roleVisit}
          organisation={organisation}
          member={member}
          list={list}
          reread={reread}
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
