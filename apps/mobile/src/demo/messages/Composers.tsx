import { type Ref, type RefObject, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  type TextInputInstance,
  View,
  type ViewInstance,
} from 'react-native';

import { TextField } from '../../components/Field.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { TextAction } from '../settings/Summary.tsx';
import { MessageGlyph } from './MessageMarks.tsx';
import { type Draft, toChip } from './MessagesModel.ts';
import { CHANNEL_WORD, type ChannelKey, W, say } from './MessagesWords.ts';

const INK2 = tokens.colorInkSecondary;

export function SendButton({
  on,
  onPress,
  ref,
  testID,
}: {
  on: boolean;
  onPress?: (() => void) | undefined;
  ref?: Ref<ViewInstance> | undefined;
  testID: string;
}) {
  return (
    <Pressable
      ref={ref}
      onPress={on ? onPress : undefined}
      disabled={!on}
      style={({ pressed }) => [styles.send, !on && styles.sendOff, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={W.send}
      accessibilityState={{ disabled: !on }}
      testID={testID}
    >
      <MessageGlyph
        name="send"
        size={20}
        ink={on ? tokens.colorInkOnDark : tokens.colorInkTertiary}
        weight={2.4}
      />
    </Pressable>
  );
}

/** To's chip: the group and how many it reaches, with a mark that says it opens a choice. */
export function ToChip({
  text,
  onPress,
  ref,
  open = false,
}: {
  text: string;
  onPress: () => void;
  ref?: Ref<ViewInstance> | undefined;
  open?: boolean;
}) {
  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      style={({ pressed }) => [styles.toChip, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${W.to}, ${text}`}
      accessibilityState={{ expanded: open }}
      testID="messages.to"
    >
      <Text size={14} weight="semibold" accessible={false} style={[styles.accent, styles.figures]}>
        {text}
      </Text>
      <Glyph name="down" size={14} ink={tokens.colorAccentText} weight={2.6} />
    </Pressable>
  );
}

export function ChannelTick({
  channel,
  on,
  onPress,
  testID,
}: {
  channel: ChannelKey;
  on: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tick,
        on ? styles.tickOn : styles.tickOff,
        pressed && styles.pressed,
      ]}
      accessibilityRole="checkbox"
      accessibilityLabel={CHANNEL_WORD[channel]}
      accessibilityState={{ checked: on }}
      testID={testID}
    >
      {on && <Glyph name="tick" size={15} ink={tokens.colorAccentText} weight={2.8} />}
      <Text
        size={14}
        weight="semibold"
        accessible={false}
        style={on ? styles.accent : styles.secondary}
      >
        {CHANNEL_WORD[channel]}
      </Text>
    </Pressable>
  );
}

/** Writing to many: To and its chip, then the ticks that choose only where Soirely's notice goes. */
export function ToHead({
  draft,
  picking,
  toRef,
  onTo,
  onChannel,
}: {
  draft: Draft;
  picking: boolean;
  toRef?: Ref<ViewInstance> | undefined;
  onTo: () => void;
  onChannel: (key: ChannelKey) => void;
}) {
  return (
    <View style={styles.head}>
      <View style={styles.headRow}>
        <View style={styles.toWord}>
          <Text size={14} weight="semibold" style={styles.secondary}>
            {W.to}
          </Text>
        </View>
        <ToChip ref={toRef} text={toChip(draft.to)} onPress={onTo} open={picking} />
      </View>
      <View style={styles.headRow}>
        <View style={styles.byWord}>
          <Text size={14} weight="semibold" style={styles.secondary}>
            {W.letThemKnowBy}
          </Text>
        </View>
        <View style={styles.ticks}>
          {(['email', 'sms', 'wa'] as const).map((key) => (
            <ChannelTick
              key={key}
              channel={key}
              on={draft.channels[key]}
              onPress={() => onChannel(key)}
              testID={`messages.channel.${key}`}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

/** The one composer, open to write to many: the Subject over a hairline, the words, then Insert, Preview and Send. */
export function NewComposer({
  draft,
  tools = true,
  autoFocus = false,
  bodyRef,
  sendRef,
  insertRef,
  onSubject,
  onBody,
  onCaret,
  onInsert,
  onPreview,
  onSend,
}: {
  draft: Draft;
  tools?: boolean;
  autoFocus?: boolean;
  bodyRef?: RefObject<TextInputInstance | null>;
  sendRef?: Ref<ViewInstance> | undefined;
  insertRef?: Ref<ViewInstance> | undefined;
  onSubject: (text: string) => void;
  onBody: (text: string) => void;
  onCaret?: (at: number) => void;
  onInsert?: () => void;
  onPreview?: () => void;
  onSend?: () => void;
}) {
  const [focused, setFocused] = useState(0);
  const on = draft.body.trim() !== '';
  const focus = {
    onFocus: () => setFocused((count) => count + 1),
    onBlur: () => setFocused((count) => Math.max(count - 1, 0)),
  };

  return (
    <View style={[styles.composer, focused > 0 && styles.composerOn]}>
      <View style={styles.subjectRow}>
        <TextField
          {...focus}
          value={draft.subject}
          onChangeText={onSubject}
          placeholder={W.subject}
          autoCorrect
          spellCheck
          autoCapitalize="sentences"
          returnKeyType="next"
          maxLength={150}
          style={[styles.bare, styles.subject]}
          accessibilityLabel={W.subject}
          testID="messages.subject"
        />
      </View>
      <TextField
        {...focus}
        ref={bodyRef}
        value={draft.body}
        onChangeText={onBody}
        onSelectionChange={(event) => onCaret?.(event.nativeEvent.selection.end)}
        placeholder={W.writeToGuests}
        multiline
        autoFocus={autoFocus}
        autoCorrect
        spellCheck
        autoCapitalize="sentences"
        maxLength={10000}
        style={[styles.bare, styles.body]}
        accessibilityLabel={W.message}
        testID="messages.body"
      />
      {tools && (
        <View style={styles.tools}>
          <TextAction
            ref={insertRef}
            label={W.insert}
            renderMark={(ink) => <MessageGlyph name="braces" size={17} ink={ink} weight={2.1} />}
            onPress={onInsert ?? (() => undefined)}
            testID="messages.insert"
          />
          <TextAction
            label={W.preview}
            glyph="eye"
            onPress={onPreview ?? (() => undefined)}
            off={!on}
            testID="messages.preview"
          />
          <View style={styles.grow}>
            <Text size={13} weight="medium" style={[styles.secondary, styles.goes]}>
              {W.goesOnTheirPage}
            </Text>
          </View>
          <SendButton ref={sendRef} on={on} onPress={onSend} testID="messages.send" />
        </View>
      )}
    </View>
  );
}

/** Under a guest's conversation: where the answer goes and how they are told, then the field and Send. */
export function AnswerBox({
  name,
  channel,
  value,
  autoFocus = false,
  fieldRef,
  onChange,
  onSend,
}: {
  name: string;
  channel: ChannelKey;
  value: string;
  autoFocus?: boolean;
  fieldRef?: RefObject<TextInputInstance | null>;
  onChange: (text: string) => void;
  onSend: () => void;
}) {
  const on = value.trim() !== '';
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.answer}>
      <View style={styles.answerLine}>
        <View style={styles.markTop}>
          <MessageGlyph name="page" size={15} ink={INK2} />
        </View>
        <Text size={13.5} weight="medium" style={[styles.grow, styles.secondary, styles.line]}>
          {say.answerLine(name, { email: 'email', sms: 'SMS', wa: 'WhatsApp' }[channel])}
        </Text>
      </View>
      <View style={styles.answerRow}>
        <TextField
          ref={fieldRef}
          value={value}
          onChangeText={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={W.writeYourAnswer}
          multiline
          autoFocus={autoFocus}
          autoCorrect
          spellCheck
          autoCapitalize="sentences"
          style={[styles.answerField, focused && styles.answerFieldOn]}
          accessibilityLabel={W.writeYourAnswer}
          testID="messages.answer"
        />
        <SendButton on={on} onPress={onSend} testID="messages.answer.send" />
      </View>
    </View>
  );
}

/** At the list's foot and after a message: To and its chip over a field that opens the composer. */
export function MiniComposer({
  to,
  placeholder,
  onOpen,
}: {
  to: string;
  placeholder: string;
  onOpen: (picking: boolean) => void;
}) {
  return (
    <View style={styles.mini}>
      <View style={styles.miniTo}>
        <Text size={13.5} weight="semibold" style={styles.secondary}>
          {W.to}
        </Text>
        <ToChip text={to} onPress={() => onOpen(true)} />
      </View>
      <View style={styles.miniRow}>
        <Pressable
          onPress={() => onOpen(false)}
          style={({ pressed }) => [styles.miniField, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={placeholder}
          testID="messages.mini"
        >
          <Text size={16} weight="medium" accessible={false} style={styles.placeholder}>
            {placeholder}
          </Text>
        </Pressable>
        <SendButton on={false} testID="messages.mini.send" />
      </View>
    </View>
  );
}

/** The preview's one-line bar: back to the words, Preview on, and Send. */
export function PreviewBar({
  sendRef,
  onEdit,
  onSend,
}: {
  sendRef?: Ref<ViewInstance> | undefined;
  onEdit: () => void;
  onSend: () => void;
}) {
  return (
    <View style={styles.bar}>
      <TextAction label={W.edit} glyph="edit" onPress={onEdit} testID="messages.edit" />
      <TextAction
        label={W.previewOn}
        glyph="eye"
        onPress={onEdit}
        accessibilityLabel={`${W.previewOn}, ${W.preview}`}
        testID="messages.previewOn"
      />
      <View style={styles.grow} />
      <SendButton ref={sendRef} on onPress={onSend} testID="messages.preview.send" />
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: INK2 },
  accent: { color: tokens.colorAccentText },
  figures: { fontVariant: ['tabular-nums'] },
  pressed: { opacity: tokens.opacityPressed },
  placeholder: { color: tokens.colorInkTertiary },
  line: { lineHeight: 13.5 * 1.4 },
  markTop: { paddingTop: 1 },
  send: {
    width: tokens.sizeHit,
    height: tokens.sizeHit,
    borderRadius: tokens.sizeHit / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorAccent,
  },
  sendOff: { backgroundColor: tokens.colorInsetBorder },
  toChip: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexShrink: 1,
    gap: tokens.spaceXs,
    paddingLeft: 14,
    paddingRight: tokens.spaceLg,
    borderRadius: 22,
    backgroundColor: tokens.colorAccentTint,
  },
  head: { gap: tokens.spaceSm },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceMd },
  toWord: { width: 24, minHeight: tokens.sizeHit, justifyContent: 'center' },
  byWord: { minHeight: tokens.sizeHit, justifyContent: 'center' },
  ticks: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
  tick: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    paddingHorizontal: 14,
    borderRadius: 22,
  },
  tickOn: { paddingLeft: 11, backgroundColor: tokens.colorAccentTint },
  tickOff: {
    backgroundColor: tokens.colorCard,
    borderWidth: 1.5,
    borderColor: tokens.colorFieldBorder,
  },
  composer: {
    paddingTop: tokens.spaceLg,
    paddingHorizontal: 14,
    paddingBottom: tokens.spaceXs,
    gap: tokens.spaceSm,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: tokens.colorFieldBorder,
    backgroundColor: tokens.colorCard,
  },
  composerOn: { borderWidth: 2, borderColor: tokens.colorAccent },
  subjectRow: { borderBottomWidth: 1, borderBottomColor: tokens.colorBorder },
  bare: {
    minHeight: tokens.sizeHit,
    paddingHorizontal: 0,
    paddingVertical: tokens.spaceXxs,
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: 'transparent',
  },
  subject: { fontSize: 16, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 24, maxHeight: 220, textAlignVertical: 'top' },
  tools: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  goes: { textAlign: 'right' },
  answer: { gap: tokens.spaceXs },
  answerLine: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceXs },
  answerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: tokens.spaceMd },
  answerField: {
    flex: 1,
    minHeight: tokens.sizeHit,
    maxHeight: 140,
    paddingHorizontal: 14,
    paddingVertical: tokens.spaceMd,
    borderRadius: 22,
    borderWidth: 1.5,
    fontSize: 16,
  },
  answerFieldOn: { borderWidth: 2, borderColor: tokens.colorAccent },
  mini: {
    gap: tokens.spaceSm,
    paddingVertical: tokens.spaceMd,
    paddingLeft: 14,
    paddingRight: tokens.spaceMd,
    borderRadius: tokens.space3xl,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    ...tokens.elevationNative.popover.ios,
    elevation: tokens.elevationNative.popover.android.elevation,
  },
  miniTo: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  miniRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceMd },
  miniField: { flex: 1, minHeight: tokens.sizeHit, justifyContent: 'center' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXl,
    paddingVertical: tokens.spaceXs,
    paddingLeft: 14,
    paddingRight: tokens.spaceXs,
    borderRadius: 22,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    ...tokens.elevationNative.popover.ios,
    elevation: tokens.elevationNative.popover.android.elevation,
  },
});
