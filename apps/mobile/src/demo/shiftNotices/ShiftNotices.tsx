import { type ReactNode, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { SecondaryButton } from '../../components/Buttons.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { Notice } from '../../components/Notice.tsx';
import { OnOffSwitch } from '../../components/OnOffSwitch.tsx';
import { ReadOut, readOut } from '../../components/ReadOut.tsx';
import { ShapeMark } from '../../components/StatusMark.tsx';
import { Text } from '../../components/Text.tsx';
import { useLayout } from '../../layout/useLayout.ts';
import { tokens } from '../../theme/tokens.ts';
import type { BriefingParts } from '../briefing/StaffBriefing.tsx';
import { ISSUE_MS, type Person } from '../briefing/briefingModel.ts';
import { type Ask } from '../messages/CheckWaits.ts';
import { MessageGlyph } from '../messages/MessageMarks.tsx';
import {
  type LineMark,
  type ShiftState,
  SW,
  cardOf,
  delivered,
  rowLines,
  sendsOffered,
  shiftStart,
} from './shiftNoticesModel.ts';
import { useOwnerAsk } from '../messages/useOwnerAsk.ts';

const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

export interface ShiftParts {
  card: ReactNode;
  foot: ReactNode;
  demo: ReactNode;
  restart: () => void;
}

/** sc-4333 on the Staff page: the reminder card above the roster and the board's switches. The app offers no removal (sc-77903). The rows' lines are the briefing's, through `NoticeLines`. */
export function useShiftNotices(
  state: ShiftState | null,
  brief: BriefingParts | null,
): ShiftParts | null {
  const [opening] = useState(() => (state == null ? null : shiftStart(state)));
  const [on, setOn] = useState(opening?.on ?? true);
  const [failed, setFailed] = useState<boolean | null>(opening?.failedAt ?? null);
  const [saveFails, setSaveFails] = useState(opening?.saveFails ?? false);
  const [saving, setSaving] = useState(false);
  const [askKey, setAskKey] = useState(0);
  const phone = useLayout().kind === 'phone';

  if (state == null || opening == null || brief == null) return null;

  const people = brief.people;
  const view = cardOf({
    people,
    on,
    finished: opening.finished,
    lastSent: opening.lastSent,
    balance: opening.balance,
    manage: opening.manage,
    billing: opening.billing,
  });

  function flip(next: boolean) {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      if (saveFails) {
        setFailed(on);
        readOut(on ? SW.stillOn : SW.stillOff);
        return;
      }
      setFailed(null);
      setOn(next);
    }, ISSUE_MS);
  }

  function restart() {
    const fresh = shiftStart(state as ShiftState);
    setOn(fresh.on);
    setFailed(fresh.failedAt);
    setSaveFails(fresh.saveFails);
    setSaving(false);
    setAskKey((key) => key + 1);
  }

  const shortfall = view.shortfall && (
    <View style={phone ? styles.warnStacked : styles.warnBeside} testID="shift.card.shortfall">
      <View style={[styles.inline, styles.warnWords]}>
        <Glyph name="warn" size={18} ink={tokens.colorAttention} />
        <Text size={14} weight="semibold" style={[styles.attention, styles.shrink]}>
          {view.shortfall.words}
        </Text>
      </View>
      {view.shortfall.way === 'notInApp' ? (
        <Text size={14} weight="medium" style={styles.secondary} testID="shift.card.notInApp">
          {SW.notInApp}
        </Text>
      ) : (
        <AskOwner key={askKey} start={opening.ask} owners={opening.owners} />
      )}
    </View>
  );
  const boxed =
    view.only != null || view.next != null || view.shortfall != null || view.leftOut.length > 0;

  const card = (
    <View style={styles.stack}>
      {opening.overNotice && (
        <View testID="shift.over">
          <Notice tone="quiet" mark="info" body={SW.alreadyOver} />
        </View>
      )}
      <View style={styles.card} testID={`shift.card.${state}`}>
        <View style={styles.head}>
          <Text
            size={tokens.typeTitleSection.size}
            weight="bold"
            accessibilityRole="header"
            style={styles.grow}
          >
            {SW.heading}
          </Text>
          {view.control === 'switch' && (
            <OnOffSwitch
              on={on}
              words={{ on: SW.on, off: SW.off }}
              label={SW.switchLabel}
              busy={saving}
              onChange={flip}
              testID="shift.card.switch"
            />
          )}
          {view.control === 'word' && (
            <Text size={15} weight="semibold" style={on ? styles.accent : styles.secondary}>
              {on ? SW.on : SW.off}
            </Text>
          )}
        </View>
        {failed != null && view.control === 'switch' && (
          <View style={styles.inline} testID="shift.card.failed">
            <Glyph name="alert" size={16} ink={tokens.colorBrokenText} />
            <Text size={14} weight="semibold" style={[styles.broken, styles.shrink]}>
              {failed ? SW.stillOn : SW.stillOff}
            </Text>
          </View>
        )}
        {view.what != null && (
          <Text size={15} style={styles.secondary}>
            {view.what}
          </Text>
        )}
        {boxed && (
          <View style={styles.box} testID="shift.card.lines">
            {view.only != null && (
              <Text size={15} weight="semibold">
                {view.only}
              </Text>
            )}
            {view.next != null && (
              <Text size={15} weight="semibold">
                {view.next}
              </Text>
            )}
            {view.cost != null && (
              <Text size={13} style={styles.secondary} testID="shift.card.cost">
                {view.cost}
              </Text>
            )}
            {shortfall}
            {view.leftOut.map((line) => (
              <Text key={line} size={13} style={styles.secondary}>
                {line}
              </Text>
            ))}
          </View>
        )}
      </View>
    </View>
  );

  const foot = sendsOffered(opening.finished) && people.length > 0 && (
    <Text size={14} style={styles.secondary} testID="shift.foot">
      {SW.footnote}
    </Text>
  );

  const demo = (
    <>
      {sendsOffered(opening.finished) && (
        <SecondaryButton
          label="Time passes: the waiting and held messages go"
          onPress={() => brief.commit(people.map(delivered))}
          testID="shift.demo.time"
        />
      )}
      {view.control === 'switch' && (
        <SecondaryButton
          label={saveFails ? 'The switch fails to save · on' : 'The switch fails to save'}
          onPress={() => setSaveFails(!saveFails)}
          testID="shift.demo.saveFails"
        />
      )}
    </>
  );

  return { card, foot, demo, restart };
}

