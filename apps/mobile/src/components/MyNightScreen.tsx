import {
  ApiError,
  type ClockAction,
  type ClockOutcome,
  type ClockPhase,
  type MyNight,
  type MyNightTable,
  type ShiftClockCard as ClockCard,
} from '@soirely/api-client';
import { formatEventClock } from '@soirely/domain';
import { router, useFocusEffect } from 'expo-router';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { api } from '../api.ts';
import { dateLocale } from '../i18n/index.ts';
import {
  type NightButton,
  checkInHrefOf,
  clockAt,
  crossesMidnight,
  dietaryOf,
  headingOf,
  nightButtonsOf,
  updatedAfter,
  weekdayOf,
} from '../kit/myNight.ts';
import { type ClockLine, actionOf, answerOf, recordedWords } from '../kit/shiftClock.ts';
import { openStationOf } from '../kit/stationWayIn.ts';
import { useLayout } from '../layout/useLayout.ts';
import { signOutHere, useSignedIn } from '../signedIn.ts';
import { tokens } from '../theme/tokens.ts';
import { Brand } from './Brand.tsx';
import { PrimaryButton, SecondaryButton } from './Buttons.tsx';
import { Glyph } from './Glyph.tsx';
import { Notice } from './Notice.tsx';
import { readOut, useReadOut } from './ReadOut.tsx';
import { ShiftClockCard } from './ShiftClockCard.tsx';
import { Text } from './Text.tsx';

/** Changes to their station, shift or lead show within 10 seconds (sc-3915). */
const EVERY_MS = 10_000;

type Seen =
  | { kind: 'loading' }
  | { kind: 'gone' }
  | {
      kind: 'shown';
      night: MyNight;
      updated: string | null;
      readAt: string;
      /** When it was read, the page's now until the next read. */
      at: number;
      stale: boolean;
    };

/** The person's night in the app (sc-3915), read again every 10 seconds; gone once the API no longer answers them. */
export function useMyNight(eventId: string, every: number | null = EVERY_MS) {
  const [seen, setSeen] = useState<Seen>({ kind: 'loading' });
  const [round, setRound] = useState(0);

  useEffect(() => {
    let current = true;
    const read = () =>
      api.myNight(eventId).then(
        (night) => current && setSeen((was) => shown(was, night)),
        (error: unknown) => {
          if (!current) return;
          if (error instanceof ApiError && error.status === 404) setSeen({ kind: 'gone' });
          else setSeen((was) => (was.kind === 'shown' ? { ...was, stale: true } : was));
        },
      );
    void read();
    const timer = every == null ? null : setInterval(() => void read(), every);

    return () => {
      current = false;
      if (timer != null) clearInterval(timer);
    };
  }, [eventId, every, round]);

  return { seen, again: () => setRound((n) => n + 1) };
}

/** The night as it now reads, announcing a move to another station; the lead and the tables move with it. */
function shown(was: Seen, night: MyNight): Seen {
  return {
    kind: 'shown',
    night,
    updated:
      was.kind === 'shown'
        ? updatedAfter(was.night, was.updated, night)
        : updatedAfter(null, null, night),
    readAt: formatEventClock(new Date().toISOString(), night.event.timeZone, dateLocale()),
    at: Date.now(),
    stale: false,
  };
}

