import { type ReactNode, useMemo, useState } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BellButton } from '../../components/BellButton.tsx';
import type { GlyphName } from '../../components/Glyph.tsx';
import { OrgPill } from '../../components/OrgPill.tsx';
import { Pill, TYPE } from '../../components/SettingsParts.tsx';
import { Text } from '../../components/Text.tsx';
import { type Tab, TABS, WhiteCapsule } from '../../components/TodayCover.tsx';
import { pillBesideTabs } from '../../kit/frameBand.ts';
import { useNameLines } from '../../layout/useLayout.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { NavBar } from '../DemoScreen.tsx';
import {
  answersStack,
  answerWidth,
  firstWord,
  LANGUAGES,
  ORGANISATIONS,
  type PillFitLanguage,
  type PillFitOrganisation,
  pillShowsWords,
  type Sending,
} from './pillFitRules.ts';

export interface PillFitStart {
  language: PillFitLanguage;
  organisation: PillFitOrganisation;
  waiting: 0 | 1 | 2;
  sending: Sending;
}

const ROOMS = [120, 140, 160, 180, 200, 220, 240, 260, 280] as const;

/** sc-38149: the pill beside an upright tablet's tabs, where it turns to its tile, and the invitation's answers standing on the rows sending needs. */
export function PillFitScreen({ start }: { start: PillFitStart }) {
  const { i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const [language, setLanguage] = useState(start.language);
  const [organisation, setOrganisation] = useState(start.organisation);
  const [waiting, setWaiting] = useState(start.waiting);
  const [sending, setSending] = useState<Sending>(start.sending);
  const words = useMemo(
    () => i18n.cloneInstance({ lng: language, initAsync: false }),
    [i18n, language],
  );
  const name = ORGANISATIONS.find((option) => option.key === organisation)?.label ?? '';

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 40 }}
      >
        <NavBar />
        <I18nextProvider i18n={words}>
          <PillAndAnswers name={name} waiting={waiting} sending={sending} onSend={setSending} />
        </I18nextProvider>
        <View style={styles.page}>
          <DemoOnly title="Stand in for the phone’s language and qa’s account. The words are the app’s own; nothing is sent.">
            <Choices
              heading="Language"
              options={LANGUAGES}
              chosen={language}
              onChoose={setLanguage}
              id="language"
            />
            <Choices
              heading="Organisation"
              options={ORGANISATIONS}
              chosen={organisation}
              onChoose={setOrganisation}
              id="organisation"
            />
            <Choices
              heading="Invitations waiting"
              options={[
                { key: '0', label: 'None' },
                { key: '1', label: 'One' },
                { key: '2', label: 'Two' },
              ]}
              chosen={String(waiting)}
              onChoose={(key) => setWaiting(key === '0' ? 0 : key === '2' ? 2 : 1)}
              id="waiting"
            />
            <Choices
              heading="The answer"
              options={[
                { key: 'none', label: 'Not pressed' },
                { key: 'accept', label: 'Accept and join sending' },
                { key: 'decline', label: 'Decline sending' },
              ]}
              chosen={sending ?? 'none'}
              onChoose={(key) => setSending(key === 'none' ? null : key)}
              id="sending"
            />
          </DemoOnly>
        </View>
      </ScrollView>
    </View>
  );
}

