import { type ReactNode, type Ref, type RefObject, useRef, useState } from 'react';
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
import { Text, type TextHandle } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { EventField } from '../events/EventEdits.tsx';
import { Avatar } from '../../components/SettingsParts.tsx';
import { FocusedScreen, TextAction } from '../../components/Summary.tsx';
import { BigButton } from './CheckCard.tsx';
import { WhyNot } from './Composers.tsx';
import { DeliveryMark, MessageGlyph } from './MessageMarks.tsx';
import type { FixKind } from './MessagesModel.ts';
import { type ReachView, type ReachPerson, isEmail, isPhone } from './Reach.ts';
import type { TrySmsView } from './TrySms.ts';
import { W, say } from './MessagesWords.ts';
import { Legend, ReachBar } from './Stream.tsx';

/** The accent pill a row sends with: Send to {name} again, Send by SMS; off with the reason read out. */
function SendPill({
  label,
  why,
  onPress,
  ref,
  testID,
}: {
  label: string;
  why: string | null;
  onPress: () => void;
  ref: (node: ViewInstance | null) => void;
  testID: string;
}) {
  const off = why != null;

  return (
    <Pressable
      ref={ref}
      onPress={off ? undefined : onPress}
      disabled={off}
      style={({ pressed }) => [styles.againPill, off && styles.againOff, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={off ? `${label}, ${why}` : label}
      accessibilityState={{ disabled: off }}
      testID={testID}
    >
      <MessageGlyph
        name="send"
        size={17}
        ink={off ? tokens.colorInkSecondary : tokens.colorInkOnDark}
        weight={2.4}
      />
      <Text
        size={15}
        weight="semibold"
        accessible={false}
        style={off ? styles.secondary : styles.onAccent}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Try SMS instead, pressed: the text's count and credits, either wait, then Send by SMS or Cancel; nothing is sent yet. */
function TrySmsOpen({
  person,
  trying,
  refFor,
  onSend,
  onCancel,
}: {
  person: ReachPerson;
  trying: TrySmsView;
  refFor: (key: string) => (node: ViewInstance | null) => void;
  onSend: (person: ReachPerson) => void;
  onCancel: (person: ReachPerson) => void;
}) {
  const said = [
    trying.count,
    trying.uses,
    trying.quiet,
    trying.waits,
    trying.waits && W.creditsNotInApp,
  ];

  return (
    <View style={styles.trying} testID={`messages.trySms.open.${person.key}`}>
      <View
        ref={refFor(`${person.key}.trySmsOpen`)}
        style={styles.tryingWords}
        accessible
        accessibilityLabel={said.filter(Boolean).join(' ')}
      >
        <Text
          size={14}
          weight="semibold"
          accessible={false}
          style={[styles.lineText, styles.figures]}
        >
          {trying.count}
        </Text>
        <Text
          size={14}
          weight="medium"
          accessible={false}
          style={[styles.secondary, styles.lineText, styles.figures]}
        >
          {trying.uses}
        </Text>
        {trying.quiet != null && (
          <View style={styles.reachLine} testID={`messages.trySms.quiet.${person.key}`}>
            <View style={styles.markAt}>
              <DeliveryMark mark="sending" side={15} />
            </View>
            <Text
              size={14}
              weight="semibold"
              accessible={false}
              style={[styles.grow, styles.lineText]}
            >
              {trying.quiet}
            </Text>
          </View>
        )}
        {trying.waits != null && (
          <View style={styles.reachLine} testID={`messages.trySms.waits.${person.key}`}>
            <View style={styles.markAt}>
              <DeliveryMark mark="sending" side={15} />
            </View>
            <View style={styles.grow}>
              <Text size={14} weight="semibold" accessible={false} style={styles.lineText}>
                {trying.waits}
              </Text>
              <Text
                size={14}
                weight="medium"
                accessible={false}
                style={[styles.secondary, styles.lineText]}
              >
                {W.creditsNotInApp}
              </Text>
            </View>
          </View>
        )}
      </View>
      <View style={styles.again}>
        <SendPill
          ref={refFor(`${person.key}.sendBySms`)}
          label={W.sendBySms}
          why={null}
          onPress={() => onSend(person)}
          testID={`messages.sendBySms.${person.key}`}
        />
        <TextAction
          ref={refFor(`${person.key}.cancelSms`)}
          label={W.cancel}
          accessibilityLabel={`${W.cancel}, ${W.trySmsInstead}, ${person.name}`}
          onPress={() => onCancel(person)}
          testID={`messages.cancelSms.${person.key}`}
        />
      </View>
    </View>
  );
}

export interface RowActions {
  onFix: (person: ReachPerson, fix: string) => void;
  onSendAgain: (person: ReachPerson) => void;
  onNotNow: (person: ReachPerson) => void;
  onTrySms: (person: ReachPerson) => void;
  onSendBySms: (person: ReachPerson) => void;
  onCancelSms: (person: ReachPerson) => void;
}

function Person({
  person,
  closed,
  refFor,
  actions,
}: {
  person: ReachPerson;
  closed: string | null;
  refFor: (key: string) => (node: ViewInstance | null) => void;
  actions: RowActions;
}) {
  const { onFix, onSendAgain, onNotNow } = actions;
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
        {person.updated != null && (
          <View
            style={[styles.reachLine, styles.updated]}
            accessible
            accessibilityLabel={`${W.updatedNotSent}, ${person.updated}`}
            testID={`messages.updated.${person.key}`}
          >
            <View style={styles.markAt}>
              <DeliveryMark mark="notsent" side={15} />
            </View>
            <View style={styles.grow}>
              <Text size={14} weight="semibold" accessible={false} style={styles.lineText}>
                {W.updatedNotSent}
              </Text>
              <Text
                size={14}
                weight="medium"
                accessible={false}
                style={[styles.secondary, styles.lineText]}
              >
                {person.updated}
              </Text>
            </View>
          </View>
        )}
        {person.offer && (
          <View style={styles.again}>
            <SendPill
              ref={refFor(`${person.key}.again`)}
              label={say.sendAgain(person.name)}
              why={closed}
              onPress={() => onSendAgain(person)}
              testID={`messages.again.${person.key}`}
            />
            <TextAction
              ref={refFor(`${person.key}.notNow`)}
              label={W.notNow}
              accessibilityLabel={`${W.notNow}, ${person.name}`}
              onPress={() => onNotNow(person)}
              testID={`messages.notNow.${person.key}`}
            />
          </View>
        )}
        {person.trying != null ? (
          <TrySmsOpen
            person={person}
            trying={person.trying}
            refFor={refFor}
            onSend={actions.onSendBySms}
            onCancel={actions.onCancelSms}
          />
        ) : (
          <View style={styles.fixes}>
            {person.trySms === true && (
              <TextAction
                ref={refFor(`${person.key}.trySms`)}
                label={W.trySmsInstead}
                off={closed != null}
                accessibilityLabel={[W.trySmsInstead, person.name, closed]
                  .filter(Boolean)
                  .join(', ')}
                onPress={() => actions.onTrySms(person)}
                testID={`messages.trySms.${person.key}`}
              />
            )}
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
        )}
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

/** Who it reached: the sum, the bar in words, then each person by group with a line per channel and their page, and the fixes beside. */
export function WhoReached({
  view,
  head,
  headRef,
  refFor,
  actions,
  onFilter,
  onShowNotReached,
  onResend,
  closed,
  bottom,
}: {
  view: ReachView;
  head: ReactNode;
  headRef: Ref<TextHandle>;
  refFor: (key: string) => (node: ViewInstance | null) => void;
  actions: RowActions;
  onFilter: () => void;
  onShowNotReached: () => void;
  onResend: () => void;
  closed: string | null;
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
              ref={headRef}
              size={18}
              weight="bold"
              accessibilityRole="header"
              style={[styles.grow, styles.figures]}
            >
              {view.head}
            </Text>
            {view.filter && (
              <TextAction
                ref={refFor('filter')}
                label={W.filter}
                accessibilityLabel={`${W.filter}, ${view.head}`}
                after="down"
                onPress={onFilter}
                testID="messages.reached.filter"
              />
            )}
          </View>
          {view.empty != null && (
            <View style={styles.empty}>
              <Text size={15} weight="medium" style={[styles.secondary, styles.lineText]}>
                {view.empty}
              </Text>
              {view.filterOn !== 'notReached' && (
                <TextAction
                  label={W.showNotReached}
                  onPress={onShowNotReached}
                  testID="messages.reached.showNotReached"
                />
              )}
            </View>
          )}
          {view.groups.map((group) => (
            <View key={group.word} style={styles.group}>
              <GroupHead word={group.word} count={group.count} />
              {group.people.map((person, index) => (
                <View key={person.key}>
                  {index > 0 && <View style={styles.hairline} />}
                  <Person person={person} closed={closed} refFor={refFor} actions={actions} />
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
      {view.resend > 0 && (
        <View style={[styles.foot, { paddingBottom: bottom }]}>
          {closed != null && <WhyNot words={closed} />}
          <BigButton
            label={say.resend(view.resend)}
            onPress={onResend}
            why={closed}
            testID="messages.resend"
          />
        </View>
      )}
    </View>
  );
}

/** Fix email address, Add an email address and Add a phone number: a focused Cancel and Save screen on the iPhone, a 540 sheet on the iPad; Save waits for a valid address. */
export function ContactEdit({
  open,
  how,
  name,
  bounced,
  start,
  opener,
  onCancel,
  onSaved,
}: {
  open: boolean;
  how: FixKind;
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
  const phone = how === 'addPhone';
  const valid = phone ? isPhone : isEmail;
  const label = phone ? W.mobileNumber : W.emailAddress;
  const save = () => {
    if (!valid(typed)) {
      setWrong(true);
      focusChecked(field);
      return;
    }
    onSaved(typed.trim());
  };

  return (
    <FocusedScreen
      open={open}
      title={label}
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
        label={label}
        error={wrong ? (phone ? W.phoneShape : W.emailShape) : null}
        help={how === 'fixEmail' ? say.wasBounced(bounced) : undefined}
      >
        <TextField
          ref={field}
          value={typed}
          onChangeText={(text) => {
            setTyped(text);
            if (wrong && valid(text)) setWrong(false);
          }}
          wrong={wrong}
          autoFocus
          keyboardType={phone ? 'phone-pad' : 'email-address'}
          autoCapitalize="none"
          autoComplete={phone ? 'tel' : 'email'}
          textContentType={phone ? 'telephoneNumber' : 'emailAddress'}
          returnKeyType="done"
          onSubmitEditing={save}
          submitBehavior="submit"
          accessibilityLabel={label}
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
  updated: { marginTop: tokens.spaceSm },
  lineWords: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', columnGap: tokens.spaceXxs },
  fixes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: tokens.spaceXxl,
    marginTop: tokens.spaceHair,
  },
  hairline: { height: 1, marginLeft: 52, backgroundColor: tokens.colorBorder },
  foot: { paddingTop: tokens.spaceLg, gap: tokens.spaceSm, backgroundColor: tokens.colorCard },
  onAccent: { color: tokens.colorInkOnDark },
  pressed: { opacity: tokens.opacityPressed },
  again: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: tokens.spaceXl,
    marginTop: tokens.spaceSm,
  },
  empty: { alignItems: 'flex-start', gap: tokens.spaceXs, paddingVertical: tokens.spaceLg },
  trying: { gap: tokens.spaceXs, marginTop: tokens.spaceSm },
  tryingWords: { gap: tokens.spaceXxs },
  againOff: { backgroundColor: tokens.colorInsetBorder },
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
