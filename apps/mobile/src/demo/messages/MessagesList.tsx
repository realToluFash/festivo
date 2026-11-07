import { type ReactNode, useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View, type ViewInstance } from 'react-native';

import { Glyph } from '../../components/Glyph.tsx';
import { Text } from '../../components/Text.tsx';
import { useReducedMotion } from '../../reducedMotion.ts';
import { tokens } from '../../theme/tokens.ts';
import { EventThumb } from '../events/EventCard.tsx';
import { meshFor } from '../events/EventsSample.ts';
import { Avatar, Pill } from '../settings/parts.tsx';
import {
  type ListItem,
  Row,
  RowList,
  type RowTag,
  RowShapes,
  TextAction,
} from '../settings/Summary.tsx';
import { MessageGlyph } from './MessageMarks.tsx';
import {
  type Messages,
  type RowId,
  draftLine,
  draftTitle,
  isScheduled,
  justNow,
  ownThreads,
  rowDay,
  sectionsOf,
} from './MessagesModel.ts';
import {
  GUESTS,
  NOW,
  PARKING,
  PARKING_REACH,
  READER,
  SAMPLE_EVENT_ID,
  DAYS,
  INVITATION,
} from './MessagesSample.ts';
import { CHANNEL_WORD, W, say } from './MessagesWords.ts';

export type { RowId };

export function sameOpen(m: Messages, id: RowId): boolean {
  const open = m.open;
  if (open == null) return false;
  if (open.kind === 'reached')
    return open.of === 'draft'
      ? id.kind === 'draft' && m.thread?.id === id.id
      : id.kind === 'many' && id.key === open.of;
  if (open.kind === 'draft' || id.kind === 'draft')
    return open.kind === id.kind && id.kind === 'draft' && m.thread?.id === id.id;

  return open.kind === id.kind && open.key === id.key;
}

export function rowName(id: RowId): string {
  return id.kind === 'draft' ? id.id : id.key;
}