/** Ask an owner, as sc-3931 has it: the owners are sent the link to Plan and billing, or Not sent and try again. */
function AskOwner({ start, owners }: { start: Ask; owners: number }) {
  const { ask, onAsk, sentRef } = useOwnerAsk(start);
  const sent = SW.asked(owners);

  if (ask === 'sent')
    return (
      <View ref={sentRef} accessible accessibilityLabel={sent} testID="shift.card.askSent">
        <ReadOut words={sent} style={styles.inline}>
          <Glyph name="tick" size={15} ink={tokens.colorAccentText} weight={2.8} />
          <Text size={14} weight="medium" accessible={false} style={styles.shrink}>
            {sent}
          </Text>
        </ReadOut>
      </View>
    );

  return (
    <View style={styles.ask}>
      <SecondaryButton
        label={SW.askOwner}
        off={ask === 'asking'}
        onPress={onAsk}
        testID="shift.card.ask"
      />
      {ask === 'failed' && (
        <ReadOut
          words={SW.askFailed}
          interrupts
          accessibilityRole="alert"
          style={styles.inline}
          testID="shift.card.askFailed"
        >
          <Glyph name="alert" size={15} ink={tokens.colorBroken} weight={2.3} />
          <Text size={14} weight="semibold" style={[styles.broken, styles.shrink]}>
            {SW.askFailed}
          </Text>
        </ReadOut>
      )}
    </View>
  );
}

