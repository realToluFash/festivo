import { router, useLocalSearchParams, type Href } from 'expo-router';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DestructiveButton, QuietButton, SecondaryButton } from '../../components/Buttons.tsx';
import { OnOffSwitch } from '../../components/OnOffSwitch.tsx';
import { useReadOut } from '../../components/ReadOut.tsx';
import { Sheet } from '../../components/Sheet.tsx';
import { Text } from '../../components/Text.tsx';
import { moveScreenReaderFocus } from '../../components/screenReaderFocus.ts';
import { useLayout } from '../../layout/useLayout.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { goBack } from '../DemoScreen.tsx';
import { Glyph } from '../queue/QueueParts.tsx';
import {
  AUTO_KEYS,
  AW,
  type AutoKey,
  type AutoState,
  type AutoStateName,
  EVENT,
  SAID_WORDS,
  autoStateOf,
  confirmOff,
  confirmWords,
  draftLine,
  keepOn,
  press,
  publish,
  rowOf,
  seed,
} from './AutomaticModel.ts';
import { SAMPLE_EVENT_ID } from './MessagesSample.ts';

const CLOCK = ['M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20z', 'M12 7v5l3 2'];
const CHEVRON = ['m9 6 6 6-6 6'];
const ALL_MESSAGES = `/demo/events/${SAMPLE_EVENT_ID}/messages` as Href;
const REPLY_BY = '/demo/events/evt-draft-4?state=replyByEmpty' as Href;

export function AutomaticRoute() {
  const params = useLocalSearchParams<{ state?: string }>();
  const state = autoStateOf(params.state);

  return <Automatic key={state} start={state} />;
}

type Apply = (next: AutoState, focus?: AutoKey | null) => void;

function Automatic({ start }: { start: AutoStateName }) {
  const insets = useSafeAreaInsets();
  const wide = useLayout().kind === 'tabletLandscape';
  const [s, setS] = useState<AutoState>(() => seed(start));
  const [said, setSaid] = useState(0);
  const switches = {
    reminders: useRef<ViewInstance | null>(null),
    before: useRef<ViewInstance | null>(null),
  };
  const focusTo = useRef<AutoKey | null>(null);

  useReadOut(said === 0 || s.said === '' ? null : s.said, { answer: said });

  useEffect(() => {
    const to = focusTo.current;
    if (to == null) return;
    focusTo.current = null;
    moveScreenReaderFocus(switches[to].current);
  });

  const apply: Apply = (next, focus = null) => {
    focusTo.current = focus;
    setS(next);
    setSaid((n) => n + 1);
  };

  const draft = draftLine(s);
  const all = <AllMessages wide={wide} />;
  const card = <Card s={s} apply={apply} switches={switches} />;
  const demo = (
    <DemoOnly title="Demo only">
      <Text size={14} style={styles.secondary}>
        {`Read out as a switch settles: “${SAID_WORDS.isOn}” and “${SAID_WORDS.isOff}” ${SAID_WORDS.proposed}.`}
      </Text>
      {draft != null && (
        <SecondaryButton
          label="Publish the event"
          onPress={() => apply(publish(s), 'reminders')}
          testID="auto.publish"
        />
      )}
    </DemoOnly>
  );

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={[styles.body, wide && styles.bodyWide]}>
        <Pressable
          onPress={goBack}
          accessibilityRole="button"
          style={styles.back}
          testID="auto.back"
        >
          <Text size={15} weight="semibold" style={styles.accent}>
            Back
          </Text>
        </Pressable>
        <View style={styles.header}>
          <Text size={30} weight="bold" accessibilityRole="header">
            {AW.title}
          </Text>
          <View style={styles.eventLine}>
            <Text size={15} weight="medium" style={styles.secondary}>
              {EVENT}
            </Text>
            <Phase draft={draft != null} />
          </View>
        </View>
        {wide ? (
          <View style={styles.columns}>
            <View style={styles.left}>
              {all}
              {demo}
            </View>
            <View style={styles.pane}>{card}</View>
          </View>
        ) : (
          <>
            {all}
            {card}
            {demo}
          </>
        )}
      </ScrollView>
      <TurnOff s={s} apply={apply} wide={wide} switches={switches} />
    </View>
  );
}

