import { type ReactNode, type RefObject, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  type TextInputInstance,
  View,
  type ViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TextField, focusChecked } from '../../components/Field.tsx';
import { ReadOut } from '../../components/ReadOut.tsx';
import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { EventField } from '../events/EventEdits.tsx';
import { Avatar } from '../settings/parts.tsx';
import { FocusedScreen, TextAction } from '../settings/Summary.tsx';
import { BigButton } from './CheckCard.tsx';
import { DeliveryMark, MessageGlyph } from './MessageMarks.tsx';
import type { Messages, ReachedOf } from './MessagesModel.ts';
import {
  INVITATION,
  INVITE_GROUPS,
  NOT_REACHED,
  type NotReached,
  PARKING_GROUPS,
  PARKING_REACH,
  type PersonKey,
  REACH,
  type ReachLine,
  type ReachPart,
  SENDING_GROUPS,
  SENDING_REACH,
} from './MessagesSample.ts';
import { W, say } from './MessagesWords.ts';
import { Legend, ReachBar } from './Stream.tsx';

function Person({
  person,
  again,
  refFor,
  onFix,
  onSendAgain,
}: {
  person: NotReached;
  again: boolean;
  refFor: (key: string) => (node: ViewInstance | null) => void;
  onFix: (person: NotReached, fix: string) => void;
  onSendAgain: (person: NotReached) => void;
}) {
  return (
    <View style={styles.person} ref={refFor(`person.${person.key}`)}>
      <Avatar initials={person.initials} side={40} tone={4} />
      <View style={styles.grow}>
        <Text size={16} weight="semibold" accessibilityRole="header" style={styles.name}>
          {person.name}
        </Text>
        <View style={styles.lines}>
          {person.lines.map((line) => (
            <View
              key={line.word}
              style={styles.reachLine}
              accessible
              accessibilityLabel={[line.word, line.reason].filter(Boolean).join(', ')}
            >
              <View style={styles.markAt}>
                <DeliveryMark mark={line.mark} side={15} />
              </View>
              <View style={styles.lineWords}>
                <Text size={14} weight="semibold" accessible={false} style={styles.lineText}>
                  {line.word}
                </Text>
                {line.reason != null && (
                  <Text
                    size={14}
                    weight="medium"
                    accessible={false}
                    style={[styles.secondary, styles.lineText]}
                  >
                    {`· ${line.reason}`}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
        {again && (
          <View style={styles.again}>
            <Pressable
              ref={refFor(`${person.key}.again`)}
              onPress={() => onSendAgain(person)}
              style={({ pressed }) => [styles.againPill, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={say.sendAgain(person.name)}
              testID={`messages.again.${person.key}`}
            >
              <MessageGlyph name="send" size={17} ink={tokens.colorInkOnDark} weight={2.4} />
              <Text size={15} weight="semibold" accessible={false} style={styles.onAccent}>
                {say.sendAgain(person.name)}
              </Text>
            </Pressable>
          </View>
        )}
        <View style={styles.fixes}>
          {person.fixes.map((fix) => (
            <TextAction
              key={fix}
              ref={refFor(`${person.key}.${fix}`)}
              label={fix}
              accessibilityLabel={`${fix}, ${person.name}`}
              onPress={() => onFix(person, fix)}
              testID={`messages.fix.${person.key}.${fix}`}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function GroupHead({ word, count }: { word: string; count: number }) {
  return (
    <View
      style={styles.groupHead}
      accessible
      accessibilityRole="header"
      accessibilityLabel={say.section(word, count)}
    >
      <Text size={15} weight="bold" accessible={false}>
        {word}
      </Text>
      <Text
        size={15}
        weight="semibold"
        accessible={false}
        style={[styles.secondary, styles.figures]}
      >
        {` · ${count}`}
      </Text>
    </View>
  );
}

export interface ReachView {
  title: string;
  line: string;
  parts: readonly ReachPart[];
  status: string | null;
  head: string;
  filter: boolean;
  groups: readonly { word: string; count: number; people: readonly NotReached[]; more?: string }[];
  resend: number;
}

/** A person after a fix: their new address waiting for Send again, then Sent once it goes (Messaging-B-Phone-3's fixed and sentAgain). */
function fixedPerson(person: NotReached, address: string, at: string | undefined): NotReached {
  const rest = person.lines.filter((line) => !line.word.startsWith('Email'));
  const email: ReachLine =
    at == null
      ? { mark: 'delivered', word: `Email · ${W.fixedNotSent}`, reason: address }
      : { mark: 'sent', word: `Email · Sent · ${at}`, reason: address };

  return { ...person, lines: [email, ...rest], fixes: [] };
}

export function reachViewOf(m: Messages, of: ReachedOf): ReachView {
  if (of === 'invite')
    return {
      title: say.reached(INVITATION.reached, INVITATION.of),
      line: `${say.nowInvitedShort(INVITATION.reached)} · ${say.seenBy(INVITATION.seen)} · 2 no email or phone`,
      parts: [
        { mark: 'delivered', word: 'Reached', count: INVITATION.reached },
        { mark: 'none', word: W.noEmailOrPhone, count: 2 },
      ],
      status: null,
      head: say.notReached(2),
      filter: false,
      groups: INVITE_GROUPS.map((group) => ({ ...group, count: group.people.length })),
      resend: 2,
    };
  if (of === 'draft')
    return {
      title: say.soFar(SENDING_REACH.reached, SENDING_REACH.of),
      line: `${say.inProgressCount(SENDING_REACH.inProgress)} · ${SENDING_REACH.cantTell} can’t be told · ${say.seenBy(SENDING_REACH.seen)}`,
      parts: [
        { mark: 'delivered', word: 'Reached', count: SENDING_REACH.reached },
        { mark: 'sending', word: W.inProgress, count: SENDING_REACH.inProgress },
        { mark: 'none', word: W.cantBeTold, count: SENDING_REACH.cantTell },
      ],
      status: null,
      head: say.section(W.everyone, SENDING_REACH.of),
      filter: true,
      groups: SENDING_GROUPS.map((group, index) => ({
        ...group,
        count:
          [SENDING_REACH.inProgress, SENDING_REACH.reached, SENDING_REACH.cantTell][index] ?? 0,
        ...(index === 0 ? { more: say.andMore(SENDING_REACH.more) } : {}),
      })),
      resend: SENDING_REACH.cantTell,
    };

  const sent = (Object.keys(m.again) as PersonKey[]).filter((key) => m.again[key] != null);
  const shown = (person: NotReached) => {
    const address = m.fixed[person.key];
    return address == null ? person : fixedPerson(person, address, m.again[person.key]);
  };
  const going = NOT_REACHED.filter((person) => sent.includes(person.key)).map(shown);
  const groups = PARKING_GROUPS.map((group) => {
    const people = group.people.filter((person) => !sent.includes(person.key)).map(shown);
    return { word: group.word, count: people.length, people };
  });
  const bouncedLeft = groups[0]?.count ?? 3;
  const said = m.said == null ? null : NOT_REACHED.find((person) => person.key === m.said);
  const counts = [
    ...(going.length > 0 ? [`${going.length} in progress`] : []),
    `${bouncedLeft} bounced`,
    '2 not confirmed · 4 opted out · 2 no email or phone',
  ];

  return {
    title: say.reached(PARKING_REACH.reached, PARKING_REACH.of),
    line: `${say.seenByStart(PARKING_REACH.seen)} · ${counts.join(' · ')}`,
    parts:
      going.length === 0
        ? REACH
        : REACH.flatMap((part) =>
            part.mark === 'bounced'
              ? [
                  { mark: 'sending' as const, word: W.inProgress, count: going.length },
                  { ...part, count: part.count - going.length },
                ]
              : [part],
          ),
    status: said == null ? null : say.sentTo(said.name),
    head: say.notReached(PARKING_REACH.notReached),
    filter: true,
    groups: [
      ...(going.length > 0 ? [{ word: W.inProgress, count: going.length, people: going }] : []),
      ...groups.filter((group) => group.count > 0),
    ],
    resend: PARKING_REACH.notReached - going.length,
  };
}

/** Who it reached: the sum, the bar in words, then each person by group with a line per channel and their page, and the fixes beside. */
export function WhoReached({
  view,
  m,
  head,
  refFor,
  onFix,
  onFilter,
  onResend,
  onSendAgain,
  bottom,
}: {
  view: ReachView;
  m: Messages;
  head: ReactNode;
  refFor: (key: string) => (node: ViewInstance | null) => void;
  onFix: (person: NotReached, fix: string) => void;
  onFilter: () => void;
  onResend: () => void;
  onSendAgain: (person: NotReached) => void;
  bottom: number;
}) {
  return (
    <View style={styles.fill}>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {head}
        {view.status != null && (
          <ReadOut words={view.status} style={styles.status}>
            <Text size={14} weight="medium" style={styles.lineText}>
              {view.status}
            </Text>
          </ReadOut>
        )}
        <View style={styles.sum}>
          <Text
            size={22}
            weight="bold"
            accessibilityRole="header"
            style={[styles.big, styles.figures]}
          >
            {view.title}
          </Text>
          <Text
            size={14}
            weight="medium"
            style={[styles.secondary, styles.lineText, styles.figures]}
          >
            {view.line}
          </Text>
          <ReachBar parts={view.parts} label={view.title} />
          <Legend parts={view.parts} />
        </View>
        <View>
          <View style={styles.headRow}>
            <Text
              size={18}
              weight="bold"
              accessibilityRole="header"
              style={[styles.grow, styles.figures]}
            >
              {view.head}
            </Text>
            {view.filter && (
              <TextAction
                label={W.filter}
                after="down"
                onPress={onFilter}
                testID="messages.reached.filter"
              />
            )}
          </View>
          {view.groups.map((group) => (
            <View key={group.word} style={styles.group}>
              <GroupHead word={group.word} count={group.count} />
              {group.people.map((person, index) => (
                <View key={person.key}>
                  {index > 0 && <View style={styles.hairline} />}
                  <Person
                    person={person}
                    again={m.fixed[person.key] != null && m.again[person.key] == null}
                    refFor={refFor}
                    onFix={onFix}
                    onSendAgain={onSendAgain}
                  />
                </View>
              ))}
              {group.more != null && (
                <Text size={13.5} weight="medium" style={[styles.secondary, styles.more]}>
                  {group.more}
                </Text>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={[styles.foot, { paddingBottom: bottom }]}>
        <BigButton label={say.resend(view.resend)} onPress={onResend} testID="messages.resend" />
      </View>
    </View>
  );
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

/** Fix email address: a focused Cancel and Save screen on the iPhone, a 540 sheet on the iPad; Save waits for an address. */
export function FixEmail({
  open,
  name,
  bounced,
  start,
  opener,
  onCancel,
  onSaved,
}: {
  open: boolean;
  name: string;
  bounced: string;
  start: string;
  opener: RefObject<ScreenReaderTarget | null>;
  onCancel: () => void;
  onSaved: (address: string) => void;
}) {
  const [typed, setTyped] = useState(start);
  const [wrong, setWrong] = useState(false);
  const field = useRef<TextInputInstance>(null);
  const save = () => {
    if (!EMAIL.test(typed.trim())) {
      setWrong(true);
      focusChecked(field);
      return;
    }
    onSaved(typed.trim());
  };

  return (
    <FocusedScreen
      open={open}
      title={W.emailAddress}
      verb={{ label: W.save, on: typed.trim() !== '', onPress: save, testID: 'messages.fix.save' }}
      onCancel={onCancel}
      cancelTestID="messages.fix.cancel"
      opener={opener}
      testID="messages.fix"
    >
      <Text size={17} weight="bold" style={styles.who}>
        {name}
      </Text>
      <EventField
        label={W.emailAddress}
        error={wrong ? W.emailShape : null}
        help={say.wasBounced(bounced)}
      >
        <TextField
          ref={field}
          value={typed}
          onChangeText={(text) => {
            setTyped(text);
            if (wrong && EMAIL.test(text.trim())) setWrong(false);
          }}
          wrong={wrong}
          autoFocus
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="done"
          onSubmitEditing={save}
          submitBehavior="submit"
          accessibilityLabel={W.emailAddress}
          testID="messages.fix.field"
        />
      </EventField>
    </FocusedScreen>
  );
}

export function useFootInset(): number {
  return Math.max(useSafeAreaInsets().bottom, tokens.spaceLg);
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  figures: { fontVariant: ['tabular-nums'] },
  scroll: { gap: tokens.spaceXl, paddingBottom: tokens.space3xl },
  sum: { gap: tokens.spaceSm },
  big: { lineHeight: 22 * 1.2 },
  lineText: { lineHeight: 14 * 1.4 },
  headRow: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
  },
  person: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceLg,
    paddingVertical: tokens.spaceLg,
  },
  name: { lineHeight: 16 * 1.3 },
  lines: { gap: tokens.spaceXxs, marginTop: tokens.spaceXs },
  reachLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  markAt: { paddingTop: tokens.spaceHair },
  lineWords: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', columnGap: tokens.spaceXxs },
  fixes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: tokens.spaceXxl,
    marginTop: tokens.spaceHair,
  },
  hairline: { height: 1, marginLeft: 52, backgroundColor: tokens.colorBorder },
  foot: { paddingTop: tokens.spaceLg, backgroundColor: tokens.colorCard },
  onAccent: { color: tokens.colorInkOnDark },
  pressed: { opacity: tokens.opacityPressed },
  again: { alignItems: 'flex-start', marginTop: tokens.spaceSm },
  againPill: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    paddingHorizontal: tokens.spaceXl,
    borderRadius: 22,
    backgroundColor: tokens.colorAccent,
  },
  group: { paddingBottom: tokens.spaceLg },
  groupHead: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: tokens.spaceXxs,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colorBorder,
  },
  more: { paddingLeft: 52, lineHeight: 13.5 * 1.45 },
  status: {
    paddingVertical: tokens.spaceMd,
    paddingHorizontal: tokens.spaceLg,
    borderRadius: 14,
    backgroundColor: tokens.colorInset,
  },
  who: { lineHeight: 17 * 1.3 },
});