/** A staff member's whole night on one page, opened from the event's Overview (sc-3915), as the app's demo /demo/my-night?state=app draws it: one column on a phone, two on a tablet. Open Floor (sc-98893) and Open {station} (sc-95382) never show together: a station is a section or a kitchen station. */
export function MyNightScreen({ eventId, onBack }: { eventId: string; onBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { kind } = useLayout();
  const wide = kind !== 'phone';
  const { account } = useSignedIn();
  const { seen, again } = useMyNight(eventId);

  useFocusEffect(
    useCallback(() => {
      if (seen.kind === 'gone') onBack();
    }, [seen.kind, onBack]),
  );

  useReadOut(
    seen.kind === 'shown' && seen.updated != null
      ? t('myNight.updated', { station: seen.updated })
      : null,
    { quietAtMount: true },
  );

  const you = <You name={account?.name ?? ''} inBar={wide} />;
  const pastAccess = seen.kind === 'shown' && seen.night.pastAccess;

  return (
    <View style={[styles.page, { paddingTop: insets.top }]} testID="myNight.page">
      <View style={[styles.bar, wide && styles.barWide]}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          style={styles.back}
          testID="myNight.back"
        >
          <Glyph name="back" size={20} ink={tokens.colorAccentText} weight={2.4} />
          <Text size={17} weight="semibold" style={styles.accent}>
            {t('eventNav.overview')}
          </Text>
        </Pressable>
        <View style={styles.brand}>
          <Brand height={22} />
        </View>
        {wide && you}
      </View>
      {seen.kind === 'shown' && seen.updated != null && (
        <View style={[styles.band, styles.bandDone]} testID="myNight.updated">
          <Notice tone="done" mark="✓" title={t('myNight.updated', { station: seen.updated })} />
        </View>
      )}
      {seen.kind === 'shown' && seen.stale && (
        <View style={[styles.band, styles.bandStale]} testID="myNight.stale">
          <Notice
            tone="attention"
            mark="!"
            title={t('myNight.staleTitle')}
            body={t('myNight.staleBody', { time: seen.readAt })}
            button={
              <SecondaryButton
                label={t('myNight.tryAgain')}
                onPress={again}
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
        <View style={wide && !pastAccess ? styles.wide : styles.column}>
          {seen.kind === 'shown' ? (
            <Night eventId={eventId} night={seen.night} now={seen.at} wide={wide} reread={again} />
          ) : (
            <View style={styles.card} accessibilityRole="progressbar" testID="myNight.loading">
              <Text size={17}>{t('myNight.loading')}</Text>
              <View style={styles.bone} />
              <View style={[styles.bone, styles.boneShort]} />
            </View>
          )}
          {!wide && you}
        </View>
      </ScrollView>
    </View>
  );
}

function Night({
  eventId,
  night,
  now,
  wide,
  reread,
}: {
  eventId: string;
  night: MyNight;
  now: number;
  wide: boolean;
  reread: () => void;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const heading = headingOf(night);
  const clock = <Clock eventId={eventId} night={night} now={now} reread={reread} />;

  if (night.pastAccess)
    return (
      <>
        <Text size={tokens.typeTitlePhone.size} weight="bold" accessibilityRole="header">
          {night.event.name}
        </Text>
        {clock}
      </>
    );
  const buttons: Record<
    NightButton['opens'],
    { label: string; href: Parameters<typeof router.push>[0]; testID: string }
  > = {
    checkIn: {
      label: t('checkIn.title'),
      href: checkInHrefOf(night.event.id, 'night'),
      testID: 'myNight.checkIn',
    },
    station: {
      label: t('station.wayIn.open', { station: openStationOf(night) ?? '' }),
      href: { pathname: '/events/[id]/station', params: { id: night.event.id, from: 'night' } },
      testID: 'myNight.openStation',
    },
    floor: {
      label: t('service.floor.wayIn.open'),
      href: { pathname: '/events/[id]/floor', params: { id: night.event.id, from: 'night' } },
      testID: 'myNight.openFloor',
    },
    whosHere: {
      label: t('whosHere.open'),
      href: {
        pathname: '/events/[id]/whos-here',
        params: { id: night.event.id, name: night.event.name },
      },
      testID: 'myNight.whosHere',
    },
  };

  const left = (
    <>
      <View style={styles.on}>
        <Text
          size={17}
          weight="semibold"
          style={styles.onLabel}
          accessibilityRole="header"
          accessibilityLabel={`${t('myNight.onTonight')} ${heading}`}
        >
          {t('myNight.onTonight')}
        </Text>
        <Text size={28} weight="bold" style={styles.onInk} importantForAccessibility="no">
          {heading}
        </Text>
      </View>
      {clock}
      {nightButtonsOf(night).map(({ opens, kind }) => {
        const { label, href, testID } = buttons[opens];
        const press = () => router.push(href);

        return kind === 'primary' ? (
          <PrimaryButton key={opens} label={label} onPress={press} testID={testID} />
        ) : (
          <SecondaryButton
            key={opens}
            label={label}
            onPress={press}
            tall={opens === 'floor' && !wide}
            testID={testID}
          />
        );
      })}
      {night.shift != null && <Shift night={night} shift={night.shift} />}
      <Card title={t('myNight.yourLead')}>
        <YourLead lead={night.lead} />
      </Card>
      {night.rules != null && (
        <Card title={t('myNight.beforeYouStart')}>
          <Text size={17} style={styles.rules}>
            {night.rules}
          </Text>
        </Card>
      )}
    </>
  );

  const right = (
    <>
      {night.timing.length > 0 && (
        <Card title={t('myNight.timing')}>
          {night.timing.map((moment) => (
            <View key={`${moment.at}${moment.title}`} style={styles.moment}>
              <Text size={17} weight="bold" style={styles.at}>
                {clockAt(moment.at, locale)}
              </Text>
              <View style={styles.shrink}>
                <Text size={17}>{moment.title}</Text>
                <View style={styles.row}>
                  <View style={moment.for === 'staff' ? styles.square : styles.circle} />
                  <Text size={17} weight="semibold" style={styles.secondary}>
                    {moment.for === 'staff' ? t('myNight.staff') : t('myNight.guests')}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </Card>
      )}
      {night.tables != null && <Tables night={night} tables={night.tables} now={now} />}
    </>
  );

  return (
    <>
      <View style={styles.head}>
        <Text size={17} style={styles.secondary}>
          {t('myNight.only', { time: clockAt(night.endsAt, locale) })}
        </Text>
        <Text size={17} weight="bold">
          {night.event.name}
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
  );
}

type Tapped = {
  /** The card as the tap's answer had it, until a later read of the night. */
  clock: ClockCard | null;
  line: ClockLine;
  /** The phase the line was said in: it goes once the card has moved on. */
  phase: ClockPhase;
  at: number;
};

/** Clock in and Clock out send at once and show what the server recorded; nothing is kept on the phone to send later. */
function Clock({
  eventId,
  night,
  now,
  reread,
}: {
  eventId: string;
  night: MyNight;
  now: number;
  reread: () => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState(0);
  const [tapped, setTapped] = useState<Tapped | null>(null);
  const clock = tapped?.clock != null && tapped.at > now ? tapped.clock : night.clock;
  if (clock == null) return null;
  const line = tapped != null && tapped.phase === clock.phase ? tapped.line : null;
  const { timeZone } = night.event;

  function answered(action: ClockAction, result: { outcome: ClockOutcome } | { error: unknown }) {
    const answer = answerOf(action, result);
    const at = Date.now();
    setBusy(false);
    setSaid((n) => n + 1);
    if (answer.kind === 'reread') {
      setTapped(null);
      reread();
    } else if (answer.kind === 'offline') {
      setTapped({ clock: null, line: answer.line, phase: clock?.phase ?? 'ready', at });
    } else {
      setTapped({ clock: answer.clock, line: answer.line, phase: answer.clock.phase, at });
      const words = recordedWords(t, answer.clock, new Date(at), timeZone, dateLocale());
      if (answer.line == null && words != null) readOut(words);
    }
  }

  function press() {
    const action = clock == null ? null : actionOf(clock);
    if (action == null || busy) return;
    setBusy(true);
    api.myNightClock(eventId, action).then(
      (outcome) => answered(action, { outcome }),
      (error: unknown) => answered(action, { error }),
    );
  }

  return (
    <ShiftClockCard
      clock={clock}
      past={night.pastAccess}
      line={line}
      said={said}
      busy={busy}
      now={new Date(Math.max(now, tapped?.at ?? 0))}
      timeZone={timeZone}
      onPress={press}
    />
  );
}

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      <Text size={17} weight="semibold" style={styles.secondary} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

export function Shift({ night, shift }: { night: MyNight; shift: NonNullable<MyNight['shift']> }) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const end = clockAt(shift.endsAt, locale);

  return (
    <Card title={t('myNight.yourShift')}>
      <Text size={20} weight="bold">
        {shift.job}
      </Text>
      <Text size={17}>{t('myNight.times', { start: clockAt(shift.startsAt, locale), end })}</Text>
      {crossesMidnight(shift) && (
        <Text size={17} style={styles.secondary}>
          {t('myNight.endsOn', { day: weekdayOf(shift.endsAt, locale), time: end })}
        </Text>
      )}
      {night.later != null && (
        <View style={styles.inset}>
          <Text size={17}>
            {t('myNight.later', {
              job: night.later.job,
              time: clockAt(night.later.startsAt, locale),
            })}
          </Text>
        </View>
      )}
    </Card>
  );
}

export function YourLead({ lead, callable = true }: { lead: MyNight['lead']; callable?: boolean }) {
  const { t } = useTranslation();

  if (lead == null) {
    return (
      <Text size={17} style={styles.secondary}>
        {t('myNight.noLead')}
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
            <Text size={17} weight="semibold" style={styles.secondary}>
              {t('myNight.floorLead')}
            </Text>
          </View>
        )}
      </View>
      {callable && lead.phone != null && (
        <Pressable
          onPress={() => void Linking.openURL(`tel:${lead.phone}`)}
          accessibilityRole="link"
          accessibilityLabel={t(lead.floor ? 'myNight.callFloorLead' : 'myNight.callLead', {
            name: lead.name,
          })}
          style={({ pressed }) => [styles.call, pressed && styles.callPressed]}
          testID="myNight.call"
        >
          <Glyph name="phone" size={18} ink={tokens.colorInkOnDark} />
          <Text size={17} weight="semibold" style={styles.onPrimary}>
            {t('myNight.call')}
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

function Tables({ night, tables, now }: { night: MyNight; tables: MyNightTable[]; now: number }) {
  const { t } = useTranslation();
  const open = now >= Date.parse(night.doorsAt);

  return (
    <Card title={t('myNight.yourTables')}>
      {open ? (
        tables.map((table) => (
          <View key={table.name} style={styles.inset}>
            <View style={styles.tableHead} accessibilityRole="header">
              <Text size={17} weight="bold">
                {table.name}
              </Text>
              <Text size={17} style={styles.secondary}>
                {t('myNight.guestCount', { count: table.guests.length })}
              </Text>
            </View>
            {table.guests.map((guest, index) => {
              const dietary = dietaryOf(t, guest);

              return (
                <View key={`${guest.name}${index}`} style={styles.guest}>
                  <Text size={17}>{guest.name}</Text>
                  {dietary != null && (
                    <View style={styles.row}>
                      <View style={styles.diamond} />
                      <Text size={17} weight="semibold" style={styles.attention}>
                        {dietary}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ))
      ) : (
        <View style={[styles.inset, styles.row]}>
          <Glyph name="clock" size={18} ink={tokens.colorInkSecondary} />
          <Text size={17} style={styles.shrink}>
            {t('myNight.opensAt', { time: clockAt(night.doorsAt, dateLocale()) })}
          </Text>
        </View>
      )}
    </Card>
  );
}

/** Under the page on a phone, in the bar on a tablet; the app keeps only Signed in as and Sign out. */
function You({ name, inBar }: { name: string; inBar: boolean }) {
  const { t } = useTranslation();

  return (
    <View style={inBar ? styles.youBar : styles.youFoot} testID="myNight.you">
      <View style={inBar ? styles.youWordsBar : styles.youWords}>
        <Text size={17} weight="bold">
          {t('settings.signedInAs', { email: name })}
        </Text>
      </View>
      <SecondaryButton
        label={t('settings.signOut')}
        onPress={signOutHere}
        testID="myNight.signOut"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colorPage },
  rules: { lineHeight: 26 },
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
  accent: { color: tokens.colorAccentText },
  attention: { color: tokens.colorAttentionText },
  onPrimary: { color: tokens.colorInkOnDark },
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