function PillAndAnswers({
  name,
  waiting,
  sending,
  onSend,
}: {
  name: string;
  waiting: 0 | 1 | 2;
  sending: Sending;
  onSend: (sending: Sending) => void;
}) {
  const { t } = useTranslation();
  const lines = useNameLines();
  const waitingWords = waiting > 0 ? t('invitations.count', { count: waiting }) : null;
  const [widths, setWidths] = useState<Record<string, number>>({});
  const measured = (key: string) => widths[key] ?? 0;
  const pillWidths = {
    firstWord: measured('firstWord'),
    waitingLine: waitingWords == null ? null : measured('waiting'),
  };
  const label = `Organisation: ${name}, your role Owner. Switch organisation${
    waiting === 0 ? '' : `. ${waiting} ${waiting === 1 ? 'invitation' : 'invitations'} waiting`
  }`;
  const pill = (room: number) => (
    <OrgPill
      id="org-qa"
      name={name}
      waiting={waitingWords}
      label={label}
      onPress={() => undefined}
      lines={lines}
      tileAlone={!pillShowsWords(room, pillWidths)}
      testID={`demo.pillFit.pill.${room}`}
    />
  );

  return (
    <>
      <Measure
        items={[
          ['firstWord', firstWord(name), 15],
          ['waiting', waitingWords ?? '', 12.5],
          ['accept', t('invitations.accept'), TYPE.body],
          ['joining', t('invitations.joining'), TYPE.body],
          ['decline', t('invitations.decline'), TYPE.body],
          ['declining', t('invitations.declining'), TYPE.body],
        ]}
        onMeasure={(key, width) =>
          setWidths((was) => (was[key] === width ? was : { ...was, [key]: width }))
        }
      />
      <HeaderRow pill={pill} />
      <View style={styles.page}>
        <Heading>Where it turns to its tile</Heading>
        <Text size={TYPE.small} style={styles.secondary}>
          The room beside the tabs, from sc-30410’s 120 up. It draws its words where the name’s
          first word and the invitation line each fit whole; the name takes one line and ends in …
        </Text>
        {ROOMS.map((room) => (
          <View key={room} style={styles.ladderRow}>
            <Text size={TYPE.meta} style={[styles.secondary, styles.roomLabel]}>
              {String(room)}
            </Text>
            <View style={[styles.room, { width: room }]}>{pill(room)}</View>
          </View>
        ))}
        <Heading>The invitation’s answers</Heading>
        <Answers
          name={name}
          sending={sending}
          onSend={onSend}
          accept={answerWidth(measured('accept'), measured('joining'))}
          decline={answerWidth(measured('decline'), measured('declining'))}
        />
      </View>
    </>
  );
}

/** As the upright tablet's header draws it (`AppFrame`): the tabs centred, the bell at the end, and the pill in the room left of the tabs. */
function HeaderRow({ pill }: { pill: (room: number) => ReactNode }) {
  const { t } = useTranslation();
  const [rowWidth, setRowWidth] = useState(0);
  const [tabsWidth, setTabsWidth] = useState(0);
  const [at, setAt] = useState<Tab>('Today');
  const beside = pillBesideTabs(rowWidth, tabsWidth);

  return (
    <View style={styles.header}>
      <View style={styles.row} onLayout={(event) => setRowWidth(event.nativeEvent.layout.width)}>
        <View style={[styles.shrink, beside != null && { maxWidth: beside.maxWidth }]}>
          {pill(beside?.maxWidth ?? 0)}
        </View>
        <View style={styles.fill} />
        <BellButton />
        <View style={styles.capsuleAt} pointerEvents="box-none">
          <View onLayout={(event) => setTabsWidth(event.nativeEvent.layout.width)}>
            <WhiteCapsule
              tabs={TABS}
              at={at}
              onTab={setAt}
              say={(_: Tab, glyph: GlyphName) => t(`todayScreen.tab.${glyph}`)}
            />
          </View>
        </View>
      </View>
      <Text size={TYPE.meta} style={styles.secondary} testID="demo.pillFit.room">
        {`Room beside the tabs on this device: ${Math.round(beside?.maxWidth ?? 0)}`}
      </Text>
    </View>
  );
}

function Answers({
  name,
  sending,
  onSend,
  accept,
  decline,
}: {
  name: string;
  sending: Sending;
  onSend: (sending: Sending) => void;
  accept: number;
  decline: number;
}) {
  const { t } = useTranslation();
  const [row, setRow] = useState(0);
  const stacked = row > 0 && answersStack(row, accept, decline);

  return (
    <View style={styles.invitation}>
      <Text size={TYPE.row} weight="semibold">
        Celebraciones Alameda
      </Text>
      <View
        style={stacked ? styles.stacked : styles.beside}
        onLayout={(event) => setRow(event.nativeEvent.layout.width)}
      >
        <View style={stacked ? undefined : { minWidth: accept }}>
          <Pill
            label={sending === 'accept' ? t('invitations.joining') : t('invitations.accept')}
            accessibilityLabel={
              sending === 'accept'
                ? t('invitations.joining')
                : t('invitations.acceptLabel', { organisation: name })
            }
            kind={sending == null ? 'primary' : 'off'}
            busy={sending === 'accept'}
            full
            height={tokens.sizeHit}
            onPress={() => onSend('accept')}
            testID="demo.pillFit.accept"
          />
        </View>
        <View style={stacked ? undefined : { minWidth: decline }}>
          <Pill
            label={sending === 'decline' ? t('invitations.declining') : t('invitations.decline')}
            accessibilityLabel={
              sending === 'decline'
                ? t('invitations.declining')
                : t('invitations.declineLabel', { organisation: name })
            }
            kind={sending == null ? 'secondary' : 'off'}
            busy={sending === 'decline'}
            full
            height={tokens.sizeHit}
            onPress={() => onSend('decline')}
            testID="demo.pillFit.decline"
          />
        </View>
      </View>
    </View>
  );
}

