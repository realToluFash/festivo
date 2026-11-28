import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ReadOutAlertLine } from '../../components/AlertLine.tsx';
import { QuietButton } from '../../components/Buttons.tsx';
import { DoneLine, SheetLayer } from '../../components/FormLayers.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { Pill } from '../../components/SettingsParts.tsx';
import { TextAction } from '../../components/SummaryRows.tsx';
import { Text } from '../../components/Text.tsx';
import { Title } from '../../components/Title.tsx';
import { useLayout } from '../../layout/useLayout.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { goBack } from '../DemoScreen.tsx';
import {
  type Ask,
  LW,
  type LimitState,
  type Owners,
  type Refusal,
  SAMPLE,
  type Way,
  answerOf,
  endOf,
  mayAsk,
  planWayOf,
  refusalOf,
  refusedOn,
} from './limitRules.ts';

const SENDING_MS = 900;

/** sc-3930 in the app: a bottom sheet on a phone, a centred dialog on a tablet either way round, over the screen it was met on. */
export function LimitReachedScreen({ limit, role, ask }: LimitState) {
  const insets = useSafeAreaInsets();
  const { kind } = useLayout();
  const [open, setOpen] = useState(true);
  const [told, setTold] = useState<string | null>(null);
  const refusal = refusalOf(limit);

  return (
    <View style={[styles.page, { paddingTop: insets.top + tokens.spaceXl }]}>
      <View style={[styles.shell, kind !== 'phone' && styles.wide]}>
        <Title size={kind === 'phone' ? 28 : 34} accessibilityRole="header">
          {refusedOn(limit)}
        </Title>
        <Text size={tokens.typeBodyPhone.size} muted>
          The screen the refusal was met on, as a shell. Nothing on it changed.
        </Text>
        <DemoOnly
          title={
            told ??
            `Role: ${role === 'manage' ? 'billing.manage' : 'anyone else'}. In the app no refusal says where plans are changed.`
          }
        >
          {!open && (
            <QuietButton
              label="Show the refusal again"
              onPress={() => {
                setTold(null);
                setOpen(true);
              }}
              testID="demo.limit.again"
            />
          )}
          <QuietButton label="Back to the demo" onPress={goBack} testID="demo.limit.back" />
        </DemoOnly>
      </View>
      {open && (
        <SheetLayer
          label={refusal.back}
          alert
          onClose={() => {
            setOpen(false);
            setTold(`${refusal.back}: the work is as it was.`);
          }}
        >
          <LimitRefusal
            refusal={refusal}
            role={role}
            start={ask}
            tell={setTold}
            onBack={() => {
              setOpen(false);
              setTold(`${refusal.back}: the work is as it was.`);
            }}
          />
        </SheetLayer>
      )}
    </View>
  );
}

function LimitRefusal({
  refusal,
  role,
  start,
  tell,
  onBack,
}: {
  refusal: Refusal;
  role: LimitState['role'];
  start: Ask;
  tell: (words: string) => void;
  onBack: () => void;
}) {
  const planWay = planWayOf(refusal, role);
  const [offline, setOffline] = useState(false);
  const [owners, setOwners] = useState<Owners>(start.now === 'sent' ? start.owners : 'several');

  return (
    <View style={styles.sheet}>
      <View style={styles.titleRow}>
        <View style={styles.hard}>
          <Glyph name="x" size={14} ink={tokens.colorInk} weight={2.6} />
        </View>
        <Text size={20} weight="bold" accessibilityRole="header" style={styles.grow}>
          {refusal.title}
        </Text>
      </View>
      {refusal.line != null && <Text size={15.5}>{refusal.line}</Text>}
      {refusal.figure != null && (
        <Text size={14} style={[styles.secondary, styles.figures]}>
          {refusal.figure}
        </Text>
      )}
      <View style={styles.safe}>
        <Glyph name="shield" size={16} ink={tokens.colorAccentText} weight={2.2} />
        <Text size={14.5} weight="semibold" style={[styles.grow, styles.safeInk]}>
          {refusal.safe}
        </Text>
      </View>
      {refusal.ways.map((way) => (
        <WayPast key={way} way={way} tell={tell} />
      ))}
      {planWay === 'inApp' && (
        <Text size={15} weight="medium">
          {LW.inApp}
        </Text>
      )}
      {planWay === 'ask' && <AskOwner start={start} offline={offline} owners={owners} />}
      <Pill
        label={refusal.back}
        kind="secondary"
        height={tokens.sizeHitPhonePrimary}
        onPress={onBack}
        testID="demo.limit.wayBack"
      />
      {planWay === 'ask' && (
        <DemoOnly title="Stand-in for the server, in the demo only.">
          <QuietButton
            label={offline ? 'Offline: on' : 'Offline: off'}
            onPress={() => setOffline(!offline)}
            testID="demo.limit.offline"
          />
          <QuietButton
            label={owners === 'one' ? 'Owners: one' : 'Owners: several'}
            onPress={() => setOwners(owners === 'one' ? 'several' : 'one')}
            testID="demo.limit.owners"
          />
        </DemoOnly>
      )}
    </View>
  );
}