/** The lines under a person's Briefing word, each with its own shape beside its words. */
export function NoticeLines({ one }: { one: Person }) {
  const lines = rowLines(one);
  if (lines.length === 0) return null;

  return (
    <View style={styles.lines} testID={`shift.row.${one.id}`}>
      {lines.map((line, index) => (
        <View key={`${index}:${line.words}`} style={styles.line}>
          {line.mark == null ? <View style={styles.markSpace} /> : <LineShape mark={line.mark} />}
          <Text
            size={13}
            weight={line.mark == null || line.quiet === true ? 'regular' : 'semibold'}
            accessible={false}
            style={[
              styles.shrink,
              line.mark === 'failed' && styles.broken,
              line.mark === 'unreachable' && styles.attention,
              (line.mark == null || line.quiet === true) && styles.secondary,
            ]}
          >
            {line.words}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** The words a screen reader hears for a row's lines, after its Briefing word. */
export function noticeWords(one: Person): string {
  return rowLines(one)
    .map((line) => line.words)
    .join(' ');
}

/** Can't be reached's "!", in place of Not sent's dashed ring. */
export function UnreachableMark({ side = 16 }: { side?: number }) {
  return (
    <View {...hidden} style={[styles.bang, { width: side, height: side, borderRadius: side / 2 }]}>
      <Text size={Math.round(side * 0.7)} weight="bold" accessible={false} style={styles.onDark}>
        !
      </Text>
    </View>
  );
}

const SIDE = 14;

function LineShape({ mark }: { mark: LineMark }) {
  switch (mark) {
    case 'waiting':
      return <Glyph name="clock" size={SIDE} ink={tokens.colorInkSecondary} />;
    case 'quiet':
      return <ShapeMark kind="paused" side={SIDE} ink={tokens.colorAttention} />;
    case 'push':
      return <Glyph name="bell" size={SIDE} ink={tokens.colorAccentText} />;
    case 'sms':
      return <MessageGlyph name="sms" size={SIDE} ink={tokens.colorAccentText} />;
    case 'whatsApp':
      return <MessageGlyph name="wa" size={SIDE} ink={tokens.colorAccentText} />;
    case 'failed':
      return <MessageGlyph name="cross" size={SIDE} ink={tokens.colorBroken} weight={2.4} />;
    case 'unreachable':
      return <UnreachableMark side={SIDE} />;
    case 'calledOff':
      return (
        <View {...hidden} style={styles.square}>
          <View style={styles.strike} />
        </View>
      );
    case 'ended':
      return (
        <View {...hidden} style={styles.square}>
          <View style={styles.stop} />
        </View>
      );
  }
}

const styles = StyleSheet.create({
  stack: { gap: tokens.spaceMd },
  card: {
    gap: tokens.spaceMd,
    padding: tokens.spaceXl,
    borderRadius: tokens.radiusCardLarge,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceMd },
  grow: { flex: 1, minWidth: 0 },
  box: {
    gap: tokens.spaceXs,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusCardPhone,
    backgroundColor: tokens.colorInset,
  },
  inline: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  warnStacked: { gap: tokens.spaceMd, paddingVertical: tokens.spaceXs },
  warnBeside: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingVertical: tokens.spaceXs,
  },
  warnWords: { flexGrow: 1, flexShrink: 1, flexBasis: 320 },
  lines: { gap: tokens.spaceXxs },
  line: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  markSpace: { width: SIDE },
  bang: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorAttention,
  },
  onDark: { color: tokens.colorInkOnDark },
  square: {
    width: SIDE,
    height: SIDE,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: tokens.colorInkSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  strike: {
    width: SIDE * 1.3,
    height: 1.5,
    backgroundColor: tokens.colorInkSecondary,
    transform: [{ rotate: '-45deg' }],
  },
  stop: { width: 6, height: 6, borderRadius: 1, backgroundColor: tokens.colorInkSecondary },
  ask: { gap: tokens.spaceSm },
  secondary: { color: tokens.colorInkSecondary },
  attention: { color: tokens.colorAttentionText },
  broken: { color: tokens.colorBrokenText },
  accent: { color: tokens.colorAccentText },
  shrink: { flexShrink: 1 },
});
