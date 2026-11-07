import { type ReactNode, type RefObject, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  type TextInputInstance,
  View,
  type ViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TextField, focusChecked } from '../../components/Field.tsx';
import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { EventField } from '../events/EventEdits.tsx';
import { Avatar } from '../settings/parts.tsx';
import { FocusedScreen, TextAction } from '../settings/Summary.tsx';
import { BigButton } from './CheckCard.tsx';
import { DeliveryMark } from './MessageMarks.tsx';
import { NOT_REACHED, type NotReached, PARKING_REACH, REACH } from './MessagesSample.ts';
import { W, say } from './MessagesWords.ts';
import { Legend, ReachBar } from './Stream.tsx';

function Person({
  person,
  refFor,
  onFix,
}: {
  person: NotReached;
  refFor: (key: string) => (node: ViewInstance | null) => void;
  onFix: (person: NotReached, fix: string) => void;
}) {
  return (
    <View style={styles.person}>
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

/** Who it reached: the sum, the bar in words, then each person not reached with a line per channel and their page, and the fixes beside. */
export function WhoReached({
  head,
  refFor,
  onFix,
  onFilter,
  onResend,
  bottom,
}: {
  head: ReactNode;
  refFor: (key: string) => (node: ViewInstance | null) => void;
  onFix: (person: NotReached, fix: string) => void;
  onFilter: () => void;
  onResend: () => void;
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
        <View style={styles.sum}>
          <Text
            size={22}
            weight="bold"
            accessibilityRole="header"
            style={[styles.big, styles.figures]}
          >
            {say.reached(PARKING_REACH.reached, PARKING_REACH.of)}
          </Text>
          <Text
            size={14}
            weight="medium"
            style={[styles.secondary, styles.lineText, styles.figures]}
          >
            {`${say.seenByStart(PARKING_REACH.seen)} · ${PARKING_REACH.line}`}
          </Text>
          <ReachBar parts={REACH} label={say.reached(PARKING_REACH.reached, PARKING_REACH.of)} />
          <Legend parts={REACH} />
        </View>
        <View>
          <View style={styles.headRow}>
            <Text
              size={18}
              weight="bold"
              accessibilityRole="header"
              style={[styles.grow, styles.figures]}
            >
              {say.notReached(PARKING_REACH.notReached)}
            </Text>
            <TextAction
              label={W.filter}
              after="down"
              onPress={onFilter}
              testID="messages.reached.filter"
            />
          </View>
          {NOT_REACHED.map((person, index) => (
            <View key={person.key}>
              {index > 0 && <View style={styles.hairline} />}
              <Person person={person} refFor={refFor} onFix={onFix} />
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={[styles.foot, { paddingBottom: bottom }]}>
        <BigButton
          label={say.resend(PARKING_REACH.notReached)}
          onPress={onResend}
          testID="messages.resend"
        />
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
  who: { lineHeight: 17 * 1.3 },
});