function Phase({ draft }: { draft: boolean }) {
  return (
    <View style={[styles.phase, draft && styles.phaseDraft]}>
      <View style={[styles.phaseMark, draft && styles.ring]} />
      <Text size={13} weight="semibold" style={draft ? undefined : styles.accentText}>
        {draft ? 'Draft' : 'Live'}
      </Text>
    </View>
  );
}

/** On the phone a single row that opens the list; on a tablet the card it heads. */
function AllMessages({ wide }: { wide: boolean }) {
  const open = () => router.push(ALL_MESSAGES);

  return (
    <Pressable
      onPress={open}
      accessibilityRole="link"
      accessibilityLabel={`${AW.allMessages}. ${AW.allMessagesLine}`}
      style={[styles.card, styles.allRow, wide && styles.allWide]}
      testID="auto.all"
    >
      <View style={styles.grow}>
        <Text size={18} weight="bold">
          {AW.allMessages}
        </Text>
        <Text size={14} style={styles.secondary}>
          {AW.allMessagesLine}
        </Text>
      </View>
      <Glyph paths={CHEVRON} ink={tokens.colorInkSecondary} side={18} />
    </Pressable>
  );
}

type Switches = Record<AutoKey, RefObject<ViewInstance | null>>;

function Card({ s, apply, switches }: { s: AutoState; apply: Apply; switches: Switches }) {
  const draft = draftLine(s);

  if (s.loading)
    return (
      <View style={styles.card} accessibilityState={{ busy: true }} testID="auto.loading">
        <Text size={20} weight="bold" accessibilityRole="header">
          {AW.heading}
        </Text>
        <Text size={14} style={styles.secondary}>
          {AW.loading}
        </Text>
        {AUTO_KEYS.map((key) => (
          <View
            key={key}
            style={styles.row}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <View style={[styles.bone, styles.boneTitle]} />
            <View style={[styles.bone, styles.boneLine]} />
            <View style={[styles.bone, styles.boneInset]} />
          </View>
        ))}
      </View>
    );

  return (
    <View style={styles.card} testID="auto.card">
      <Text size={20} weight="bold" accessibilityRole="header">
        {AW.heading}
      </Text>
      {draft != null && (
        <View style={styles.inset}>
          <View style={styles.ring} />
          <Text size={14} weight="semibold" style={styles.grow}>
            {draft}
          </Text>
        </View>
      )}
      {AUTO_KEYS.map((key) => (
        <Row key={key} s={s} k={key} apply={apply} switches={switches} />
      ))}
      <Text size={14} style={styles.secondary}>
        {AW.footer}
      </Text>
    </View>
  );
}

