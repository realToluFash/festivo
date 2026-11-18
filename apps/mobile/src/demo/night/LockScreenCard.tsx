import { type Href, router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SecondaryButton } from '../../components/Buttons.tsx';
import { Text } from '../../components/Text.tsx';
import { useLayout } from '../../layout/useLayout.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { goBack } from '../DemoScreen.tsx';
import {
  CARD_STATES,
  CARD_WORDS,
  CW,
  type RunCard,
  SURFACES,
  SURFACE_NAMES,
  type Surface,
  cardLanguage,
  cardScene,
  cardStateOf,
  surfaceOf,
} from './lockCard.ts';

const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

/** A tap opens the night on the card's track, as Today's Open run of show does with that track picked. */
function openNight(card: RunCard): void {
  router.push(`/demo/night?state=populated&track=${card.trackId}` as Href);
}

/** The card as the system draws it, in white with the house ink: nothing of Soirely's but the words and their order, and no button. */
export function RunCardView({
  card,
  age,
  surface = 'lock',
  onPress = openNight,
}: {
  card: RunCard;
  age: string;
  surface?: Surface;
  onPress?: (card: RunCard) => void;
}) {
  const android = surface === 'shade' || surface === 'shadeOpen';
  const collapsed = surface === 'shade';

  return (
    <Pressable
      onPress={() => onPress(card)}
      accessibilityLabel={card.spoken}
      accessibilityHint={`Opens the night on ${card.title.split(' · ').slice(1).join(' · ')}`}
      style={[styles.card, android ? styles.cardAndroid : styles.cardIos]}
      testID={`lockCard.${card.trackId}`}
    >
      <View style={styles.cardHead} {...hidden}>
        <View style={android ? styles.markSmall : styles.mark}>
          <Text accessible={false} size={android ? 12 : 18} weight="bold" style={styles.onDark}>
            S
          </Text>
        </View>
        <Text
          accessible={false}
          size={13}
          weight="semibold"
          style={android ? styles.label : styles.grow}
        >
          {CW.app}
        </Text>
        {android && (
          <Text accessible={false} size={13} style={[styles.secondary, styles.grow]}>
            {`· ${age}`}
          </Text>
        )}
        {!android && (
          <Text accessible={false} size={13} style={styles.secondary}>
            {age}
          </Text>
        )}
      </View>
      <View style={android ? styles.wordsAndroid : styles.wordsIos} {...hidden}>
        <Text accessible={false} size={15} weight="semibold">
          {card.title}
        </Text>
        {collapsed ? (
          <Text accessible={false} size={15} numberOfLines={1}>
            {card.lines.join(' · ')}
          </Text>
        ) : (
          card.lines.map((line) => (
            <Text accessible={false} key={line} size={15} style={styles.num}>
              {line}
            </Text>
          ))
        )}
      </View>
    </Pressable>
  );
}

export function LockScreenCardRoute() {
  const params = useLocalSearchParams<{ state?: string; surface?: string; locale?: string }>();
  const state = cardStateOf(params.state);
  const surface = surfaceOf(params.surface);

  return (
    <LockScreen
      key={`${state}|${surface}|${params.locale ?? ''}`}
      state={state}
      surface={surface}
      locale={params.locale}
    />
  );
}

function LockScreen({
  state,
  surface,
  locale,
}: {
  state: ReturnType<typeof cardStateOf>;
  surface: Surface;
  locale: string | undefined;
}) {
  const insets = useSafeAreaInsets();
  const { kind, height } = useLayout();
  const scene = cardScene(state, locale);
  const wide = kind !== 'phone';
  const android = surface === 'shade' || surface === 'shadeOpen';
  const cards = surface === 'held' ? scene.cards.slice(0, 1) : scene.cards;

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ paddingBottom: insets.bottom }}>
      <View
        style={[
          styles.screen,
          surface === 'channels' && styles.settings,
          { minHeight: height, paddingTop: insets.top },
        ]}
      >
        <Pressable onPress={goBack} accessibilityRole="button" style={styles.back}>
          <Text
            size={15}
            weight="semibold"
            style={surface === 'channels' ? styles.accentText : styles.onDark}
          >
            Back
          </Text>
        </Pressable>
        {surface === 'channels' ? (
          <Channels locale={scene.locale} />
        ) : (
          <View style={[styles.column, wide && styles.columnWide]}>
            {android ? (
              <View style={styles.shadeTop} {...hidden}>
                <Text
                  accessible={false}
                  size={14}
                  weight="semibold"
                  style={[styles.onDark, styles.num]}
                >
                  {scene.clock}
                </Text>
                <View style={styles.tiles}>
                  {[0, 1, 2, 3].map((tile) => (
                    <View key={tile} style={styles.tile} />
                  ))}
                </View>
                {cards.length > 0 && (
                  <Text
                    accessible={false}
                    size={13}
                    weight="semibold"
                    style={styles.onDarkSecondary}
                  >
                    Silent
                  </Text>
                )}
              </View>
            ) : surface === 'center' ? (
              <View style={styles.centerTop} {...hidden}>
                <Text
                  accessible={false}
                  size={15}
                  weight="semibold"
                  style={[styles.onDark, styles.num]}
                >
                  {scene.clock}
                </Text>
                <Text accessible={false} size={22} weight="bold" style={styles.onDark}>
                  Notification Center
                </Text>
              </View>
            ) : (
              <View style={styles.lockTop} {...hidden}>
                <Text accessible={false} size={17} weight="semibold" style={styles.onDarkSecondary}>
                  {scene.date}
                </Text>
                <Text
                  accessible={false}
                  size={80}
                  weight="semibold"
                  style={[styles.onDark, styles.num]}
                >
                  {scene.clock}
                </Text>
              </View>
            )}
            <View style={[styles.cards, surface === 'held' && styles.held]}>
              {cards.map((card, index) => (
                <RunCardView
                  key={card.trackId}
                  card={card}
                  age={scene.ages[index] ?? 'now'}
                  surface={surface}
                />
              ))}
            </View>
          </View>
        )}
      </View>
      <View style={styles.demoPad}>
        <DemoOnly
          title={`${CARD_STATES[state].name}. ${scene.pushOff ? CW.noCard : 'A tap opens the night on that track.'} The card’s words are ${CW.settled}, in en, es, fr and pt (?locale=fr-FR); a title over 40 characters shows its first 39 and “…”. The lock screen around the card is the system’s, drawn as a stand-in.`}
        >
          {['en-US', 'es-ES', 'fr-FR', 'pt-PT']
            .filter((one) => one !== scene.locale)
            .map((one) => (
              <SecondaryButton
                key={one}
                label={`In ${one.slice(0, 2)}`}
                onPress={() => router.setParams({ locale: one })}
                testID={`lockCard.locale.${one}`}
              />
            ))}
          {SURFACES.filter((one) => one !== surface).map((one) => (
            <SecondaryButton
              key={one}
              label={SURFACE_NAMES[one]}
              onPress={() => router.setParams({ surface: one })}
              testID={`lockCard.surface.${one}`}
            />
          ))}
        </DemoOnly>
      </View>
    </ScrollView>
  );
}

