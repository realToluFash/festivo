import { useLocalSearchParams } from 'expo-router';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton, QuietButton, SecondaryButton } from '../../components/Buttons.tsx';
import type { GlyphName } from '../../components/Glyph.tsx';
import { readOut } from '../../components/ReadOut.tsx';
import { SETTLED_MS } from '../../components/Screen.tsx';
import { Sheet } from '../../components/Sheet.tsx';
import { PageToast } from '../../components/Summary.tsx';
import { Text } from '../../components/Text.tsx';
import { PHONE_TAB_BAR, TabBar, TabBarFade, tabBarFoot } from '../../components/TodayCover.tsx';
import { moveScreenReaderFocus } from '../../components/screenReaderFocus.ts';
import { useLayout } from '../../layout/useLayout.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { goBack } from '../DemoScreen.tsx';
import { Glyph } from '../queue/QueueParts.tsx';
import {
  CHOOSE_LINE,
  EMPTY_LINE,
  NEED_LINE,
  NOW,
  PLACES,
  type PlaceKind,
  RIVAL,
  type TeamState,
  andList,
  candidateLine,
  candidates,
  choiceFor,
  choose,
  chooseMode,
  closeSheet,
  dismiss,
  emptied,
  goOnline,
  leavesLine,
  move,
  nameOf,
  onPlace,
  openSheet,
  peopleCount,
  personOf,
  primaryLabel,
  seed,
  stationText,
  stationsOf,
  teamStateOf,
  tryOffline,
} from './TeamModel.ts';
import { Disc, ModeChoice, MoveButton, OFFLINE_GLYPH, WarnLine } from './TeamParts.tsx';

export function TeamRoute() {
  const params = useLocalSearchParams<{ state?: string }>();
  const state = teamStateOf(params.state);

  return <Team key={state} start={state} />;
}

const GROUPS: readonly { title: string; kind: PlaceKind }[] = [
  { title: 'Sections', kind: 'section' },
  { title: 'Kitchen', kind: 'kitchen' },
];

