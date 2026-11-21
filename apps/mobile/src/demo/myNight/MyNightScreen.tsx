import { useLocalSearchParams } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand } from '../../components/Brand.tsx';
import { SecondaryButton } from '../../components/Buttons.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { Notice } from '../../components/Notice.tsx';
import { useReadOut } from '../../components/ReadOut.tsx';
import { Text } from '../../components/Text.tsx';
import { useLayout } from '../../layout/useLayout.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { goBack } from '../DemoScreen.tsx';
import {
  type Lead,
  type Moment,
  type Night,
  type Table,
  MN,
  fresh,
  guestCount,
  headingOf,
  moved,
  myNightStateOf,
  nightOf,
  signedOutAt,
} from './myNightModel.ts';
import { ClockCard } from '../shiftClock/ShiftClockScreen.tsx';
import { useClockCard } from '../shiftClock/useClockCard.ts';

/** sc-234's clock card, live, above Your shift: its own states are at /demo/shift-clock. */
function Clock({ night }: { night: Night }) {
  const { c, busy, said, press } = useClockCard(night.clock);

  return <ClockCard c={c} busy={busy} said={said} browser={!night.inApp} onPress={press} />;
}

export function MyNightRoute() {
  const { state } = useLocalSearchParams<{ state?: string }>();
  const first = myNightStateOf(state);

  return <MyNightScreen key={first} first={nightOf(first)} />;
}

