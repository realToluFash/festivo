import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';

import { Glyph } from '../../components/Glyph.tsx';
import { ReadOut } from '../../components/ReadOut.tsx';
import { moveScreenReaderFocus } from '../../components/screenReaderFocus.ts';
import { Pill } from '../../components/SettingsParts.tsx';
import { TextAction } from '../../components/Summary.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { ASK_MS, type Ask, askAnswered, pressAsk } from './CheckWaits.ts';
import { DeliveryMark, MessageGlyph } from './MessageMarks.tsx';
import { CHANNEL_IN_LINE, CHANNEL_WORD, type ChannelKey, W, WW, say } from './MessagesWords.ts';
import type { Extra, Refusal } from './NoticeStates.ts';
import { NW, sayNotice } from './NoticeWords.ts';
import { DayRule, GuestBubble, SystemLine } from './Stream.tsx';

const INK2 = tokens.colorInkSecondary;

/** What Soirely wrote into a conversation after the guest's question (sc-3976): a stop or start keyword, a shared number, a later email. */
export function noticeExtras(extras: readonly Extra[], name: string) {
  return extras.map((extra, index) => {
    const key = `extra.${index}`;

    switch (extra.kind) {
      case 'today':
        return <DayRule key={key} text={W.today} />;
      case 'stopped':
        return (
          <SystemLine
            key={key}
            mark="slash"
            text={
              extra.channel === 'sms'
                ? sayNotice.stoppedTexts(name, extra.time)
                : sayNotice.stoppedWhatsApp(name, extra.time)
            }
          />
        );
      case 'started':
        return <SystemLine key={key} mark="sms" text={sayNotice.startedTexts(name, extra.time)} />;
      case 'shared':
        return (
          <SystemLine key={key} mark="group" text={sayNotice.shareNumberLast(extra.count, name)} />
        );
      default:
        return (
          <GuestBubble
            key={key}
            text={extra.text}
            where="email"
            when={extra.time}
            more={[{ word: sayNotice.attachmentsNotKept(extra.attachments), clip: true }]}
          />
        );
    }
  });
}

/** Over the answer line when the 24 hours closed between writing and Send: nothing went, and what Send does now. */
export function WindowClosed({ again }: { again: boolean }) {
  return (
    <ReadOut words={NW.windowRanOut} accessibilityRole="alert" style={styles.block}>
      <View style={styles.row}>
        <View style={styles.markTop}>
          <Glyph name="alert" size={15} ink={tokens.colorBroken} weight={2.3} />
        </View>
        <Text size={14} weight="medium" style={[styles.grow, styles.line, styles.broken]}>
          {NW.windowRanOut}
        </Text>
      </View>
      {again && (
        <Text size={13.5} weight="medium" style={[styles.indent, styles.line, styles.secondary]}>
          {NW.sendAgainTemplate}
        </Text>
      )}
    </ReadOut>
  );
}

/** The notice refused on the answer's channel: the reason with Who it reached's mark, and the guest's other channels. */
export function RefusedLines({
  refusal,
  name,
  channel,
  onTellBy,
}: {
  refusal: Refusal;
  name: string;
  channel: ChannelKey;
  onTellBy?: ((channel: ChannelKey) => void) | undefined;
}) {
  return (
    <View style={styles.block} testID="messages.answer.refused">
      <View style={styles.row}>
        <View style={styles.markTop}>
          <MessageGlyph name="page" size={15} ink={INK2} />
        </View>
        <Text size={13.5} weight="medium" style={[styles.grow, styles.line, styles.secondary]}>
          {sayNotice.cannotTell(name, CHANNEL_IN_LINE[channel])}
        </Text>
      </View>
      <View style={[styles.row, styles.indent]}>
        <View style={styles.markTop}>
          <DeliveryMark mark={refusal.mark} side={15} />
        </View>
        <Text size={14} weight="semibold" style={[styles.grow, styles.line]}>
          {refusal.reason}
        </Text>
      </View>
      {refusal.others.length === 0 || onTellBy == null ? (
        <Text size={13.5} weight="medium" style={[styles.indent, styles.line]}>
          {NW.noOther}
        </Text>
      ) : (
        <View style={[styles.block, styles.indent]}>
          <Text size={13.5} weight="medium" style={styles.line}>
            {NW.tellNowBy}
          </Text>
          <View style={styles.others}>
            {refusal.others.map((other) => (
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
  );
}

/** Ask an owner in the notice's wait, for a member without billing.manage, as sc-3963's check has it. */
export function NoticeAsk({ start, owners = 2 }: { start: Ask; owners?: number }) {
  const [ask, setAsk] = useState<Ask>(start);
  const now = useRef<Ask>(start);
  const pressed = useRef(false);
  const sentRef = useRef<ViewInstance>(null);
  const answer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sent = say.ownersAsked(owners);

  const move = (next: Ask) => {
    now.current = next;
    setAsk(next);
  };
  const onAsk = () => {
    const next = pressAsk(now.current);
    if (!next.sends) return;
    pressed.current = true;
    move(next.ask);
    answer.current = setTimeout(() => move(askAnswered(now.current, true)), ASK_MS);
  };

  useEffect(
    () => () => {
      if (answer.current != null) clearTimeout(answer.current);
    },
    [],
  );
  useEffect(() => {
    if (ask !== 'sent' || !pressed.current) return undefined;
    const later = setTimeout(() => moveScreenReaderFocus(sentRef.current), 350);

    return () => clearTimeout(later);
  }, [ask]);

  if (ask === 'sent')
    return (
      <View ref={sentRef} accessible accessibilityLabel={sent} testID="messages.answer.askSent">
        <ReadOut words={sent} style={styles.row}>
          <View style={styles.markTop}>
            <Glyph name="tick" size={15} ink={tokens.colorAccentText} weight={2.8} />
          </View>
          <Text size={13.5} weight="medium" accessible={false} style={[styles.grow, styles.line]}>
            {sent}
          </Text>
        </ReadOut>
      </View>
    );

  return (
    <View style={styles.block}>
      <View style={styles.ask}>
        <TextAction label={WW.askOwner} onPress={onAsk} testID="messages.answer.askOwner" />
      </View>
      {ask === 'failed' && (
        <ReadOut
          words={WW.askFailed}
          interrupts
          accessibilityRole="alert"
          style={styles.row}
          testID="messages.answer.askFailed"
        >
          <View style={styles.markTop}>
            <Glyph name="alert" size={15} ink={tokens.colorBroken} weight={2.3} />
          </View>
          <Text size={13.5} weight="semibold" style={[styles.grow, styles.line, styles.broken]}>
            {WW.askFailed}
          </Text>
        </ReadOut>
      )}
    </View>
  );
}

/** Where a composer would be, for a member who can't send (sc-3957's line; pm, call 5). */
export function NoManageCard() {
  return (
    <View style={styles.card} testID="messages.noManage">
      <View style={styles.markTop}>
        <Glyph name="info" size={16} ink={INK2} weight={2.2} />
      </View>
      <Text size={14} weight="medium" style={[styles.grow, styles.line, styles.secondary]}>
        {NW.onlyManage}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: tokens.spaceXs },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceXs },
  markTop: { paddingTop: 1 },
  grow: { flex: 1, minWidth: 0 },
  line: { lineHeight: 13.5 * 1.4 },
  indent: { paddingLeft: 23 },
  secondary: { color: INK2 },
  broken: { color: tokens.colorBroken },
  others: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
  ask: { flexDirection: 'row' },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceXs,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorInset,
  },
});
