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
import { LineIcon } from '../../components/AccountCard.tsx';
import { Brand } from '../../components/Brand.tsx';
import { Initials } from '../../components/Initials.tsx';
import { Back } from '../../components/SettingsParts.tsx';
import { SidebarColumn, SidebarPlace, SidebarPlaces } from '../../components/TodaySidebar.tsx';
import { EventThumb } from '../../components/EventCard.tsx';
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
  atWords,
  clockWords,
  dayWords,
  doorMembers,
  everyone,
  endMoment,
  EVENT,
  JOAO_ID,
  ON_THE_DAY,
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
  moreAtStart = false,
  onAt,
  onSignOut,
  onAccount,
}: {
  at: 'overview' | 'people';
  locale: string;
  moreAtStart?: boolean;
  code: Redeemable;
  role: CodeRole;
  who: string;
  onAt: (at: 'overview' | 'people') => void;
  onSignOut: () => void;
  onAccount: () => void;
}) {
  const kind = useLayout().kind;
  const phone = kind === 'phone';
  const side = kind === 'tabletLandscape';
  const insets = useSafeAreaInsets();
  const [more, setMore] = useState(moreAtStart);
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
        you={!side}
        onPeople={() => onAt('people')}
        onSignOut={onSignOut}
        tell={tell}
      />
    ) : (
      <PeopleIn onBack={() => onAt('overview')} />
    );

  const sheet = (
    <MoreSheet
      open={more}
      opener={moreOpener}
      who={who}
      title={side ? who : W.more}
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
  );
  const toast = told != null && (
    <PageToast
      words={told}
      onClose={() => setTold(null)}
      bottom={phone ? foot + TAB_BAR + tokens.spaceXl : Math.max(insets.bottom, tokens.spaceLg)}
    />
  );

  if (side)
    return (
      <View style={[styles.chrome, { paddingTop: insets.top }]}>
        <SideBar
          areas={areasFor(role)}
          at={at}
          who={who}
          role={role}
          locale={locale}
          personRef={moreOpener}
          onArea={go}
          onPerson={() => setMore(true)}
        />
        <View style={[styles.main, { marginBottom: Math.max(insets.bottom, tokens.spaceMd) }]}>
          <ScrollView contentContainerStyle={styles.pane} showsVerticalScrollIndicator={false}>
            {page}
          </ScrollView>
        </View>
        {sheet}
        {toast}
      </View>
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
      {sheet}
      {toast}
    </View>
  );
}

/** On its side, the event's sidebar: its level's areas only, and at its foot the person, whose button holds Your account and Sign out (pm and ux, 8 Nov). */
function SideBar({
  areas,
  at,
  who,
  role,
  locale,
  personRef,
  onArea,
  onPerson,
}: {
  areas: readonly InsideArea[];
  at: 'overview' | 'people';
  who: string;
  role: CodeRole;
  locale: string;
  personRef: RefObject<ViewInstance | null>;
  onArea: (area: InsideArea) => void;
  onPerson: () => void;
}) {
  const day = dayWords(EVENT.day, locale);

  return (
    <SidebarColumn>
      <View style={styles.logo}>
        <Brand lockup height={24} />
      </View>
      <View style={styles.sideCard} accessible accessibilityLabel={`${EVENT.name}. ${day}`}>
        <EventThumb
          event={{ id: EVENT.id, mesh: meshFor(EVENT.id), photo: null }}
          side={40}
          radius={12}
        />
        <View style={styles.grow}>
          <Text size={14} weight="bold" numberOfLines={2} accessible={false}>
            {EVENT.name}
          </Text>
          <Text size={12.5} weight="medium" accessible={false} style={styles.secondary}>
            {day}
          </Text>
        </View>
      </View>
      <SidebarPlaces>
        {areas.map((area) => (
          <SidebarPlace
            key={area}
            label={AREA_WORDS[area]}
            glyph={AREA_GLYPH[area]}
            on={area === at}
            onPress={() => onArea(area)}
            testID={`inside.side.${area}`}
          />
        ))}
      </SidebarPlaces>
      <View style={styles.grow} />
      <Pressable
        ref={personRef}
        onPress={onPerson}
        style={({ pressed }) => [styles.person, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`${who}, ${role}`}
        testID="inside.side.person"
      >
        <View
          style={styles.face}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Initials name={who} size={12} weight="bold" style={styles.faceInk} />
        </View>
        <View style={styles.grow}>
          <Text size={14} weight="semibold" accessible={false}>
            {who}
          </Text>
          <Text size={12} weight="medium" accessible={false} style={styles.secondary}>
            {role}
          </Text>
        </View>
        <Glyph name="updown" size={15} ink={tokens.colorInkSecondary} />
      </Pressable>
    </SidebarColumn>
  );
}

function Overview({
  code,
  role,
  who,
  locale,
  you,
  onPeople,
  onSignOut,
  tell,
}: {
  code: Redeemable;
  role: CodeRole;
  who: string;
  locale: string;
  /** Signed in as and Sign out at the foot; on its side the person button holds them. */
  you: boolean;
  onPeople: () => void;
  onSignOut: () => void;
  tell: (words: string) => void;
}) {
  const until = atWords(endMoment({ kind: 'event' }), locale, ON_THE_DAY.date);
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
      {you && <You who={who} onSignOut={onSignOut} />}
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
  title,
  areas,
  onClose,
  onArea,
  onAccount,
  onSignOut,
}: {
  open: boolean;
  opener: RefObject<ViewInstance | null>;
  who: string;
  title: string;
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
            {title}
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
  chrome: { flex: 1, flexDirection: 'row', backgroundColor: tokens.colorNeutralFill },
  main: {
    flex: 1,
    marginRight: tokens.spaceMd,
    borderRadius: tokens.space3xl,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
    overflow: 'hidden',
  },
  pane: { paddingTop: 26, paddingHorizontal: 30, paddingBottom: tokens.space6xl, gap: 18 },
  logo: { height: 30, justifyContent: 'center', paddingHorizontal: tokens.spaceMd },
  sideCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    padding: tokens.spaceMd,
    borderRadius: tokens.spaceXl,
    backgroundColor: tokens.colorCard,
  },
  face: {
    width: tokens.space5xl,
    height: tokens.space5xl,
    borderRadius: tokens.spaceXl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorAccentTint,
  },
  faceInk: { color: tokens.colorAccentText },
  person: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingHorizontal: tokens.spaceSm,
  },
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