/** A staff member's whole night on one page (sc-3915): one column on a phone, two on a tablet. */
export function MyNightScreen({ first }: { first: Night }) {
  const insets = useSafeAreaInsets();
  const { kind } = useLayout();
  const wide = kind !== 'phone';
  const [night, setNight] = useState(first);
  const [told, setTold] = useState<string | null>(null);

  useReadOut(night.updated == null ? null : MN.updated(night.updated), { quietAtMount: true });
  useReadOut(told);

  const you = (
    <You night={night} onSignOut={() => setTold(MN.signOutLater)} inBar={wide} told={told} />
  );

  const left = (
    <>
      <View style={styles.on}>
        <Text
          size={17}
          weight="semibold"
          style={styles.onLabel}
          accessibilityRole="header"
          accessibilityLabel={`${MN.onTonight} ${headingOf(night)}`}
        >
          {MN.onTonight}
        </Text>
        <Text size={28} weight="bold" style={styles.onInk} importantForAccessibility="no">
          {headingOf(night)}
        </Text>
      </View>
      <Clock night={night} />
      <Card title={MN.yourShift}>
        <Text size={20} weight="bold">
          {night.job}
        </Text>
        <Text size={17}>{MN.times(night.starts, night.ends)}</Text>
        {night.endsOn != null && (
          <Text size={17} style={styles.secondary}>
            {MN.endsOn(night.endsOn, night.ends)}
          </Text>
        )}
        {night.later != null && (
          <View style={styles.inset}>
            <Text size={17}>{MN.later(night.later.job, night.later.from)}</Text>
          </View>
        )}
      </Card>
      <Card title={MN.yourLead}>
        <YourLead lead={night.lead} />
      </Card>
      {night.rules != null && (
        <Card title={MN.beforeYouStart}>
          <Text size={17} style={styles.rules}>
            {night.rules}
          </Text>
        </Card>
      )}
    </>
  );

  const right = (
    <>
      {night.timing != null && (
        <Card title={MN.timing}>
          {night.timing.map((moment) => (
            <MomentRow key={`${moment.at}${moment.what}`} moment={moment} />
          ))}
        </Card>
      )}
      {night.tables != null && (
        <Card title={MN.yourTables}>
          {night.doorsOpen ? (
            night.tables.map((table) => <TableBox key={table.name} table={table} />)
          ) : (
            <View style={[styles.inset, styles.row]}>
              <Glyph name="clock" size={18} ink={tokens.colorInkSecondary} />
              <Text size={17} style={styles.shrink}>
                {MN.opensAt(night.doorsAt)}
              </Text>
            </View>
          )}
        </Card>
      )}
    </>
  );

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <View style={[styles.bar, wide && styles.barWide]}>
        {night.inApp && (
          <Pressable
            onPress={goBack}
            accessibilityRole="button"
            style={styles.back}
            testID="myNight.back"
          >
            <Glyph name="back" size={20} ink={tokens.colorAccentText} weight={2.4} />
            <Text size={17} weight="semibold" style={styles.accent}>
              {MN.events}
            </Text>
          </Pressable>
        )}
        <View style={styles.brand}>
          <Brand height={22} />
        </View>
        {wide && you}
      </View>
      <View>
        {night.updated != null && (
          <View style={[styles.band, styles.bandDone]} testID="myNight.updated">
            <Notice tone="done" mark="✓" title={MN.updated(night.updated)} />
          </View>
        )}
      </View>
      {night.staleAt != null && (
        <View style={[styles.band, styles.bandStale]} testID="myNight.stale">
          <Notice
            tone="attention"
            mark="!"
            title={MN.staleTitle}
            body={MN.staleBody(night.staleAt)}
            button={
              <SecondaryButton
                label={MN.tryAgain}
                onPress={() => setNight(fresh(night))}
                testID="myNight.tryAgain"
              />
            }
          />
        </View>
      )}
      <ScrollView
        contentContainerStyle={[
          styles.body,
          wide ? styles.bodyWide : styles.bodyPhone,
          { paddingBottom: insets.bottom + 48 },
        ]}
      >
        <View style={wide ? styles.wide : styles.column}>
          {night.loading ? (
            <View style={styles.card} accessibilityRole="progressbar" testID="myNight.loading">
              <Text size={17}>{MN.loading}</Text>
              <View style={styles.bone} />
              <View style={[styles.bone, styles.boneShort]} />
            </View>
          ) : (
            <>
              <View style={styles.head}>
                <Text size={17} style={styles.secondary}>
                  {MN.only(night.linkEnds)}
                </Text>
                <Text size={17} weight="bold">
                  {night.event}
                </Text>
              </View>
              {wide ? (
                <View style={styles.sides}>
                  <View style={styles.side}>{left}</View>
                  <View style={styles.side}>{right}</View>
                </View>
              ) : (
                <>
                  {left}
                  {right}
                </>
              )}
            </>
          )}
          {!wide && you}
          <DemoOnly title="Demo only">
            {night.state === 'night' && night.updated == null && (
              <SecondaryButton
                label={MN.demoMoveButton}
                onPress={() => setNight(moved(night))}
                testID="myNight.demo.move"
              />
            )}
            <SecondaryButton label={MN.backToDemo} onPress={goBack} testID="myNight.demo.back" />
          </DemoOnly>
        </View>
      </ScrollView>
    </View>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      <Text size={17} weight="semibold" style={styles.info} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

function YourLead({ lead }: { lead: Lead | null }) {
  if (lead == null) {
    return (
      <Text size={17} style={styles.secondary}>
        {MN.noLead}
      </Text>
    );
  }

  return (
    <View style={styles.lead}>
      <View style={styles.leadWho}>
        <Text size={20} weight="bold">
          {lead.name}
        </Text>
        {lead.floor && (
          <View style={styles.row}>
            <Flag />
            <Text size={17} weight="semibold" style={styles.info}>
              {MN.floorLead}
            </Text>
          </View>
        )}
      </View>
      {lead.phone != null && (
        <Pressable
          onPress={() => void Linking.openURL(`tel:${lead.phone}`)}
          accessibilityRole="link"
          accessibilityLabel={MN.callLabel(lead)}
          style={({ pressed }) => [styles.call, pressed && styles.callPressed]}
          testID="myNight.call"
        >
          <Glyph name="phone" size={18} ink={tokens.colorInkOnDark} />
          <Text size={17} weight="semibold" style={styles.onPrimary}>
            {MN.call}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function Flag() {
  return (
    <Svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke={tokens.colorInkSecondary}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Path d="M5 22V3" />
      <Path d="M5 4h13l-3 4.5L18 13H5" />
    </Svg>
  );
}

function MomentRow({ moment }: { moment: Moment }) {
  const staff = moment.for === 'staff';

  return (
    <View style={styles.moment}>
      <Text size={17} weight="bold" style={styles.at}>
        {moment.at}
      </Text>
      <View style={styles.shrink}>
        <Text size={17}>{moment.what}</Text>
        <View style={styles.row}>
          <View style={staff ? styles.square : styles.circle} />
          <Text size={17} weight="semibold" style={styles.info}>
            {staff ? MN.staff : MN.guests}
          </Text>
        </View>
      </View>
    </View>
  );
}

function TableBox({ table }: { table: Table }) {
  return (
    <View style={styles.inset}>
      <View style={styles.tableHead} accessibilityRole="header">
        <Text size={17} weight="bold">
          {table.name}
        </Text>
        <Text size={17} style={styles.info}>
          {guestCount(table)}
        </Text>
      </View>
      {table.guests.map((guest) => (
        <View key={guest.name} style={styles.guest}>
          <Text size={17}>{guest.name}</Text>
          {guest.diet != null && (
            <View style={styles.row}>
              <View style={styles.diamond} />
              <Text size={17} weight="semibold" style={styles.attention}>
                {guest.diet}
              </Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

/** Under the page on a phone, in the bar on a tablet; the app keeps only Sign out. */
function You({
  night,
  onSignOut,
  inBar,
  told,
}: {
  night: Night;
  onSignOut: () => void;
  inBar: boolean;
  told: string | null;
}) {
  return (
    <View style={inBar ? styles.youBar : styles.youFoot} testID="myNight.you">
      <View style={inBar ? styles.youWordsBar : styles.youWords}>
        <Text size={17} weight="bold">
          {MN.signedInAs(night.name)}
        </Text>
        {!night.inApp && (
          <Text size={17} style={styles.secondary} testID="myNight.alone">
            {MN.yoursAlone(signedOutAt(night))}
          </Text>
        )}
        {told != null && (
          <Text size={17} style={styles.secondary}>
            {told}
          </Text>
        )}
      </View>
      <SecondaryButton label={MN.signOut} onPress={onSignOut} testID="myNight.signOut" />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colorPage },
  bar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spaceLg,
    minHeight: 56,
    paddingHorizontal: tokens.spaceLg,
    paddingVertical: tokens.spaceSm,
    backgroundColor: tokens.colorHeader,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colorHeaderBorder,
  },
  barWide: { paddingHorizontal: tokens.spaceXl },
  brand: { flexGrow: 1 },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXxs,
    minHeight: tokens.sizeHit,
  },
  band: { paddingHorizontal: tokens.spaceLg, paddingVertical: tokens.spaceSm },
  bandDone: { backgroundColor: tokens.colorAccentTint },
  bandStale: { backgroundColor: tokens.colorAttentionTint },
  body: { gap: tokens.spaceLg },
  bodyPhone: { padding: tokens.spaceLg },
  bodyWide: { padding: tokens.spaceXl, alignItems: 'center' },
  column: { width: '100%', maxWidth: 560, gap: tokens.spaceLg },
  wide: { width: '100%', maxWidth: 1120, gap: tokens.spaceLg },
  sides: { flexDirection: 'row', gap: tokens.spaceXl, alignItems: 'flex-start' },
  side: { flex: 1, minWidth: 0, gap: tokens.spaceLg },
  head: { gap: tokens.spaceXxs },
  on: {
    gap: tokens.spaceXs,
    padding: tokens.spaceXxl,
    borderRadius: tokens.radiusCardLarge,
    backgroundColor: tokens.colorDark,
  },
  onLabel: { color: tokens.colorInkOnDarkSecondary },
  onInk: { color: tokens.colorInkOnDark },
  card: {
    gap: tokens.spaceSm,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusCardPhone,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
  },
  inset: {
    gap: tokens.spaceXs,
    padding: tokens.spaceMd,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorInset,
    borderWidth: 1,
    borderColor: tokens.colorInsetBorder,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXs },
  shrink: { flexShrink: 1 },
  secondary: { color: tokens.colorInkSecondary },
  info: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
  attention: { color: tokens.colorAttentionText },
  onPrimary: { color: tokens.colorInkOnDark },
  rules: { lineHeight: 26 },
  lead: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spaceMd,
  },
  leadWho: { flexGrow: 1, flexShrink: 1, flexBasis: 160, gap: tokens.spaceXxs },
  call: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spaceSm,
    minHeight: tokens.sizeHitPhonePrimary,
    paddingHorizontal: tokens.spaceXxl,
    borderRadius: tokens.radiusPill,
    backgroundColor: tokens.colorAccentHover,
  },
  callPressed: { backgroundColor: tokens.colorPrimaryHover },
  moment: {
    flexDirection: 'row',
    gap: tokens.spaceMd,
    paddingVertical: tokens.spaceSm,
    borderTopWidth: 1,
    borderTopColor: tokens.colorInsetBorder,
  },
  at: { width: 60 },
  square: { width: 10, height: 10, backgroundColor: tokens.colorInkSecondary },
  circle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: tokens.colorInkSecondary,
  },
  diamond: {
    width: 10,
    height: 10,
    borderWidth: 2,
    borderColor: tokens.colorAttention,
    transform: [{ rotate: '45deg' }],
  },
  tableHead: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: tokens.spaceSm,
  },
  guest: {
    gap: tokens.spaceHair,
    paddingVertical: tokens.spaceXs,
    borderTopWidth: 1,
    borderTopColor: tokens.colorBorder,
  },
  bone: {
    width: '70%',
    height: 18,
    borderRadius: tokens.radiusPill,
    backgroundColor: tokens.colorInsetBorder,
  },
  boneShort: { width: '45%' },
  youFoot: {
    alignItems: 'flex-start',
    gap: tokens.spaceSm,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusCardPhone,
    backgroundColor: tokens.colorInset,
    borderWidth: 1,
    borderColor: tokens.colorInsetBorder,
  },
  youWords: { gap: tokens.spaceXxs },
  youBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: tokens.spaceMd,
    flexShrink: 1,
    maxWidth: 680,
  },
  youWordsBar: { flexShrink: 1, flexBasis: 360, gap: tokens.spaceHair },
});
