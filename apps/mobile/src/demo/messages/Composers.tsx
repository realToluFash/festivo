import { type Ref, type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  type TextInputInstance,
  View,
  type ViewInstance,
} from 'react-native';

import { FieldError, TextField, type TextFieldProps } from '../../components/Field.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { Pill } from '../../components/SettingsParts.tsx';
import { TextAction } from '../../components/Summary.tsx';
import { DeliveryMark, MessageGlyph } from './MessageMarks.tsx';
import {
  type Draft,
  MESSAGE_MOST,
  type NoticeCost,
  SUBJECT_MOST,
  matchesNobody,
  toChip,
} from './MessagesModel.ts';
import { formatCount, piecesOf } from './MessagesSample.ts';
import { keepWhole, outsideToken, tokenText } from './TokenText.ts';
import { CHANNEL_IN_LINE, CHANNEL_WORD, type ChannelKey, W, say } from './MessagesWords.ts';

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
  off = false,
}: {
  text: string;
  onPress: () => void;
  ref?: Ref<ViewInstance> | undefined;
  open?: boolean;
  off?: boolean;
}) {
  return (
    <Pressable
      ref={ref}
      onPress={off ? undefined : onPress}
      disabled={off}
      style={({ pressed }) => [styles.toChip, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${W.to}, ${text}`}
      accessibilityState={{ expanded: open, disabled: off }}
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
  locked = false,
  toRef,
  onTo,
  onChannel,
}: {
  draft: Draft;
  picking: boolean;
  locked?: boolean;
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
        {locked ? (
          <View
            style={styles.toChip}
            accessible
            accessibilityLabel={`${W.to}, ${toChip(draft.to, draft.zero)}`}
          >
            <Text
              size={14}
              weight="semibold"
              accessible={false}
              style={[styles.accent, styles.figures]}
            >
              {toChip(draft.to, draft.zero)}
            </Text>
          </View>
        ) : (
          <ToChip ref={toRef} text={toChip(draft.to, draft.zero)} onPress={onTo} open={picking} />
        )}
        {matchesNobody(draft) && (
          <View style={styles.nobody} testID="messages.nobody">
            <Glyph name="info" size={15} ink={INK2} weight={2.2} />
            <Text size={14} weight="semibold" style={styles.secondary}>
              {W.nobodyMatches}
            </Text>
          </View>
        )}
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
  locale = 'en-US',
  subjectRef,
  bodyRef,
  sendRef,
  insertRef,
  onSubject,
  onBody,
  onCaret,
  onInsert,
  onPreview,
  onSend,
  editing,
}: {
  draft: Draft;
  tools?: boolean;
  autoFocus?: boolean;
  locale?: string;
  subjectRef?: RefObject<TextInputInstance | null>;
  bodyRef?: RefObject<TextInputInstance | null>;
  sendRef?: Ref<ViewInstance> | undefined;
  insertRef?: Ref<ViewInstance> | undefined;
  onSubject: (text: string) => void;
  onBody: (text: string) => void;
  onCaret?: (at: number) => void;
  onInsert?: () => void;
  onPreview?: () => void;
  onSend?: () => void;
  editing?: { onChangeWhen: () => void; onSave: () => void } | undefined;
}) {
  const [focused, setFocused] = useState(0);
  const on = draft.body.trim() !== '';
  const most = (count: number) => new Intl.NumberFormat(locale).format(count);
  const subjectOver = draft.over.includes('subject');
  const bodyOver = draft.over.includes('body');
  const focus = {
    onFocus: () => setFocused((count) => count + 1),
    onBlur: () => setFocused((count) => Math.max(count - 1, 0)),
  };

  return (
    <View style={[styles.composer, focused > 0 && styles.composerOn]}>
      <View style={styles.subjectRow}>
        <TextField
          {...focus}
          ref={subjectRef}
          wrong={subjectOver}
          value={draft.subject}
          onChangeText={onSubject}
          placeholder={W.subject}
          autoCorrect
          spellCheck
          autoCapitalize="sentences"
          returnKeyType="next"
          style={[styles.bare, styles.subject]}
          accessibilityLabel={W.subject}
          testID="messages.subject"
        />
        {subjectOver && (
          <View style={styles.bodyError}>
            <FieldError message={say.subjectTooLong(most(SUBJECT_MOST))} />
          </View>
        )}
      </View>
      <TokenField
        {...focus}
        wrong={bodyOver}
        text={draft.body}
        fieldRef={bodyRef}
        onText={onBody}
        onCaret={onCaret}
        placeholder={W.writeToGuests}
        multiline
        autoFocus={autoFocus}
        autoCorrect
        spellCheck
        autoCapitalize="sentences"
        style={[styles.bare, styles.body]}
        label={W.message}
        testID="messages.body"
      />
      {bodyOver && (
        <View style={styles.bodyError}>
          <FieldError message={say.messageTooLong(most(MESSAGE_MOST))} />
        </View>
      )}
      {tools && (
        <View style={styles.tools}>
          <TextAction
            ref={insertRef}
            label={W.insert}
            renderMark={(ink) => <MessageGlyph name="braces" size={17} ink={ink} weight={2.1} />}
            onPress={onInsert ?? (() => undefined)}
            testID="messages.insert"
          />
          {editing == null ? (
            <>
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
            </>
          ) : (
            <>
              <TextAction
                label={W.changeWhen}
                glyph="clock"
                onPress={editing.onChangeWhen}
                testID="messages.changeWhen"
              />
              <View style={styles.grow} />
              <Pill
                label={W.save}
                height={tokens.sizeHit}
                full={false}
                kind={on ? 'primary' : 'off'}
                onPress={editing.onSave}
                testID="messages.saveScheduled"
              />
            </>
          )}
        </View>
      )}
    </View>
  );
}

/** The words, each inserted token one run: taken whole, the caret kept at its edges. */
function TokenField({
  label,
  text,
  fieldRef,
  onText,
  onCaret,
  ...rest
}: Omit<TextFieldProps, 'value' | 'onChangeText' | 'children' | 'accessibilityLabel'> & {
  label: string;
  text: string;
  fieldRef?: RefObject<TextInputInstance | null> | undefined;
  onText: (text: string) => void;
  onCaret?: ((at: number) => void) | undefined;
}) {
  const own = useRef<TextInputInstance>(null);
  const field = fieldRef ?? own;
  const caretTo = useRef<number | null>(null);
  const latest = useRef(text);
  const backspace = useRef(false);
  const pieces = piecesOf(text);
  const named = [...new Set(pieces.filter((piece) => piece.token).map((piece) => piece.text))];

  useLayoutEffect(() => {
    latest.current = text;
  }, [text]);

  useEffect(() => {
    const at = caretTo.current;
    if (at == null) return;
    caretTo.current = null;
    field.current?.setSelection(at, at);
  }, [text, field]);

  return (
    <TextField
      {...rest}
      ref={field}
      accessibilityLabel={label}
      onKeyPress={(event) => {
        backspace.current = event.nativeEvent.key === 'Backspace';
      }}
      onChangeText={(next) => {
        const kept = keepWhole(latest.current, next, backspace.current);
        backspace.current = false;
        latest.current = kept.text;
        if (kept.text !== next) caretTo.current = kept.caret;
        onText(kept.text);
      }}
      onSelectionChange={(event) => {
        const { start, end } = event.nativeEvent.selection;
        const from = outsideToken(latest.current, start);
        const to = outsideToken(latest.current, end);
        if (from !== start || to !== end) field.current?.setSelection(from, to);
        onCaret?.(to);
      }}
      accessibilityHint={
        named.length > 0 ? named.map((token) => `${say.tokenName(token)}.`).join(' ') : undefined
      }
    >
      {pieces.map((piece, at) =>
        piece.token ? (
          <Text key={at} size={16} weight="semibold" style={styles.tokenRun}>
            {tokenText(piece.text)}
          </Text>
        ) : (
          piece.text
        ),
      )}
    </TextField>
  );
}

/** Under a guest's conversation: where the answer goes, how they are told and what that costs, then the field and Send. */
export function AnswerBox({
  name,
  channel,
  cost = null,
  others = [],
  value,
  autoFocus = false,
  fieldRef,
  onChange,
  onTellBy,
  onSend,
}: {
  name: string;
  channel: ChannelKey;
  cost?: NoticeCost | null;
  others?: readonly ChannelKey[];
  value: string;
  autoFocus?: boolean;
  fieldRef?: RefObject<TextInputInstance | null>;
  onChange: (text: string) => void;
  onTellBy?: (channel: ChannelKey) => void;
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
        <View style={[styles.grow, styles.lines]}>
          <Text size={13.5} weight="medium" style={[styles.secondary, styles.line]}>
            {say.answerLine(name, CHANNEL_IN_LINE[channel])}
          </Text>
          {cost != null && !cost.waits && (
            <Text
              size={13.5}
              weight="medium"
              style={[styles.secondary, styles.line]}
              testID="messages.answer.cost"
            >
              {say.noticeCost(cost.channel, cost.credits, formatCount(cost.after))}
            </Text>
          )}
        </View>
      </View>
      {cost?.waits === true && (
        <View style={styles.waits} testID="messages.answer.waits">
          <View style={styles.answerLine}>
            <View style={styles.markTop}>
              <DeliveryMark mark="sending" side={15} />
            </View>
            <View style={[styles.grow, styles.lines]}>
              <Text size={14} weight="semibold" style={styles.line}>
                {say.noticeWaits(cost.channel)}
              </Text>
              <Text size={13.5} weight="medium" style={[styles.secondary, styles.line]}>
                {W.creditsNotInApp}
              </Text>
            </View>
          </View>
          {others.length > 0 && onTellBy != null && (
            <View style={styles.others}>
              <Text size={13.5} weight="medium" style={[styles.secondary, styles.line]}>
                {W.tellNowBy}
              </Text>
              <View style={styles.otherRow}>
                {others.map((other) => (
                  <Pill
                    key={other}
                    label={CHANNEL_WORD[other]}
                    kind="secondary"
                    height={tokens.sizeHit}
                    full={false}
                    accessibilityLabel={say.tellNowAs(CHANNEL_IN_LINE[other])}
                    onPress={() => onTellBy(other)}
                    testID={`messages.answer.tellBy.${other}`}
                  />
                ))}
              </View>
            </View>
          )}
        </View>
      )}
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
  off = false,
  reason,
  onOpen,
}: {
  to: string;
  placeholder: string;
  off?: boolean;
  /** Why nothing can be sent from this event, shown over the composer it turns off. */
  reason?: string | null | undefined;
  onOpen: (picking: boolean) => void;
}) {
  const closed = reason != null;

  return (
    <View style={styles.mini}>
      {closed && <WhyNot words={reason} />}
      <View style={styles.miniTo}>
        <Text size={13.5} weight="semibold" style={styles.secondary}>
          {W.to}
        </Text>
        <ToChip text={to} off={off || closed} onPress={() => onOpen(true)} />
      </View>
      <View style={styles.miniRow}>
        <Pressable
          onPress={off || closed ? undefined : () => onOpen(false)}
          disabled={off || closed}
          style={({ pressed }) => [styles.miniField, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={closed ? `${placeholder}, ${reason}` : placeholder}
          accessibilityState={{ disabled: off || closed }}
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

/** Why New is unavailable: the mark and the reason, in the secondary ink, never colour alone. */
export function WhyNot({ words }: { words: string }) {
  return (
    <View style={styles.whyNot} testID="messages.closed">
      <View style={styles.whyMark}>
        <Glyph name="info" size={16} ink={INK2} weight={2.2} />
      </View>
      <Text size={14} weight="medium" style={[styles.secondary, styles.whyWords]}>
        {words}
      </Text>
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
  bodyError: { paddingBottom: tokens.spaceXs },
  whyNot: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceXs },
  whyMark: { paddingTop: 2 },
  whyWords: { flex: 1, lineHeight: 14 * 1.4 },
  nobody: {
    flexShrink: 1,
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXxs,
  },
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
  tokenRun: { color: tokens.colorAccentText, backgroundColor: tokens.colorAccentTint },
  tools: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  goes: { textAlign: 'right' },
  answer: { gap: tokens.spaceXs },
  answerLine: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceXs },
  lines: { gap: tokens.spaceHair },
  waits: {
    gap: tokens.spaceSm,
    padding: tokens.spaceMd,
    borderRadius: tokens.radiusInset,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  others: { gap: tokens.spaceXs },
  otherRow: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
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