function WayPast({ way, tell }: { way: Way; tell: (words: string) => void }) {
  if (way === 'goLive') {
    const { date, time } = endOf(SAMPLE.firstToEnd.endsAt, SAMPLE.firstToEnd.timeZone);
    return (
      <View style={styles.inset}>
        <Glyph name="clock" size={16} ink={tokens.colorInk} weight={2.2} />
        <Text size={15} style={styles.grow}>
          {LW.goLive(SAMPLE.firstToEnd.name, date, time)}
        </Text>
      </View>
    );
  }

  if (way === 'removeGuest')
    return (
      <View style={styles.row}>
        <Text size={15} weight="semibold">
          {LW.removeGuest}
        </Text>
        <Text size={14} style={styles.secondary}>
          {LW.removeGuestLine}
        </Text>
        <TextAction
          label={LW.toGuestList}
          onPress={() => tell('The guest list opens, with the form kept.')}
          testID="demo.limit.guestList"
        />
      </View>
    );

  const withdraw = way === 'withdraw';
  return (
    <Pressable
      style={[styles.row, styles.rowLink]}
      accessibilityRole="link"
      onPress={() => tell('Members opens, with the invitation kept.')}
      testID={`demo.limit.${way}`}
    >
      <View style={styles.grow}>
        <Text size={15} weight="semibold">
          {withdraw ? LW.withdraw : LW.removeMember}
        </Text>
        <Text size={14} style={styles.secondary}>
          {withdraw ? LW.withdrawLine : LW.removeMemberLine}
        </Text>
      </View>
      <Glyph name="chevron" size={16} ink={tokens.colorInkSecondary} weight={2.2} />
    </Pressable>
  );
}

/** Ask an owner in its four states: sending keeps the label and sends nothing more, sent replaces the button, Not sent keeps it. */
function AskOwner({ start, offline, owners }: { start: Ask; offline: boolean; owners: Owners }) {
  const [ask, setAsk] = useState<Ask>(start);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function press(): void {
    if (!mayAsk(ask)) return;
    setAsk({ now: 'sending' });
    timer.current = setTimeout(() => setAsk(answerOf(offline, owners)), SENDING_MS);
  }

  if (ask.now === 'sent') return <DoneLine text={LW.sent[ask.owners]} size={14.5} />;

  return (
    <View style={styles.ask}>
      <Pill
        label={LW.askOwner}
        kind="secondary"
        height={tokens.sizeHitPhonePrimary}
        busy={ask.now === 'sending'}
        onPress={press}
        testID="demo.limit.ask"
      />
      {ask.now === 'notSent' && (
        <ReadOutAlertLine text={LW.notSent} small testID="demo.limit.notSent" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colorCard },
  shell: { gap: tokens.spaceLg, paddingHorizontal: tokens.spaceXxl },
  wide: { paddingHorizontal: tokens.space5xl },
  sheet: { gap: 14, paddingHorizontal: tokens.spaceXxl, paddingTop: 22, paddingBottom: 34 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  hard: {
    width: 24,
    height: 24,
    marginTop: 2,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorInset,
  },
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  figures: { fontVariant: ['tabular-nums'] },
  safe: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: tokens.colorAccentTint,
  },
  safeInk: { color: tokens.colorAccentText },
  inset: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.colorInsetBorder,
    backgroundColor: tokens.colorInset,
  },
  row: {
    gap: 2,
    minHeight: tokens.sizeHit,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
  },
  rowLink: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ask: { gap: 6 },
});