/** Android's own settings for Soirely: Event day as main has it, and the new silent Run of show channel beside it. */
function Channels({ locale }: { locale: string }) {
  const rows = [
    { name: 'Event day', how: 'Alerting', source: 'appPush.ts on main' },
    { name: CARD_WORDS[cardLanguage(locale)].channel, how: 'Silent', source: 'new, sc-66580' },
  ];

  return (
    <View style={styles.channels}>
      <Text size={24} weight="bold" accessibilityRole="header">
        Notifications
      </Text>
      <Text size={17} weight="semibold">
        Soirely
      </Text>
      <View style={styles.channelRow}>
        <Text size={16} style={styles.grow}>
          All Soirely notifications
        </Text>
        <SwitchShape label="All Soirely notifications" />
      </View>
      <Text size={13} weight="semibold" style={styles.secondary}>
        Categories
      </Text>
      {rows.map((row) => (
        <View key={row.name} style={styles.channelRow}>
          <View style={styles.grow}>
            <Text size={16}>{row.name}</Text>
            <Text size={14} style={styles.secondary}>
              {row.how}
            </Text>
          </View>
          <SwitchShape label={`${row.name}, ${row.how}`} />
        </View>
      ))}
    </View>
  );
}

/** The system's switch, drawn on: it belongs to Android, so it is a picture here. */
function SwitchShape({ label }: { label: string }) {
  return (
    <View style={styles.switchTrack} accessible accessibilityLabel={`${label}, on`}>
      <View style={styles.switchThumb} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colorDark },
  screen: { backgroundColor: tokens.colorDark, paddingHorizontal: tokens.spaceMd },
  settings: { backgroundColor: tokens.colorCard },
  back: { minHeight: tokens.sizeHit, justifyContent: 'center', alignSelf: 'flex-start' },
  column: { gap: tokens.spaceXl, width: '100%' },
  columnWide: { maxWidth: 520, alignSelf: 'center' },
  lockTop: { alignItems: 'center', gap: tokens.spaceXs, paddingVertical: tokens.spaceXl },
  centerTop: { gap: tokens.spaceSm, paddingVertical: tokens.spaceLg },
  shadeTop: { gap: tokens.spaceLg, paddingVertical: tokens.spaceMd },
  tiles: { flexDirection: 'row', gap: tokens.spaceSm },
  tile: {
    flex: 1,
    height: 56,
    borderRadius: tokens.radiusCardLarge,
    backgroundColor: tokens.colorDarkInset,
  },
  cards: { gap: tokens.spaceSm },
  held: { paddingTop: tokens.space4xl },
  card: {
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    gap: tokens.spaceXs,
  },
  cardIos: { borderRadius: 22, paddingVertical: tokens.spaceMd, paddingHorizontal: 14 },
  cardAndroid: { borderRadius: 24, paddingVertical: 14, paddingHorizontal: tokens.spaceLg },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  mark: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: tokens.colorAccentHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markSmall: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: tokens.colorAccentHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordsIos: { paddingLeft: 46, gap: 2 },
  wordsAndroid: { paddingLeft: 30, gap: 2 },
  label: { color: tokens.colorInk },
  secondary: { color: tokens.colorInkSecondary },
  accentText: { color: tokens.colorAccentText },
  onDark: { color: tokens.colorInkOnDark },
  onDarkSecondary: { color: tokens.colorInkOnDarkSecondary },
  num: { fontVariant: ['tabular-nums'] },
  grow: { flex: 1, minWidth: 0 },
  channels: { gap: tokens.spaceLg, paddingVertical: tokens.spaceLg },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    minHeight: tokens.sizeHit,
  },
  switchTrack: {
    width: 52,
    height: 32,
    borderRadius: 16,
    backgroundColor: tokens.colorAccent,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: 4,
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: tokens.colorCard,
  },
  demoPad: { paddingHorizontal: tokens.spaceLg, backgroundColor: tokens.colorPage },
});