function Team({ start }: { start: ReturnType<typeof teamStateOf> }) {
  const { kind } = useLayout();
  const insets = useSafeAreaInsets();
  const [s, setS] = useState<TeamState>(() => seed(start));
  const [said, setSaid] = useState(0);
  const movers = useRef(new Map<string, ViewInstance>());
  const opener = useRef<ViewInstance | null>(null);
  const phone = kind === 'phone';
  const docked = kind === 'tabletLandscape';
  const side = phone ? tokens.sizeHitPhonePrimary : tokens.sizeHit;
  const foot = tabBarFoot(insets.bottom);

  function apply(next: TeamState): void {
    if (next.sheet != null) opener.current = movers.current.get(`row|${next.sheet.place}`) ?? null;
    setS(next);
    setSaid((n) => n + 1);
  }

  useEffect(() => {
    if (said === 0 && s.focus == null) return;
    const unsay = s.say === '' ? () => {} : readOut(s.say);
    const focus = s.focus;
    const later =
      focus == null
        ? undefined
        : setTimeout(() => moveScreenReaderFocus(movers.current.get(focus) ?? null), SETTLED_MS);
    return () => {
      unsay();
      clearTimeout(later);
    };
  }, [said, s.say, s.focus]);

  const panel =
    s.sheet == null ? null : <MovePanel s={s} apply={apply} side={side} phone={phone} />;

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[
          styles.body,
          phone && styles.bodyPhone,
          phone && { paddingBottom: foot + PHONE_TAB_BAR + tokens.space6xl * 2 },
        ]}
      >
        <Pressable
          onPress={goBack}
          accessibilityRole="button"
          style={styles.back}
          testID="team.back"
        >
          <Text size={15} weight="semibold" style={styles.accent}>
            Back
          </Text>
        </Pressable>
        <Header s={s} />
        {!phone && <Tabs manage={s.manage} side={side} />}
        {!s.manage ? (
          <Text size={15} style={styles.secondary}>
            Without service.manage there is no Team tab: Next, Floor and Service only.
          </Text>
        ) : s.empty ? (
          <Text size={16} weight="medium" testID="team.empty">
            {EMPTY_LINE}
          </Text>
        ) : (
          <View style={docked ? styles.side : undefined}>
            <View style={docked ? styles.sideList : styles.list}>
              {s.notice?.kind === 'conflict' && (
                <View accessibilityRole="alert" style={styles.alert} testID="team.conflict">
                  <Text size={16} weight="bold">
                    {s.notice.who} wasn’t moved
                  </Text>
                  <Text size={15}>
                    {s.notice.by} has just put {s.notice.who} on {nameOf(s.notice.to)}. Team shows
                    where they are now.
                  </Text>
                  <QuietButton
                    label="Got it"
                    onPress={() => apply(dismiss(s))}
                    testID="team.gotIt"
                  />
                </View>
              )}
              {GROUPS.map((group) => (
                <View key={group.kind} style={styles.group}>
                  <Text
                    size={13}
                    weight="semibold"
                    style={styles.kicker}
                    accessibilityRole="header"
                  >
                    {group.title.toUpperCase()}
                  </Text>
                  <View style={styles.card}>
                    {PLACES.filter((p) => p.kind === group.kind).map((p, i) => (
                      <PlaceRow
                        key={p.id}
                        s={s}
                        id={p.id}
                        first={i === 0}
                        side={side}
                        phone={phone}
                        movers={movers}
                        apply={apply}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </View>
            {docked && <View style={styles.sidePanel}>{panel}</View>}
          </View>
        )}
        <DemoOnly title="Demo only: the board’s switches">
          <SecondaryButton
            label="Start again"
            onPress={() => setS(seed(start))}
            testID="team.demo.reset"
          />
          <SecondaryButton
            label={s.online ? 'Lose the connection' : 'Come back online'}
            onPress={() => apply(goOnline(s, !s.online))}
            testID="team.demo.online"
          />
          <SecondaryButton
            label={
              s.rival ? `${RIVAL} moves Grace Udo first · on` : 'Another lead moves Grace Udo first'
            }
            onPress={() => setS({ ...s, rival: !s.rival })}
            testID="team.demo.rival"
          />
          <SecondaryButton
            label={s.manage ? 'View without service.manage' : 'View with service.manage'}
            onPress={() => setS({ ...s, manage: !s.manage, sheet: null })}
            testID="team.demo.manage"
          />
          <SecondaryButton
            label={s.empty ? 'Give the event its places' : 'An event with no places'}
            onPress={() => setS({ ...s, empty: !s.empty, sheet: null })}
            testID="team.demo.empty"
          />
        </DemoOnly>
      </ScrollView>
      {phone && (
        <>
          <TabBarFade />
          <TabBar
            tabs={tabsOf(s.manage)}
            bottom={foot}
            at={s.manage ? 'Team' : 'Service'}
            onTab={() => {}}
            ids={TAB_IDS}
          />
        </>
      )}
      {!docked && (
        <Sheet
          open={s.sheet != null}
          onClose={() => apply(closeSheet(s))}
          scrimLabel="Close Move someone"
          opener={opener}
          testID="team.sheet"
        >
          {panel}
        </Sheet>
      )}
      {s.toast !== '' && (
        <PageToast
          words={s.toast}
          onClose={() => setS({ ...s, toast: '' })}
          bottom={
            phone
              ? foot + PHONE_TAB_BAR + tokens.spaceXl + tokens.spaceHair
              : insets.bottom + tokens.spaceXl
          }
        />
      )}
    </View>
  );
}

function Header({ s }: { s: TeamState }) {
  const offline = !s.online;

  return (
    <View style={styles.header}>
      <Text size={30} weight="bold" accessibilityRole="header">
        {s.manage ? 'Team' : 'Service'}
      </Text>
      <Text size={15} weight="medium" style={styles.secondary}>
        {s.manage && !s.empty
          ? `Mains · ${PLACES.length} places · ${peopleCount(s)} people on them`
          : 'Mains'}
      </Text>
      <View style={styles.status}>
        {offline ? (
          <Glyph paths={OFFLINE_GLYPH} ink={tokens.colorInkSecondary} side={15} />
        ) : (
          <View style={styles.dot} />
        )}
        <Text size={14} weight="medium" style={styles.secondary}>
          {offline ? `No connection · as of ${NOW}` : `Connected · up to date ${NOW}`}
        </Text>
      </View>
    </View>
  );
}

type ServiceTab = 'Next' | 'Floor' | 'Service' | 'Team';

const SERVICE_TABS: readonly (readonly [ServiceTab, GlyphName])[] = [
  ['Next', 'arrow'],
  ['Floor', 'seating'],
  ['Service', 'overview'],
  ['Team', 'people'],
];

const TAB_IDS: Record<ServiceTab, string> = {
  Next: 'team.tab.next',
  Floor: 'team.tab.floor',
  Service: 'team.tab.service',
  Team: 'team.tab.team',
};

/** Without service.manage there is no Team tab. */
function tabsOf(manage: boolean): readonly (readonly [ServiceTab, GlyphName])[] {
  return manage ? SERVICE_TABS : SERVICE_TABS.filter(([t]) => t !== 'Team');
}

/** Tablet's tab row, a segmented row under the header; the phone has the bottom tab bar. */
function Tabs({ manage, side }: { manage: boolean; side: number }) {
  const tabs = tabsOf(manage).map(([t]) => t);
  const current = manage ? 'Team' : 'Service';

  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {tabs.map((t) => (
        <View
          key={t}
          accessibilityRole="tab"
          accessibilityState={{ selected: t === current }}
          style={[styles.tab, { minHeight: side - 4 }, t === current && styles.tabOn]}
        >
          <Text
            size={15}
            weight={t === current ? 'semibold' : 'medium'}
            style={t === current ? styles.accent : styles.secondary}
          >
            {t}
          </Text>
        </View>
      ))}
    </View>
  );
}

function PlaceRow({
  s,
  id,
  first,
  side,
  phone,
  movers,
  apply,
}: {
  s: TeamState;
  id: string;
  first: boolean;
  side: number;
  phone: boolean;
  movers: RefObject<Map<string, ViewInstance>>;
  apply: (next: TeamState) => void;
}) {
  const name = nameOf(id);
  const on = onPlace(s, id);
  const offline = !s.online;
  const need = offline && s.notice?.kind === 'need' && s.notice.place === id;
  const key = `row|${id}`;

  return (
    <View
      style={[
        styles.row,
        !first && styles.rowSep,
        phone && styles.rowPhone,
        (s.opened === id || s.sheet?.place === id) && styles.rowOpen,
      ]}
      testID={`team.place.${id}`}
    >
      <View
        style={styles.grow}
        accessible
        accessibilityLabel={`${name}, ${on.length > 0 ? andList(on) : 'nobody on it'}`}
      >
        <Text size={17} weight="bold">
          {name}
        </Text>
        {on.length === 0 ? (
          <Text size={15} style={styles.secondary}>
            Nobody on {name}
          </Text>
        ) : (
          on.map((n) => {
            const also = stationsOf(s, n).filter((x) => x !== id);
            const you = personOf(n)?.you === true;
            return (
              <View key={n} style={styles.person}>
                <Disc name={n} you={you} />
                <View style={styles.grow}>
                  <Text size={15} weight="semibold">
                    {you ? `${n} · you` : n}
                  </Text>
                  {also.length > 0 && (
                    <Text size={14} style={styles.secondary}>
                      also on {stationText(also)}
                    </Text>
                  )}
                </View>
              </View>
            );
          })
        )}
      </View>
      <View style={[styles.moveCell, phone && styles.moveCellPhone]}>
        <MoveButton
          place={name}
          offline={offline}
          side={side}
          ref={(v) => {
            if (v == null) movers.current.delete(key);
            else movers.current.set(key, v);
          }}
          onPress={() => apply(offline ? tryOffline(s, id) : openSheet(s, id))}
          testID={`team.move.${id}`}
        />
        {need && (
          <View style={styles.need} testID={`team.need.${id}`}>
            <Glyph paths={OFFLINE_GLYPH} ink={tokens.colorInkSecondary} side={14} />
            <Text size={14} weight="semibold" style={styles.secondary}>
              {NEED_LINE}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function MovePanel({
  s,
  apply,
  side,
  phone,
}: {
  s: TeamState;
  apply: (next: TeamState) => void;
  side: number;
  phone: boolean;
}) {
  const sheet = s.sheet;
  if (sheet == null) return null;
  const name = nameOf(sheet.place);
  const on = onPlace(s, sheet.place);
  const people = candidates(s, sheet.place);
  const choice = choiceFor(s);
  const refused = sheet.refused && sheet.who === '';
  const put = (
    <PrimaryButton label={primaryLabel(s)} onPress={() => apply(move(s))} testID="team.put" />
  );
  const cancel = (
    <QuietButton label="Cancel" onPress={() => apply(closeSheet(s))} testID="team.cancel" />
  );

  return (
    <View style={[styles.panel, !phone && styles.panelCard]} testID="team.panel">
      <Text size={22} weight="bold" accessibilityRole="header">
        Move someone to {name}
      </Text>
      <Text size={15} style={styles.secondary}>
        {on.length > 0
          ? `${andList(on)} ${on.length > 1 ? 'are' : 'is'} on it now`
          : `Nobody on ${name} now`}
      </Text>
      {people.length === 0 ? (
        <Text size={15}>Nobody in Here can work {name}.</Text>
      ) : (
        <View style={styles.choices} accessibilityRole="radiogroup">
          {people.map((p) => {
            const chosen = sheet.who === p.name;
            const line = candidateLine(s, p);
            const leaves =
              stationsOf(s, p.name).length >= 2
                ? leavesLine(emptied(s, p.name, sheet.place, 'instead'))
                : '';
            return (
              <Pressable
                key={p.name}
                onPress={() => apply(choose(s, p.name))}
                accessibilityRole="radio"
                accessibilityState={{ checked: chosen }}
                accessibilityLabel={`${p.name}, ${line}${leaves === '' ? '' : `. ${leaves}`}`}
                style={[styles.choice, { minHeight: side + 8 }, chosen && styles.choiceOn]}
                testID={`team.who.${p.name}`}
              >
                <Disc name={p.name} you={p.you === true} />
                <View style={styles.grow}>
                  <Text size={16} weight="semibold">
                    {p.name}
                  </Text>
                  <Text size={14} style={styles.secondary}>
                    {line}
                  </Text>
                  {leaves !== '' && <WarnLine words={leaves} />}
                </View>
                <View style={[styles.radio, chosen && styles.radioOn]} />
              </Pressable>
            );
          })}
        </View>
      )}
      {refused && (
        <View accessibilityRole="alert" style={styles.need}>
          <Text size={14} weight="semibold" style={styles.broken}>
            {CHOOSE_LINE}
          </Text>
        </View>
      )}
      {choice != null && (
        <View style={styles.choiceBlock}>
          <Text size={15} weight="semibold">
            {choice.label}
          </Text>
          <ModeChoice
            modes={choice.modes}
            mode={choice.mode}
            side={side}
            onPick={(m) => apply(chooseMode(s, m))}
          />
          <Text size={14} style={styles.secondary}>
            {choice.helper}
          </Text>
          {choice.leaves !== '' && <WarnLine words={choice.leaves} />}
          {choice.tray !== '' && (
            <Text size={14} style={styles.secondary}>
              {choice.tray}
            </Text>
          )}
        </View>
      )}
      {phone ? (
        <View style={styles.stack}>
          {put}
          {cancel}
        </View>
      ) : (
        <View style={styles.pair}>
          {cancel}
          {put}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colorPage },
  body: { padding: tokens.spaceXl, gap: tokens.spaceLg, paddingBottom: 96 },
  bodyPhone: { padding: tokens.spaceLg, paddingBottom: 96 },
  back: { minHeight: tokens.sizeHit, justifyContent: 'center', alignSelf: 'flex-start' },
  accent: { color: tokens.colorAccentText },
  secondary: { color: tokens.colorInkSecondary },
  broken: { color: tokens.colorBrokenText },
  kicker: { color: tokens.colorInkSecondary, letterSpacing: 0.6 },
  header: { gap: tokens.spaceXs },
  status: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.colorAccent },
  tabs: {
    flexDirection: 'row',
    padding: 2,
    gap: 2,
    borderRadius: tokens.radiusPill,
    backgroundColor: tokens.colorInset,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: tokens.radiusPill },
  tabOn: { backgroundColor: tokens.colorCard },
  side: { flexDirection: 'row', gap: tokens.spaceLg, alignItems: 'flex-start' },
  sideList: { flex: 1, minWidth: 0, gap: tokens.spaceLg },
  sidePanel: { width: 420 },
  list: { gap: tokens.spaceLg },
  group: { gap: tokens.spaceSm },
  card: {
    paddingHorizontal: tokens.spaceLg,
    borderRadius: tokens.radiusCardPhone,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
  },
  row: {
    flexDirection: 'row',
    gap: tokens.spaceMd,
    paddingVertical: tokens.spaceLg,
    alignItems: 'flex-start',
  },
  rowPhone: { flexDirection: 'column', alignItems: 'stretch' },
  rowSep: { borderTopWidth: 1, borderTopColor: tokens.colorBorder },
  rowOpen: {
    backgroundColor: tokens.colorAccentTint,
    borderLeftWidth: 3,
    borderLeftColor: tokens.colorAccent,
    paddingHorizontal: tokens.spaceMd,
  },
  grow: { flex: 1, minWidth: 0, gap: 4 },
  person: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm, minHeight: 40 },
  moveCell: { alignItems: 'flex-end', gap: tokens.spaceXs, maxWidth: 260 },
  moveCellPhone: { alignItems: 'stretch', maxWidth: undefined },
  need: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXs },
  alert: {
    padding: tokens.spaceLg,
    gap: tokens.spaceXs,
    borderRadius: tokens.radiusCardPhone,
    backgroundColor: tokens.colorAttentionTint,
    borderWidth: 1,
    borderColor: tokens.colorAttentionBorder,
  },
  panel: { gap: tokens.spaceMd, paddingBottom: tokens.spaceLg },
  panelCard: {
    padding: tokens.spaceXl,
    borderRadius: tokens.radiusCardPhone,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
  },
  choices: { gap: tokens.spaceXs },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    padding: tokens.spaceMd,
    borderRadius: tokens.radiusRow,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
  },
  choiceOn: {
    borderWidth: 2,
    borderColor: tokens.colorAccent,
    backgroundColor: tokens.colorAccentTint,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: tokens.colorControlBorder,
  },
  radioOn: { borderWidth: 7, borderColor: tokens.colorAccent },
  choiceBlock: { gap: tokens.spaceSm },
  stack: { gap: tokens.spaceXs, marginTop: tokens.spaceSm },
  pair: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: tokens.spaceMd,
    marginTop: tokens.spaceSm,
  },
});
