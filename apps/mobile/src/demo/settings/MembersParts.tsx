import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Notice } from '../../components/Notice.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { Glyph } from '../Glyph.tsx';
import {
  approvalRoles,
  DEADLINES,
  type Filter,
  FILTERS,
  type MembersSay,
  ORGANISATION,
  type Person,
  type Request,
  ROLE_MEANS,
  rowLine,
  statusWord,
} from './MembersSample.ts';
import { Avatar, Card, CardHead, Chip, Pair, Pill, TYPE } from './parts.tsx';
import { RadioCards } from './RolesParts.tsx';
import type { SettingsLayout } from './sample.ts';

const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

/** A person: initials, the name with its status chip, the email, then role · you · how · when. */
export function MemberRow({
  person,
  you,
  open,
  dense,
  first,
  say,
  onOpen,
}: {
  person: Person;
  you: string;
  open: boolean;
  dense: boolean;
  first: boolean;
  say: MembersSay;
  onOpen: () => void;
}) {
  const { word, kind } = statusWord(person);
  const line = rowLine(person, you, say);
  const former = person.status === 'former';
  const avatar = dense ? 36 : 40;
  const words = (
    <>
      {!first && !open && (
        <View style={[styles.rule, { left: (dense ? 12 : tokens.spaceXl) + avatar + 12 }]} />
      )}
      <Avatar initials={person.initials} side={avatar} tone={person.tone} />
      <View style={styles.rowWords}>
        <View style={styles.nameRow}>
          <Text
            size={dense ? 15.5 : TYPE.row}
            weight="semibold"
            accessible={false}
            style={open ? styles.accent : undefined}
          >
            {person.name}
          </Text>
          <Chip word={word} kind={kind} />
        </View>
        <Text
          size={dense ? TYPE.small : 14}
          weight="medium"
          accessible={false}
          style={styles.secondary}
        >
          {person.email}
        </Text>
        <Text size={13} weight="medium" accessible={false} style={styles.secondary}>
          {line}
        </Text>
      </View>
    </>
  );
  const label = `${person.name}, ${word}. ${person.email}. ${line}`;

  if (former)
    return (
      <View style={[styles.row, dense && styles.rowDense]} accessible accessibilityLabel={label}>
        {words}
      </View>
    );

  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [
        styles.row,
        dense && styles.rowDense,
        open && styles.rowOpen,
        pressed && !open && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: open }}
      accessibilityLabel={label}
      testID={`members.row.${person.initials}`}
    >
      {words}
      <View style={styles.chevron}>
        <Glyph
          name="chevron"
          size={18}
          ink={open ? tokens.colorAccent : tokens.colorInkTertiary}
          weight={2.2}
        />
      </View>
    </Pressable>
  );
}

export function MemberRows({
  people,
  you,
  open,
  dense,
  say,
  onOpen,
}: {
  people: readonly Person[];
  you: string;
  open: string | null;
  dense: boolean;
  say: MembersSay;
  onOpen: (id: string) => void;
}) {
  return (
    <View style={styles.rows}>
      {people.map((person, index) => (
        <MemberRow
          key={person.id}
          person={person}
          you={you}
          open={person.id === open}
          dense={dense}
          first={index === 0 || people[index - 1]?.id === open}
          say={say}
          onOpen={() => onOpen(person.id)}
        />
      ))}
    </View>
  );
}