/** A message to many leads with a tile in the event's own Confetti and the group mark. */
export function GroupTile({ side = 40 }: { side?: number }) {
  return (
    <View style={{ width: side, height: side }}>
      <EventThumb
        event={{ id: SAMPLE_EVENT_ID, mesh: meshFor(SAMPLE_EVENT_ID), photo: false }}
        side={side}
        radius={12}
      />
      <View
        style={[styles.groupMark, { borderRadius: 12 }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <MessageGlyph
          name="group"
          size={Math.round(side * 0.5)}
          ink={tokens.colorInkOnDark}
          weight={2.1}
        />
      </View>
    </View>
  );
}

interface Shown {
  title: string;
  titleLines?: number;
  line: string;
  time: string;
  lead: ReactNode;
  tag?: RowTag | undefined;
}

function shownRow(m: Messages, id: RowId, locale: string): Shown {
  if (id.kind === 'draft') {
    const own = ownThreads(m).find((one) => one.id === id.id);
    const draft = own?.draft;
    const tag: RowTag | undefined =
      draft == null
        ? undefined
        : draft.step === 'failed'
          ? { kind: 'notyet', word: W.notSent }
          : draft.step === 'cancelled'
            ? { kind: 'ended', word: W.cancelledTag }
            : isScheduled(draft)
              ? { kind: 'notyet', word: W.scheduled }
              : undefined;
    return {
      title: own == null ? W.newMessage : draftTitle(own.draft, own.thread),
      titleLines: 1,
      line: own == null ? '' : draftLine(own.draft, own.thread, locale),
      time: draft == null || isScheduled(draft) ? '' : draft.time || NOW,
      lead: <GroupTile />,
      tag,
    };
  }
  if (id.kind === 'many') {
    if (id.key === 'parking')
      return {
        title: PARKING,
        line: `${W.toAllGuests} · ${say.didntGetIt(PARKING_REACH.notReached)}`,
        time: rowDay(DAYS.parking, '', locale),
        lead: <GroupTile />,
        tag: { kind: 'waiting', word: say.notReached(PARKING_REACH.notReached) },
      };
    return {
      title: W.invitation,
      line: `${W.toAllGuests} · ${say.reached(INVITATION.reached, INVITATION.of)}`,
      time: rowDay(DAYS.invite, '', locale),
      lead: <GroupTile />,
    };
  }
  const guest = GUESTS[id.key];
  const answer = m.answers[id.key];
  const done = m.done.includes(id.key) || id.key === 'marta';
  const where = guest.asked.where === 'page' ? W.onTheirPage : CHANNEL_WORD[guest.asked.where];
  const asked =
    id.key === 'marta' ? `${guest.asked.text} · ${say.doneByShort(READER)}` : guest.asked.text;

  const unmatched = id.key === 'unknown' && m.matched == null;
  const name = id.key === 'unknown' && m.matched != null ? m.matched : guest.name;
  const initials =
    id.key === 'unknown' && m.matched != null
      ? m.matched
          .split(' ')
          .map((part) => part[0] ?? '')
          .join('')
      : guest.initials;

  return {
    title: name,
    line: answer == null ? say.where(where, asked) : say.where(W.onTheirPage, say.you(answer.text)),
    time:
      answer?.time ??
      (id.key === 'lucia' && m.arrived
        ? justNow(locale)
        : rowDay(guest.asked.day, guest.asked.time, locale)),
    lead: <Avatar initials={initials} side={40} tone={done ? 4 : 0} />,
    tag: unmatched ? { kind: 'notyet', word: W.notMatched } : undefined,
  };
}

/** A row that has just arrived: it slides in from 8 above, and its Tint wash fades over two seconds (at once after two with Reduce Motion). */
function Arriving({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const [rise] = useState(() => new Animated.Value(reduced ? 0 : -8));
  const [wash] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (reduced) {
      const gone = setTimeout(() => wash.setValue(0), 2000);
      return () => clearTimeout(gone);
    }
    const run = Animated.parallel([
      Animated.timing(rise, {
        toValue: 0,
        duration: tokens.motionBase,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(wash, {
        toValue: 0,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ]);
    run.start();

    return () => run.stop();
  }, [reduced, rise, wash]);

  return (
    <Animated.View style={{ transform: [{ translateY: rise }] }}>
      <Animated.View style={[styles.wash, { opacity: wash }]} pointerEvents="none" />
      {children}
    </Animated.View>
  );
}

function SectionTitle({ word, count }: { word: string; count?: number }) {
  return (
    <View
      style={styles.sectionHead}
      accessible
      accessibilityRole="header"
      accessibilityLabel={count == null ? word : say.section(word, count)}
    >
      <Text size={15} weight="bold" accessible={false}>
        {word}
      </Text>
      {count != null && (
        <Text
          size={15}
          weight="semibold"
          accessible={false}
          style={[styles.secondary, styles.figures]}
        >
          {` · ${count}`}
        </Text>
      )}
    </View>
  );
}

function Untold({
  what,
  onTell,
  onDismiss,
}: {
  what: string;
  onTell: () => void;
  onDismiss: () => void;
}) {
  return (
    <View style={styles.untold}>
      <View style={styles.untoldHead}>
        <Glyph name="alert" size={16} ink={tokens.colorAttention} weight={2.2} />
        <Text size={15.5} weight="bold" accessibilityRole="header" style={styles.grow}>
          {W.notTold}
        </Text>
      </View>
      <Text size={14} weight="medium" style={[styles.secondary, styles.untoldLine]}>
        {what}
      </Text>
      <View style={styles.untoldActions}>
        <TextAction label={W.tellThem} onPress={onTell} testID="messages.untold.tell" />
        <TextAction label={W.dismiss} plain onPress={onDismiss} testID="messages.untold.dismiss" />
      </View>
    </View>
  );
}

/** The list of conversations: Messages, then Needs you, Scheduled and Done; the open one lit in Tint, reaching 10 past the row. */
export function MessagesList({
  m,
  wide,
  locale,
  head,
  refFor,
  onOpen,
  onNew,
  onTell,
  onDismiss,
}: {
  m: Messages;
  wide: boolean;
  locale: string;
  head?: ReactNode;
  refFor: (key: string) => (node: ViewInstance | null) => void;
  onOpen: (id: RowId) => void;
  onNew: () => void;
  onTell: () => void;
  onDismiss: () => void;
}) {
  const sections = sectionsOf(m);
  const lit = (id: RowId) => wide && sameOpen(m, id);
  const item = (id: RowId): ListItem => {
    const shown = shownRow(m, id, locale);
    const selected = lit(id);
    const label = [shown.title, shown.line, shown.time, shown.tag?.word].filter(Boolean).join(', ');
    const row = (
      <Row
        ref={refFor(`row.${rowName(id)}`)}
        title={shown.title}
        titleLines={shown.titleLines}
        line={shown.line}
        lead={shown.lead}
        value={shown.time === '' ? undefined : shown.time}
        tag={shown.tag}
        selected={selected}
        gutter={10}
        onPress={() => onOpen(id)}
        accessibilityRole="link"
        accessibilityLabel={label}
        accessibilityState={{ selected }}
        testID={`messages.row.${rowName(id)}`}
      />
    );

    return {
      key: rowName(id),
      inset: 52,
      selected,
      row:
        id.kind === 'guest' && id.key === 'lucia' && m.arrived ? <Arriving>{row}</Arriving> : row,
    };
  };
  const title = (
    <View style={styles.titleRow}>
      <Text
        size={wide ? 26 : 30}
        weight="bold"
        accessibilityRole="header"
        style={[styles.grow, styles.title]}
      >
        {W.messages}
      </Text>
      {wide && m.phase !== 'loading' && (
        <Pill
          label={W.newButton}
          glyph="plus"
          height={tokens.sizeHit}
          full={false}
          onPress={onNew}
          testID="messages.new"
        />
      )}
      {head}
    </View>
  );

  if (m.phase === 'loading')
    return (
      <View style={styles.list}>
        {title}
        <Text size={14} weight="medium" accessible={false} style={styles.secondary}>
          {W.loading}
        </Text>
        <RowShapes words={W.loading} />
      </View>
    );
  if (m.phase === 'first' && ownThreads(m).length === 0)
    return (
      <View style={styles.list}>
        {title}
        <View style={styles.empty}>
          <Text size={17} weight="bold" style={styles.centred}>
            {W.noneYet}
          </Text>
          <Text
            size={14.5}
            weight="medium"
            style={[styles.secondary, styles.centred, styles.emptyLine]}
          >
            {W.noneLine}
          </Text>
        </View>
      </View>
    );

  return (
    <View style={styles.list}>
      {title}
      {m.untold && (
        <Untold what={m.change.what.join(' · ')} onTell={onTell} onDismiss={onDismiss} />
      )}
      {sections.top.length > 0 && (
        <View style={styles.bleed}>
          <RowList items={sections.top.map(item)} gutter={10} />
        </View>
      )}
      {m.phase === 'list' && (
        <>
          <View>
            <SectionTitle word={W.needsYou} count={sections.needs.length} />
            <View style={styles.bleed}>
              <RowList items={sections.needs.map(item)} gutter={10} />
            </View>
          </View>
          <View>
            <SectionTitle word={W.scheduled} count={sections.scheduled.length} />
            <View style={styles.bleed}>
              <RowList items={sections.scheduled.map(item)} gutter={10} />
            </View>
          </View>
          <View>
            <SectionTitle word={W.done} />
            <View style={styles.bleed}>
              <RowList items={sections.done.map(item)} gutter={10} />
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  figures: { fontVariant: ['tabular-nums'] },
  centred: { textAlign: 'center' },
  list: { gap: tokens.spaceLg },
  titleRow: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
  },
  title: { letterSpacing: -0.6 },
  bleed: { marginHorizontal: -10 },
  sectionHead: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: tokens.spaceXxs,
  },
  groupMark: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.scrimSheet,
  },
  wash: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: tokens.radiusRow,
    backgroundColor: tokens.colorAccentTint,
  },
  empty: { gap: tokens.spaceXs, paddingTop: tokens.space5xl },
  emptyLine: { lineHeight: 14.5 * 1.45 },
  untold: {
    gap: tokens.spaceHair,
    paddingTop: tokens.spaceLg,
    paddingHorizontal: 14,
    paddingBottom: tokens.spaceHair,
    borderRadius: 18,
    backgroundColor: tokens.colorAttentionTint,
  },
  untoldHead: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  untoldLine: { paddingLeft: tokens.space3xl },
  untoldActions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 22 },
});
