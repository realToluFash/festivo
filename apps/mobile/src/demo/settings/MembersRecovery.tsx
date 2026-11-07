import type { Ref } from 'react';
import { type ScrollViewInstance, StyleSheet, View, type ViewInstance } from 'react-native';

import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import {
  askerName,
  OWN_LINE,
  RECOVERY_WORDS,
  type RecoveryAsk,
  recoveryFacts,
  recoveryHeard,
  recoveryOf,
} from './MembersRecoverySample.ts';
import type { MembersSay, Person } from './MembersSample.ts';
import { Avatar } from './parts.tsx';
import {
  type AskProps,
  type ListItem,
  RowList,
  Section,
  SELECTED_ROW,
  Tag,
  TextAction,
} from './Summary.tsx';

export type RecoveryPart = 'box' | 'group' | 'approve' | 'turnDown';

type OnTarget = (id: string, part: RecoveryPart, view: ViewInstance | null) => void;

/** Requests to get back in, under the card: the product's paragraph once, heard in each request's group instead, then each request as a Members row with its two answers. */
export function RecoveryRequests({
  waiting,
  you,
  lit,
  dense,
  say,
  listRef,
  onTarget,
  onAnswer,
}: {
  waiting: readonly Person[];
  you: string;
  lit: string | null;
  dense: boolean;
  say: MembersSay;
  listRef: Ref<ViewInstance>;
  onTarget: OnTarget;
  onAnswer: (id: string, answer: RecoveryAsk['answer']) => void;
}) {
  const side = dense ? 36 : 40;
  const items: ListItem[] = waiting.map((person) => ({
    key: person.id,
    inset: side + tokens.spaceLg,
    selected: person.id === lit,
    row: (
      <RecoveryRow
        person={person}
        own={person.id === you}
        lit={person.id === lit}
        dense={dense}
        say={say}
        onTarget={onTarget}
        onAnswer={onAnswer}
      />
    ),
  }));

  return (
    <View ref={listRef} collapsable={false}>
      <Section title={RECOVERY_WORDS.title} foot={RECOVERY_WORDS.note}>
        <Text
          size={15}
          weight="medium"
          style={[styles.secondary, styles.intro]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          accessible={false}
        >
          {RECOVERY_WORDS.intro}
        </Text>
        <View style={dense && styles.bleed}>
          <RowList items={items} gutter={dense ? tokens.spaceMd : 0} />
        </View>
      </Section>
    </View>
  );
}

function RecoveryRow({
  person,
  own,
  lit,
  dense,
  say,
  onTarget,
  onAnswer,
}: {
  person: Person;
  own: boolean;
  lit: boolean;
  dense: boolean;
  say: MembersSay;
  onTarget: OnTarget;
  onAnswer: (id: string, answer: RecoveryAsk['answer']) => void;
}) {
  const request = recoveryOf(person.id);
  const side = dense ? 36 : 40;
  const testID = `members.recovery.${person.initials}`;

  return (
    <View
      ref={(view) => onTarget(person.id, 'box', view)}
      collapsable={false}
      style={[
        dense ? styles.rowDense : styles.row,
        lit && styles.lit,
        lit && !dense && styles.litPast,
      ]}
      testID={testID}
    >
      <View
        ref={(view) => onTarget(person.id, 'group', view)}
        style={styles.group}
        accessible
        accessibilityLabel={recoveryHeard(request, person, own, say)}
      >
        <Avatar initials={person.initials} side={side} tone={person.tone} />
        <View style={styles.words}>
          <View style={styles.titleRow}>
            <Text
              size={16}
              weight="semibold"
              accessible={false}
              style={[styles.name, lit && styles.accent]}
            >
              {askerName(person, own)}
            </Text>
            <Tag kind="waiting" word={RECOVERY_WORDS.mark} wraps />
          </View>
          {recoveryFacts(request, person, own, say).map((fact) => (
            <Text
              key={fact}
              size={14}
              weight="medium"
              accessible={false}
              style={[styles.secondary, styles.fact]}
            >
              {fact}
            </Text>
          ))}
        </View>
      </View>
      <View style={{ marginLeft: side + tokens.spaceLg }}>
        {own ? (
          <Text size={14} weight="medium" style={styles.own}>
            {OWN_LINE}
          </Text>
        ) : (
          <View style={styles.answers}>
            <TextAction
              ref={(view) => onTarget(person.id, 'approve', view)}
              label={RECOVERY_WORDS.approve}
              onPress={() => onAnswer(person.id, 'approve')}
              testID={`${testID}.approve`}
            />
            <TextAction
              ref={(view) => onTarget(person.id, 'turnDown', view)}
              label={RECOVERY_WORDS.turnDown}
              onPress={() => onAnswer(person.id, 'turnDown')}
              testID={`${testID}.turnDown`}
            />
          </View>
        )}
      </View>
    </View>
  );
}

/** Members' one Ask for each answer: Cancel or Keep the request first, the verb last; Sending your answer… while it goes, the failed line if it fails, and Close alone once the request has gone. */
export function recoveryQuestion(
  ask: RecoveryAsk | null,
  name: string,
): Omit<AskProps, 'onKeep' | 'onConfirm'> {
  const turningDown = ask?.answer === 'turnDown';
  const title = turningDown
    ? RECOVERY_WORDS.turnDownTitle(name)
    : RECOVERY_WORDS.approveTitle(name);

  const off = ask?.phase === 'sending';
  const busy = off ? RECOVERY_WORDS.sending : undefined;
  const failed = ask?.phase === 'failed' ? RECOVERY_WORDS.failed : null;

  if (ask?.phase === 'closed')
    return {
      title,
      line: RECOVERY_WORDS.closed,
      alert: true,
      keep: { label: RECOVERY_WORDS.close, testID: 'members.recovery.close' },
      confirm: null,
    };
  if (turningDown)
    return {
      title,
      line: RECOVERY_WORDS.turnDownBody,
      failed,
      keep: { label: RECOVERY_WORDS.keep, testID: 'members.recovery.keep', off },
      confirm: {
        label: RECOVERY_WORDS.turnDownConfirm,
        testID: 'members.recovery.turnDownConfirm',
        busy,
      },
    };

  return {
    title,
    line: RECOVERY_WORDS.approveBody,
    failed,
    keep: { label: RECOVERY_WORDS.cancel, testID: 'members.recovery.cancel', off },
    confirm: {
      label: RECOVERY_WORDS.approveConfirm,
      testID: 'members.recovery.turnOff',
      removes: true,
      busy,
    },
  };
}

/** The card's step: when the request is not wholly in view, the list's head comes up to `top` under the scroll's top, as the phone's board draws it. */
export function bringListUp(
  list: ViewInstance | null,
  request: ViewInstance | null | undefined,
  scroll: ScrollViewInstance | null,
  top: number,
  clear: number,
): void {
  const content = scroll?.getInnerViewRef();
  if (list == null || request == null || scroll == null || content == null) return;
  scroll.measureInWindow((_sx, scrollY, _sw, shown) => {
    request.measureInWindow((_x, y, _w, height) => {
      if (y >= scrollY + top && y + height <= scrollY + shown - clear) return;
      list.measureLayout(content, (_lx, listY) => {
        content.measure((_cx, _cy, _cw, contentHeight) => {
          const most = Math.max(0, contentHeight - shown);
          scroll.scrollTo({ y: Math.min(most, Math.max(0, listY - top)), animated: true });
        });
      });
    });
  });
}

const styles = StyleSheet.create({
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
  intro: { lineHeight: 15 * 1.45, paddingBottom: tokens.spaceXs },
  bleed: { marginHorizontal: -tokens.spaceMd },
  row: { paddingVertical: 11 },
  rowDense: { paddingVertical: 9, paddingHorizontal: tokens.spaceMd },
  lit: SELECTED_ROW,
  litPast: { marginHorizontal: -tokens.spaceMd, paddingHorizontal: tokens.spaceMd },
  group: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceLg },
  words: { flex: 1, minWidth: 0, gap: 3 },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: tokens.spaceSm,
    rowGap: tokens.spaceXxs,
  },
  name: { flexShrink: 1, lineHeight: 16 * 1.3 },
  fact: { lineHeight: 14 * 1.4 },
  answers: { flexDirection: 'row', flexWrap: 'wrap', columnGap: tokens.space3xl, marginTop: 3 },
  own: { lineHeight: 14 * 1.4, marginTop: tokens.spaceXs },
});
