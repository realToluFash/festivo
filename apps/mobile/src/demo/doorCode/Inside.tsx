import { type RefObject, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CARD_PIECES, Confetti } from '../../components/Cover.tsx';
import { EventMesh } from '../../components/EventMesh.tsx';
import { Glyph, type GlyphName } from '../../components/Glyph.tsx';
import { Sheet } from '../../components/Sheet.tsx';
import { Text } from '../../components/Text.tsx';
import { TabBar } from '../../components/TodayCover.tsx';
import { meshFor } from '../../kit/today.ts';
import { useLayout } from '../../layout/useLayout.ts';
import { tokens } from '../../theme/tokens.ts';
import { Face } from '../people/PeopleRole.tsx';
import {
  listed,
  ON_EVENT,
  outsideTag,
  type PeopleViewer,
  READ_ONLY,
  rowLine,
  seesEveryEvent,
} from '../people/PeopleSample.ts';
import { LineIcon } from '../settings/AccountCard.tsx';
import { Back } from '../../components/SettingsParts.tsx';
import {
  CardSays,
  Line,
  OnCard,
  PageToast,
  Row,
  RowList,
  SectionHead,
  SummaryCard,
  TextAction,
} from '../../components/Summary.tsx';
import {
  type CodeRole,
  clockWords,
  dayWords,
  doorMembers,
  everyone,
  EVENT,
  JOAO_ID,
  ORGANISATION,
  type Redeemable,
} from './DoorCodeModel.ts';
import { onEventCount, signedInAs, W } from './DoorCodeWords.ts';
import { AREA_WORDS, areasFor, type InsideArea, moreAreas } from './RedeemModel.ts';

const AREA_GLYPH: Record<InsideArea, GlyphName> = {
  checkIn: 'tick',
  overview: 'overview',
  guests: 'users',
  schedule: 'clock',
  seating: 'seating',
  people: 'people',
};
const TABS = [
  [W.overview, 'overview'],
  [W.guests, 'users'],
  [W.more, 'dots'],
] as const satisfies readonly (readonly [string, GlyphName])[];
type Tab = (typeof TABS)[number][0];

const JOAO: PeopleViewer = { id: JOAO_ID, role: 'Member' };
const CHECK_IN_LATER = 'Check-in has its own design.';
const TAB_BAR = 64;