export function Filters({
  on,
  counts,
  onPick,
}: {
  on: Filter;
  counts: Record<Filter, number>;
  onPick: (filter: Filter) => void;
}) {
  return (
    <View style={styles.filters}>
      {FILTERS.map(({ filter, word }) => {
        const chosen = filter === on;

        return (
          <Pressable
            key={filter}
            onPress={() => onPick(filter)}
            style={[styles.filter, chosen && styles.filterOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: chosen }}
            accessibilityLabel={`${word}, ${counts[filter]}`}
            testID={`members.filter.${filter}`}
          >
            <Text
              size={TYPE.line}
              weight="semibold"
              accessible={false}
              style={chosen ? styles.accent : undefined}
            >
              {word}
            </Text>
            <Text
              size={TYPE.line}
              weight="medium"
              accessible={false}
              style={[chosen ? styles.accent : styles.secondary, styles.figures]}
            >
              {String(counts[filter])}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const EMPTY: Record<Filter, { title: string; body?: string }> = {
  all: { title: 'Nobody here' },
  active: { title: 'Nobody is active' },
  suspended: {
    title: 'Nobody is suspended',
    body: `Everyone in ${ORGANISATION} can use it right now.`,
  },
  former: {
    title: 'Nobody has left',
    body: 'People who leave or are removed are listed here, with what they did kept.',
  },
};

export function Empty({ filter, onShowEveryone }: { filter: Filter; onShowEveryone: () => void }) {
  const { title, body } = EMPTY[filter];

  return (
    <Card gap={10}>
      <Text size={17} weight="semibold" accessibilityRole="header">
        {title}
      </Text>
      {body != null && (
        <Text size={TYPE.body} weight="medium" style={styles.secondary}>
          {body}
        </Text>
      )}
      {filter !== 'all' && (
        <Pill
          label="Show everyone"
          kind="secondary"
          onPress={onShowEveryone}
          testID="members.showEveryone"
        />
      )}
    </Card>
  );
}

const AWAITING_NOTE =
  'Only people who manage members see these requests. Nobody is added until one of you approves them.';

/** Requests to join, answered in place: Approve with a role, Read-only first; Turn down asks first. */
export function Awaiting({
  person,
  answered,
  request,
  layout,
  dense,
  say,
  onRequest,
  onApprove,
  onTurnDown,
  onSee,
}: {
  person: Person | null;
  answered: Person | null;
  request: Request;
  layout: SettingsLayout;
  dense: boolean;
  say: MembersSay;
  onRequest: (request: Request) => void;
  onApprove: (person: Person, role: string) => void;
  onTurnDown: (person: Person) => void;
  onSee: (request: Request) => void;
}) {
  const [role, setRole] = useState('Read-only');
  const tablet = layout !== 'phone' && !dense;
  const pairLayout = dense ? 'phone' : layout;
  const height = tablet ? tokens.sizeHitPhonePrimary : tokens.sizeHitPhoneHero;

  if (typeof request === 'object') {
    const name = answered?.name ?? '';
    const words =
      'approved' in request
        ? {
            title: `${name} is now a member, as ${request.role}.`,
            label: `See ${name}`,
            testID: 'members.awaiting.see',
          }
        : {
            title: `${name}’s request is turned down.`,
            label: 'See Former',
            testID: 'members.awaiting.former',
          };

    return (
      <Card>
        <CardHead title="Awaiting approval" line={AWAITING_NOTE} />
        <Notice
          tone="done"
          mark={tokens.marks.done.glyph}
          title={words.title}
          action={{ label: words.label, onPress: () => onSee(request), testID: words.testID }}
          announce
        />
      </Card>
    );
  }

  if (person == null) return null;

  const actions =
    request === 'approving' ? (
      <View style={styles.stack}>
        <RadioCards
          choices={approvalRoles().map((name) => ({
            value: name,
            name,
            means: ROLE_MEANS[name],
          }))}
          picked={role}
          onPick={setRole}
          twoUp={tablet}
          testID="members.approveAs"
        />
        <Pair
          layout={pairLayout}
          dismiss={
            <Pill
              label="Cancel"
              kind="secondary"
              full={!tablet}
              height={height}
              onPress={() => onRequest('resting')}
              testID="members.approve.cancel"
            />
          }
          confirm={
            <Pill
              label={`Approve as ${role}`}
              full={!tablet}
              height={height}
              onPress={() => onApprove(person, role)}
              testID="members.approve.confirm"
            />
          }
        />
      </View>
    ) : request === 'turningDown' ? (
      <View style={styles.ask}>
        <Text size={18} weight="bold" accessibilityRole="header">
          {`Turn down ${person.name}?`}
        </Text>
        <Text size={TYPE.body} weight="medium">
          {`${person.name} is emailed that their request to join ${ORGANISATION} was turned down. The email does not say who turned it down.`}
        </Text>
        <Pair
          layout={pairLayout}
          dismiss={
            <Pill
              label="Keep the request"
              kind="quiet"
              full={!tablet}
              height={height}
              onPress={() => onRequest('resting')}
              testID="members.turnDown.keep"
            />
          }
          confirm={
            <Pill
              label={`Turn down ${person.name}`}
              kind="danger"
              full={!tablet}
              height={height}
              onPress={() => onTurnDown(person)}
              testID="members.turnDown.confirm"
            />
          }
        />
      </View>
    ) : tablet ? (
      <View style={styles.endRow}>
        <Pill
          label="Turn down"
          kind="secondary"
          full={false}
          height={tokens.sizeHitPhonePrimary}
          onPress={() => onRequest('turningDown')}
          testID="members.turnDown"
        />
        <Pill
          label="Approve"
          full={false}
          height={tokens.sizeHitPhonePrimary}
          onPress={() => onRequest('approving')}
          testID="members.approve"
        />
      </View>
    ) : (
      <View style={styles.two}>
        <View style={styles.half}>
          <Pill
            label="Approve"
            height={tokens.sizeHitPhonePrimary}
            onPress={() => onRequest('approving')}
            testID="members.approve"
          />
        </View>
        <View style={styles.half}>
          <Pill
            label="Turn down"
            kind="secondary"
            height={tokens.sizeHitPhonePrimary}
            onPress={() => onRequest('turningDown')}
            testID="members.turnDown"
          />
        </View>
      </View>
    );

  return (
    <Card style={dense ? styles.cardDense : undefined}>
      <CardHead title="Awaiting approval" line={AWAITING_NOTE} />
      <View style={styles.request}>
        <View style={styles.requestHead}>
          <Avatar initials={person.initials} side={dense ? 36 : 40} tone={person.tone} />
          <View style={styles.rowWords}>
            <Text size={dense ? 15.5 : TYPE.row} weight="semibold">
              {person.name}
            </Text>
            <Text size={dense ? TYPE.small : 14} weight="medium" style={styles.secondary}>
              {person.email}
            </Text>
            <Text size={13} weight="medium" style={styles.secondary}>
              {`${person.how} · asked ${say.date(person.when)}`}
            </Text>
            <Text size={13} weight="medium" style={styles.secondary}>
              {`Removed on ${say.deadline(DEADLINES.lucia)} if nobody answers`}
            </Text>
          </View>
        </View>
        {actions}
      </View>
    </Card>
  );
}

/** Nobody opens by themselves on its side: the pane says what to do. */
export function NobodyPicked() {
  return (
    <View style={styles.nobody}>
      <View style={styles.nobodyMark} {...hidden}>
        <Glyph name="users" size={30} ink={tokens.colorAccent} weight={2} />
      </View>
      <Text size={18} weight="semibold" style={styles.nobodyWords}>
        Choose somebody in the list to see them here.
      </Text>
    </View>
  );
}

export const FROM_THE_WEB = 'To invite somebody, use Soirely on the web.';

const styles = StyleSheet.create({
  accent: { color: tokens.colorAccentText },
  secondary: { color: tokens.colorInkSecondary },
  figures: { fontVariant: ['tabular-nums'] },
  pressed: { backgroundColor: tokens.colorNeutralFill },
  stack: { gap: 14 },
  ask: { gap: tokens.spaceMd },
  rows: {
    borderRadius: tokens.space3xl,
    backgroundColor: tokens.colorInset,
    padding: tokens.spaceXxs,
  },
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceLg,
    paddingVertical: 14,
    paddingLeft: tokens.spaceXl,
    paddingRight: 14,
    borderRadius: tokens.spaceXl,
  },
  rowDense: { paddingVertical: tokens.spaceLg, paddingLeft: 14, paddingRight: tokens.spaceLg },
  rowOpen: {
    backgroundColor: tokens.colorAccentTint,
    borderWidth: 2,
    borderColor: tokens.colorAccent,
  },
  rule: { position: 'absolute', right: 0, top: 0, height: 1, backgroundColor: tokens.colorBorder },
  rowWords: { flex: 1, minWidth: 0, gap: 3 },
  nameRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 8,
    rowGap: 4,
  },
  chevron: { alignSelf: 'center' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
  filter: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 15,
    borderRadius: tokens.sizeHit / 2,
    borderWidth: 1.5,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  filterOn: {
    borderWidth: 2,
    borderColor: tokens.colorAccent,
    backgroundColor: tokens.colorAccentTint,
  },
  cardDense: { padding: 18 },
  request: {
    gap: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: tokens.colorCard,
  },
  requestHead: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceLg },
  two: { flexDirection: 'row', gap: tokens.spaceMd },
  half: { flex: 1, minWidth: 0 },
  endRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: tokens.spaceMd },
  nobody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    paddingHorizontal: tokens.space3xl,
  },
  nobodyMark: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorAccentTint,
  },
  nobodyWords: { maxWidth: 320, textAlign: 'center' },
});