/** Each text's width on one line, at the pill's and the buttons' sizes, drawn out of sight. */
function Measure({
  items,
  onMeasure,
}: {
  items: readonly (readonly [string, string, number])[];
  onMeasure: (key: string, width: number) => void;
}) {
  return (
    <View
      style={styles.measure}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {items.map(([key, words, size]) => (
        <Text
          key={key}
          size={size}
          weight="semibold"
          numberOfLines={1}
          accessible={false}
          style={styles.measured}
          onLayout={(event) => onMeasure(key, Math.ceil(event.nativeEvent.layout.width))}
        >
          {words}
        </Text>
      ))}
    </View>
  );
}

function Heading({ children }: { children: string }) {
  return (
    <Text size={TYPE.card} weight="semibold" accessibilityRole="header" style={styles.heading}>
      {children}
    </Text>
  );
}

function Choices<Key extends string>({
  heading,
  options,
  chosen,
  onChoose,
  id,
}: {
  heading: string;
  options: readonly { key: Key; label: string }[];
  chosen: Key;
  onChoose: (key: Key) => void;
  id: string;
}) {
  return (
    <View style={styles.choices}>
      <Text size={tokens.typeSmall.size} weight="semibold" style={styles.secondary}>
        {heading}
      </Text>
      <View style={styles.options}>
        {options.map((option) => {
          const on = option.key === chosen;

          return (
            <Pressable
              key={option.key}
              onPress={() => onChoose(option.key)}
              style={({ pressed }) => [
                styles.option,
                on && styles.optionOn,
                pressed && styles.pressed,
              ]}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              testID={`demo.pillFit.${id}.${option.key}`}
            >
              <Text size={tokens.typeSmall.size} weight="semibold">
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.colorPage },
  page: { gap: tokens.spaceMd, paddingHorizontal: tokens.spaceXxl, paddingTop: tokens.spaceLg },
  header: {
    gap: tokens.spaceSm,
    paddingHorizontal: tokens.space4xl,
    paddingBottom: tokens.spaceXl,
    backgroundColor: tokens.colorHeader,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colorHeaderBorder,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  shrink: { flexShrink: 1, minWidth: 0 },
  fill: { flex: 1 },
  capsuleAt: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: { marginTop: tokens.spaceLg },
  secondary: { color: tokens.colorInkSecondary },
  ladderRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceMd },
  roomLabel: { width: 32 },
  room: {
    flexDirection: 'row',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens.colorBorder,
    borderRadius: tokens.radiusRow,
  },
  invitation: {
    gap: tokens.spaceMd,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusInset,
    borderWidth: 1,
    borderColor: tokens.colorInsetBorder,
    backgroundColor: tokens.colorInset,
  },
  beside: { flexDirection: 'row', gap: tokens.spaceMd },
  stacked: { gap: tokens.spaceMd },
  measure: { position: 'absolute', top: 0, left: 0, width: 4000, opacity: 0 },
  measured: { alignSelf: 'flex-start' },
  choices: { gap: tokens.spaceXs },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
  option: {
    minHeight: tokens.sizeHit,
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceLg,
    borderRadius: tokens.sizeHit / 2,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
  },
  optionOn: { borderColor: tokens.colorInk, backgroundColor: tokens.colorCard },
  pressed: { opacity: 0.8 },
});