/** An account with no organisation, inside the event it joined and nothing else: its tabs, no Today, Events or switcher (pm, 7 Nov). */
export function InsideEvent({
  at,
  code,
  role,
  who,
  locale,
  onAt,
  onSignOut,
  onAccount,
}: {
  at: 'overview' | 'people';
  locale: string;
  code: Redeemable;
  role: CodeRole;
  who: string;
  onAt: (at: 'overview' | 'people') => void;
  onSignOut: () => void;
  onAccount: () => void;
}) {
  const phone = useLayout().kind === 'phone';
  const insets = useSafeAreaInsets();
  const [more, setMore] = useState(false);
  const [told, setTold] = useState<string | null>(null);
  const moreOpener = useRef<ViewInstance>(null);
  const foot = Math.max(insets.bottom - tokens.spaceXxs, tokens.spaceLg);
  const tell = (words: string) => setTold(words);
  const go = (area: InsideArea) => {
    if (area === 'overview' || area === 'people') onAt(area);
    else tell(area === 'checkIn' ? CHECK_IN_LATER : `${AREA_WORDS[area]} has its own design.`);
  };
  const onTab = (tab: Tab) => {
    if (tab === W.more) setMore(true);
    else go(tab === W.overview ? 'overview' : 'guests');
  };
  const page =
    at === 'overview' ? (
      <Overview
        code={code}
        role={role}
        who={who}
        locale={locale}
        onPeople={() => onAt('people')}
        onSignOut={onSignOut}
        tell={tell}
      />
    ) : (
      <PeopleIn onBack={() => onAt('overview')} />
    );

  return (
    <View style={styles.page}>
      <ScrollView
        contentContainerStyle={[
          styles.blocks,
          phone
            ? {
                paddingTop: insets.top + tokens.spaceLg,
                paddingHorizontal: tokens.spaceXxl,
                paddingBottom: foot + TAB_BAR + tokens.space6xl,
              }
            : {
                paddingTop: insets.top + 76,
                paddingHorizontal: tokens.space5xl,
                paddingBottom: insets.bottom + tokens.space6xl,
              },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {page}
      </ScrollView>
      {!phone && (
        <Capsule
          areas={areasFor(role)}
          at={at}
          top={insets.top + tokens.spaceSm}
          onArea={go}
          onMore={() => setMore(true)}
        />
      )}
      {phone && (
        <TabBar
          tabs={TABS}
          bottom={foot}
          at={at === 'people' ? W.more : W.overview}
          onTab={onTab}
        />
      )}
      <MoreSheet
        open={more}
        opener={moreOpener}
        who={who}
        areas={moreAreas(role, phone)}
        onClose={() => setMore(false)}
        onArea={(area) => {
          setMore(false);
          go(area);
        }}
        onAccount={() => {
          setMore(false);
          onAccount();
        }}
        onSignOut={() => {
          setMore(false);
          onSignOut();
        }}
      />
      {told != null && (
        <PageToast
          words={told}
          onClose={() => setTold(null)}
          bottom={phone ? foot + TAB_BAR + tokens.spaceXl : Math.max(insets.bottom, tokens.spaceLg)}
        />
      )}
    </View>
  );
}

function Overview({
  code,
  role,
  who,
  locale,
  onPeople,
  onSignOut,
  tell,
}: {
  code: Redeemable;
  role: CodeRole;
  who: string;
  locale: string;
  onPeople: () => void;
  onSignOut: () => void;
  tell: (words: string) => void;
}) {
  const until = clockWords(EVENT.ends, locale);
  const checks = role === 'Can check guests in';

  return (
    <>
      <SummaryCard
        height={200}
        gap={8}
        backdrop={
          <>
            <EventMesh event={{ mesh: meshFor(EVENT.id), photo: null }} shade="side" />
            <Confetti pieces={CARD_PIECES} />
          </>
        }
        step={
          checks
            ? {
                label: W.checkIn,
                onPress: () => tell(CHECK_IN_LATER),
                testID: 'inside.checkIn',
              }
            : null
        }
        testID="inside.card"
      >
        <OnCard
          text={`${dayWords(EVENT.day, locale)} · ${clockWords(EVENT.starts, locale)} to ${until}`}
        />
        <CardSays text={EVENT.name} heading />
        <OnCard text={EVENT.venue} />
        <OnCard
          text={[role, code.job, `until ${until}`].filter((part) => part != null).join(' · ')}
          strong
        />
      </SummaryCard>
      <RowList
        items={[
          {
            key: 'guests',
            inset: 40,
            row: (
              <Row
                title={W.guests}
                line={W.guestsLine}
                lead={<LineIcon name="users" />}
                opens
                onPress={() => tell('Guests has its own design.')}
                testID="inside.guests"
              />
            ),
          },
          {
            key: 'people',
            inset: 40,
            row: (
              <Row
                title={W.people}
                line={onEventCount(everyone().length)}
                lead={<LineIcon name="people" />}
                opens
                onPress={onPeople}
                testID="inside.people"
              />
            ),
          },
        ]}
      />
      <You who={who} onSignOut={onSignOut} />
    </>
  );
}

export function You({ who, onSignOut }: { who: string; onSignOut: () => void }) {
  return (
    <View style={styles.you}>
      <Text size={15} weight="semibold">
        {signedInAs(who)}
      </Text>
      <TextAction
        label={W.signOut}
        plain
        glyph="signOut"
        onPress={onSignOut}
        testID="inside.signOut"
      />
    </View>
  );
}

/** People as anyone on the event reads it: the one list, no card, no Add, nothing opens. */
function PeopleIn({ onBack }: { onBack: () => void }) {
  const shown = listed(everyone());
  const tag = outsideTag(ORGANISATION);

  return (
    <>
      <View>
        <Back label={W.overview} onPress={onBack} />
        <View style={styles.title}>
          <Text size={30} weight="bold" accessibilityRole="header" style={styles.titleText}>
            {W.people}
          </Text>
          <Text size={15} weight="medium" style={styles.secondary}>
            {EVENT.name}
          </Text>
        </View>
      </View>
      <View>
        <SectionHead
          title={ON_EVENT}
          right={
            <Text size={15} weight="medium" style={[styles.secondary, styles.figures]}>
              {String(shown.length)}
            </Text>
          }
        />
        <RowList
          items={shown.map((one) => {
            const line = rowLine(one, JOAO);

            return {
              key: one.id,
              inset: 40 + tokens.spaceLg,
              row: (
                <Row
                  title={one.name}
                  line={line}
                  lead={<Face person={one} side={40} />}
                  tag={one.outside ? { kind: 'now', word: tag } : null}
                  accessibilityLabel={[one.name, one.outside ? tag : null, line]
                    .filter((part) => part != null)
                    .join('. ')}
                  testID={`inside.row.${one.id}`}
                />
              ),
            };
          })}
        />
      </View>
      <View style={styles.foot}>
        <Line text={READ_ONLY} size={14} />
        <Line text={seesEveryEvent(doorMembers(), ORGANISATION)} size={14} />
      </View>
    </>
  );
}

/** The event's More for an account with no organisation: People, and Your account with Sign out, as nothing else holds them. */
function MoreSheet({
  open,
  opener,
  who,
  areas,
  onClose,
  onArea,
  onAccount,
  onSignOut,
}: {
  open: boolean;
  opener: RefObject<ViewInstance | null>;
  who: string;
  areas: readonly InsideArea[];
  onClose: () => void;
  onArea: (area: InsideArea) => void;
  onAccount: () => void;
  onSignOut: () => void;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      opener={opener}
      scrimLabel={W.close}
      headingTakesFocus
      testID="inside.more"
    >
      <View style={styles.more}>
        <View style={styles.moreHead}>
          <Text size={22} weight="bold" accessibilityRole="header" style={styles.grow}>
            {W.more}
          </Text>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={W.close}
            testID="inside.more.close"
          >
            <Glyph name="x" size={18} ink={tokens.colorInk} weight={2.4} />
          </Pressable>
        </View>
        <RowList
          items={[
            ...areas.map((area) => ({
              key: area,
              inset: 40,
              row: (
                <Row
                  title={AREA_WORDS[area]}
                  lead={<LineIcon name={AREA_GLYPH[area]} />}
                  opens
                  onPress={() => onArea(area)}
                  testID={`inside.more.${area}`}
                />
              ),
            })),
            {
              key: 'account',
              inset: 40,
              row: (
                <Row
                  title={W.yourAccount}
                  line={who}
                  lead={<LineIcon name="user" />}
                  opens
                  onPress={onAccount}
                  testID="inside.more.account"
                />
              ),
            },
          ]}
        />
        <TextAction
          label={W.signOut}
          plain
          glyph="signOut"
          onPress={onSignOut}
          testID="inside.more.signOut"
        />
      </View>
    </Sheet>
  );
}

/** Upright and on its side, the event's tabs as a capsule at the top, as the board draws it upright. */
function Capsule({
  areas,
  at,
  top,
  onArea,
  onMore,
}: {
  areas: readonly InsideArea[];
  at: 'overview' | 'people';
  top: number;
  onArea: (area: InsideArea) => void;
  onMore: () => void;
}) {
  const tabs: readonly (InsideArea | 'more')[] = [...areas, 'more'];

  return (
    <View style={[styles.capsuleAt, { top }]} pointerEvents="box-none">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.capsuleBar}
        contentContainerStyle={styles.capsule}
        accessibilityRole="tablist"
      >
        {tabs.map((tab) => {
          const on = tab === at;
          const label = tab === 'more' ? W.more : AREA_WORDS[tab];

          return (
            <Pressable
              key={tab}
              onPress={() => (tab === 'more' ? onMore() : onArea(tab))}
              style={[styles.capsuleTab, on && styles.capsuleOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={label}
              testID={`inside.tab.${tab}`}
            >
              <Text
                size={15}
                weight={on ? 'semibold' : 'medium'}
                accessible={false}
                style={{ color: on ? tokens.colorAccentText : tokens.colorInkSecondary }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colorCard },
  grow: { flex: 1, minWidth: 0 },
  pressed: { opacity: tokens.opacityPressed },
  secondary: { color: tokens.colorInkSecondary },
  figures: { fontVariant: ['tabular-nums'] },
  blocks: { gap: 18 },
  you: { gap: tokens.spaceHair },
  title: { gap: tokens.spaceXxs, paddingTop: 14 },
  titleText: { letterSpacing: 30 * -0.02 },
  foot: { gap: tokens.spaceSm },
  more: {
    gap: tokens.spaceXl,
    paddingHorizontal: tokens.spaceXxl,
    paddingTop: 31,
    paddingBottom: tokens.space6xl,
  },
  moreHead: { minHeight: tokens.sizeHit, flexDirection: 'row', alignItems: 'center' },
  close: {
    width: tokens.sizeHit,
    height: tokens.sizeHit,
    borderRadius: tokens.sizeHit / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorInset,
  },
  capsuleAt: {
    position: 'absolute',
    left: tokens.space5xl,
    right: tokens.space5xl,
    alignItems: 'center',
    zIndex: 2,
  },
  capsuleBar: { flexGrow: 0, borderRadius: 25, backgroundColor: tokens.colorInset },
  capsule: { flexDirection: 'row', gap: tokens.spaceHair, padding: 3 },
  capsuleTab: {
    minHeight: tokens.sizeHit,
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceXl,
    borderRadius: tokens.sizeHit / 2,
  },
  capsuleOn: { backgroundColor: tokens.colorAccentTint },
});
