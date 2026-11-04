import type { Ref } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';

import { useReadOut } from '../../components/ReadOut.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { Avatar } from './parts.tsx';
import {
  type DemoRole,
  heldLine,
  holdersLine,
  levelCounts,
  LEVEL_WORDS,
  type Removed,
  removedCard,
  roleLine,
  rolesCount,
  SAVED_LINE,
  seeLines,
  suspendedHolder,
} from './RolesSample.ts';
import { MEMBERS } from './sample.ts';
import {
  CardCounts,
  CardSays,
  type ListItem,
  Line,
  OnCard,
  Row,
  RowList,
  Section,
  SummaryCard,
} from './Summary.tsx';

/** The Roles card: how many roles and of which kind, or what was just removed, and New role. */
export function RolesCardView({
  roles,
  gone,
  compact,
  wide,
  stepRef,
  onNew,
}: {
  roles: readonly DemoRole[];
  gone: Removed | null;
  compact: boolean;
  wide: boolean;
  stepRef: Ref<ViewInstance>;
  onNew: () => void;
}) {
  const said = gone == null ? null : removedCard(gone);
  const { says, line } = said ?? rolesCount(roles);

  useReadOut(said == null ? null : [said.says, said.line].filter(Boolean).join('. '), {
    quietAtMount: true,
  });

  return (
    <SummaryCard
      size={compact ? 'compact' : wide ? 'wide' : 'page'}
      height={compact ? 156 : 200}
      step={{ label: 'New role', onPress: onNew, testID: 'roles.new', ref: stepRef }}
      testID="roles.card"
    >
      <CardSays text={says} size={compact ? 20 : 24} heading />
      {line != null && <OnCard text={line} />}
    </SummaryCard>
  );
}

export function RoleRows({
  roles,
  open,
  dense,
  onOpen,
}: {
  roles: readonly DemoRole[];
  open: string | null;
  dense: boolean;
  onOpen: (id: string) => void;
}) {
  const gutter = dense ? 10 : 0;
  const items: ListItem[] = roles.map((role) => {
    const selected = role.id === open;

    return {
      key: role.id,
      selected,
      row: (
        <Row
          title={role.name}
          line={roleLine(role)}
          opens
          selected={selected}
          gutter={gutter}
          onPress={() => onOpen(role.id)}
          testID={`roles.role.${role.id}`}
        />
      ),
    };
  });

  return (
    <Section title="Roles">
      <View style={dense && styles.bleed}>
        <RowList items={items} gutter={gutter} />
      </View>
    </Section>
  );
}

/** A role's card: who holds it and how much it holds, or Saved; Edit access unless it is Owner. */
export function RoleCard({
  role,
  saved,
  announce,
  stepRef,
  onEdit,
}: {
  role: DemoRole;
  saved: boolean;
  announce: boolean;
  stepRef: Ref<ViewInstance>;
  onEdit: () => void;
}) {
  const counts = levelCounts(role.grant);

  useReadOut(saved ? `Saved. ${SAVED_LINE}` : null, { quietAtMount: !announce });

  return (
    <SummaryCard
      height={206}
      step={
        role.owner
          ? null
          : { label: 'Edit access', onPress: onEdit, testID: 'roles.edit', ref: stepRef }
      }
      testID={`roles.card.${role.id}`}
    >
      {saved ? (
        <>
          <CardSays text="Saved" />
          <OnCard text={SAVED_LINE} />
        </>
      ) : (
        <>
          <OnCard text={heldLine(role)} strong />
          <CardCounts
            counts={(['change', 'read', 'nothing'] as const).map((level) => ({
              value: counts[level],
              word: LEVEL_WORDS[level],
            }))}
            label={`Areas: ${counts.change} at Change, ${counts.read} at Read, ${counts.nothing} at Nothing`}
          />
        </>
      )}
    </SummaryCard>
  );
}

function memberTone(name: string): { initials: string; tone: number } {
  const index = MEMBERS.findIndex((member) => member.name === name);

  return { initials: MEMBERS[index]?.initials ?? name.slice(0, 1), tone: Math.max(index, 0) };
}

export function WhoHasIt({ holders, role }: { holders: readonly string[]; role: string }) {
  const { shown, more } = holdersLine(holders);

  return (
    <Section title="Who has it">
      {holders.length === 0 ? (
        <Line text="Nobody yet." />
      ) : (
        <RowList
          items={shown.map((name) => {
            const { initials, tone } = memberTone(name);

            return {
              key: name,
              inset: 36 + tokens.spaceLg,
              row: (
                <Row
                  title={name}
                  line={role}
                  lead={<Avatar initials={initials} side={36} tone={tone} />}
                  tag={suspendedHolder(name) ? { kind: 'paused', word: 'Suspended' } : null}
                />
              ),
            };
          })}
        />
      )}
      {more != null && <Line text={more} />}
    </Section>
  );
}

export function WhatTheySee({ grant }: { grant: readonly string[] }) {
  const { hidden, read } = seeLines(grant);

  return (
    <Section title="What they will see">
      <View style={styles.see}>
        <Text size={15} weight="medium">
          {hidden}
        </Text>
        <Text size={15} weight="medium">
          {read}
        </Text>
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  bleed: { marginHorizontal: -10 },
  see: { gap: tokens.spaceSm },
});