function Row({
  s,
  k,
  apply,
  switches,
}: {
  s: AutoState;
  k: AutoKey;
  apply: Apply;
  switches: Switches;
}) {
  const row = rowOf(s, k);

  return (
    <View style={styles.row} testID={`auto.row.${k}`}>
      <View style={styles.rowTop}>
        <Text size={17} weight="semibold" style={styles.grow} accessibilityRole="header">
          {row.name}
        </Text>
        <View ref={switches[k]}>
          <OnOffSwitch
            on={row.shownOn}
            words={{ on: AW.on, off: AW.off }}
            label={row.name}
            hint={row.when}
            disabled={!row.live}
            onChange={() => {
              const next = press(s, k);
              apply(next, next.confirm == null ? k : null);
            }}
            testID={`auto.switch.${k}`}
          />
        </View>
      </View>
      <Text size={14} style={styles.secondary}>
        {row.when}
      </Text>
      {row.limit != null && (
        <Text size={14} style={styles.secondary}>
          {row.limit}
        </Text>
      )}
      <Text size={14} style={styles.secondary}>
        {row.time}
      </Text>
      {row.next != null && (
        <View style={styles.inset} testID={`auto.next.${k}`}>
          <Glyph paths={CLOCK} ink={tokens.colorInk} side={16} />
          <Text size={14} weight="semibold" style={[styles.grow, styles.figures]}>
            {row.next}
          </Text>
        </View>
      )}
      {row.unavailable != null && (
        <View style={styles.inset}>
          <View style={styles.ring} />
          <Pressable
            onPress={() => router.push(REPLY_BY)}
            accessibilityRole="link"
            hitSlop={tokens.spaceSm}
            style={styles.grow}
            testID="auto.replyBy"
          >
            <Text size={14} weight="semibold" style={styles.accentText}>
              {row.unavailable}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function TurnOff({
  s,
  apply,
  wide,
  switches,
}: {
  s: AutoState;
  apply: Apply;
  wide: boolean;
  switches: Switches;
}) {
  const words = confirmWords(s);
  const key = s.confirm ?? 'reminders';
  const keep = () => apply(keepOn(s), key);

  return (
    <Sheet
      open={s.confirm != null}
      onClose={keep}
      opener={switches[key]}
      docked={wide}
      testID="auto.confirm"
    >
      {words != null && (
        <View style={styles.sheet}>
          <Text size={22} weight="bold" accessibilityRole="header">
            {words.title}
          </Text>
          <Text size={15} style={styles.secondary}>
            {words.body}
          </Text>
          <View style={styles.sheetActions}>
            <DestructiveButton
              label={AW.turnOff}
              stacked
              onPress={() => apply(confirmOff(s), key)}
              testID="auto.confirm.off"
            />
            <QuietButton label={AW.keepOn} onPress={keep} testID="auto.confirm.keep" />
          </View>
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colorPage },
  body: { gap: tokens.spaceLg, padding: tokens.spaceLg, paddingBottom: tokens.space3xl },
  bodyWide: { paddingHorizontal: tokens.space3xl },
  back: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  header: { gap: tokens.spaceXs },
  eventLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceSm },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceXl },
  left: { flex: 1, gap: tokens.spaceLg },
  pane: { width: 460 },
  card: {
    gap: tokens.spaceMd,
    padding: tokens.spaceLg,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    borderRadius: tokens.radiusCardPhone,
    backgroundColor: tokens.colorCard,
  },
  allRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  allWide: { paddingVertical: tokens.spaceXl },
  row: {
    gap: tokens.spaceSm,
    paddingTop: tokens.spaceLg,
    borderTopWidth: 1,
    borderTopColor: tokens.colorBorder,
  },
  rowTop: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceMd },
  inset: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    minHeight: 44,
    paddingHorizontal: tokens.spaceMd,
    paddingVertical: tokens.spaceSm,
    borderWidth: 1,
    borderColor: tokens.colorInsetBorder,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorInset,
  },
  ring: {
    width: 12,
    height: 12,
    borderWidth: 2,
    borderColor: tokens.colorInkSecondary,
    borderRadius: tokens.radiusPill,
    backgroundColor: 'transparent',
  },
  phase: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    paddingHorizontal: tokens.spaceSm,
    paddingVertical: tokens.spaceXxs,
    borderRadius: tokens.radiusPill,
    backgroundColor: tokens.colorAccentTint,
  },
  phaseDraft: { backgroundColor: tokens.colorNeutralFill },
  phaseMark: {
    width: 8,
    height: 8,
    borderRadius: tokens.radiusPill,
    backgroundColor: tokens.colorAccent,
  },
  bone: { borderRadius: tokens.radiusSmall, backgroundColor: tokens.colorNeutralFill },
  boneTitle: { width: '40%', height: 20 },
  boneLine: { width: '80%', height: 14 },
  boneInset: { width: '100%', height: 44 },
  sheet: { gap: tokens.spaceMd, padding: tokens.spaceXl },
  sheetActions: { gap: tokens.spaceSm, marginTop: tokens.spaceSm },
  grow: { flex: 1 },
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccent },
  accentText: { color: tokens.colorAccentText },
  figures: { fontVariant: ['tabular-nums'] },
});
