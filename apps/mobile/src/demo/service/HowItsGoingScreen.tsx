import { router, useLocalSearchParams } from 'expo-router';
import { type RefObject, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton, SecondaryButton } from '../../components/Buttons.tsx';
import { useReadOut } from '../../components/ReadOut.tsx';
import { Sheet } from '../../components/Sheet.tsx';
import { Text } from '../../components/Text.tsx';
import { DemoOnly } from '../../steps/Lines.tsx';
import { useLayout } from '../../layout/useLayout.ts';
import { tokens } from '../../theme/tokens.ts';
import { goBack } from '../DemoScreen.tsx';
import { FlagLine, Glyph } from '../queue/QueueParts.tsx';
import {
  type Alert,
  EVENT,
  type KitchenItem,
  type Section,
  type ServiceState,
  type Summary,
  buttonOf,
  candidates,
  closeGive,
  giveLine,
  giveTo,
  lineKind,
  nobodyElse,
  openGive,
  pause,
  people,
  sectionName,
  seed,
  serviceStateOf,
  shownSummary,
  waiterLine,
  waitersOn,
} from './HowItsGoingModel.ts';
import {
  ALERT_ICON,
  Chip,
  type CountKey,
  CountShape,
  Hatch,
  Initials,
  PATHS,
  Strip,
  TabBar,
  type TabId,
  TextAction,
  shared,
} from './HowItsGoingParts.tsx';
import {
  type Can,
  type RunOut,
  ITEM,
  alertOf,
  answer,
  askedNow,
  lateArrival,
  options,
  openPanel,
  waitingWords,
} from './RunOutModel.ts';
import { Refusal, RunOutPanel } from './RunOutPanel.tsx';

export function HowItsGoingRoute() {
  const params = useLocalSearchParams<{ state?: string }>();
  const state = serviceStateOf(params.state);

  return <ServiceLead key={state} start={state} />;
}

const TEAM_PLACE: Partial<Record<Alert['kind'], string>> = {
  nobody: 'Section C',
  station: 'the Fryer',
  heldUp: 'the Grill',
};

function ServiceLead({ start }: { start: ReturnType<typeof serviceStateOf> }) {
  const insets = useSafeAreaInsets();
  const wide = useLayout().kind === 'tabletLandscape';
  const [s, setS] = useState<ServiceState>(() => seed(start));
  const [said, setSaid] = useState(0);
  const [tab, setTab] = useState<TabId>(() => (seed(start).manage ? 'service' : 'next'));
  const [note, setNote] = useState<{ id: string; words: string } | null>(null);
  const opener = useRef<ViewInstance | null>(null);
  const runOpener = useRef<ViewInstance | null>(null);
  const can: Can = { online: s.online, manage: s.manage };

  useReadOut(said === 0 || s.say === '' ? null : s.say, { answer: said });

  function apply(next: ServiceState): void {
    setS(next);
    setSaid((n) => n + 1);
  }

  function applyRunOut(next: RunOut): void {
    apply({ ...s, runOut: next, say: next.say });
  }

  function choose(ref: ViewInstance | null): void {
    if (s.runOut == null) return;
    runOpener.current = ref;
    applyRunOut(openPanel(s.runOut, can));
  }

  const tabs: TabId[] = s.manage
    ? ['next', 'floor', 'service', ...(s.teamLanded ? (['team'] as const) : [])]
    : ['next', 'floor'];
  const shown = tabs.includes(tab) ? tab : (tabs[0] ?? 'next');

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.body}>
        <Pressable
          onPress={goBack}
          accessibilityRole="button"
          style={styles.back}
          testID="service.back"
        >
          <Text size={15} weight="semibold" style={shared.accent}>
            Back
          </Text>
        </Pressable>
        <View style={styles.header}>
          <Text size={30} weight="bold" accessibilityRole="header">
            {shown === 'service'
              ? 'Service'
              : shown === 'next'
                ? 'Next'
                : shown === 'floor'
                  ? 'Floor'
                  : 'Team'}
          </Text>
          <Text size={15} weight="medium" style={shared.secondary}>
            {s.started ? `Mains · ${EVENT}` : EVENT}
          </Text>
          <Strip online={s.online} refused={s.give == null ? s.refused : ''} />
          {s.runOut != null && !s.runOut.panel && (
            <Refusal words={s.runOut.refused} offline={!s.online} />
          )}
        </View>
        {shown === 'service' ? (
          s.started ? (
            <Blocks
              s={s}
              apply={apply}
              note={note}
              setNote={setNote}
              opener={opener}
              wide={wide}
              onChoose={choose}
            />
          ) : (
            <View style={shared.card}>
              <Text size={20} weight="bold" accessibilityRole="header">
                Service hasn’t started
              </Text>
              <PrimaryButton
                label="Start service"
                onPress={() => setNote({ id: 'start', words: 'Starting service is sc-4009’s.' })}
                testID="service.start"
              />
              {note?.id === 'start' && (
                <Text size={14} style={shared.secondary}>
                  {note.words}
                </Text>
              )}
            </View>
          )
        ) : (
          <View style={shared.card}>
            <Text size={15} style={shared.secondary}>
              {shown === 'next'
                ? 'Next is the waiter’s own screen (sc-1361), unchanged here.'
                : shown === 'floor'
                  ? 'Floor is the waiter’s tables (sc-4021), unchanged here.'
                  : 'Team moves people between sections and stations (sc-36034).'}
            </Text>
          </View>
        )}
        <DemoOnly title="Demo only: the board’s switches">
          <SecondaryButton
            label="Start again"
            onPress={() => {
              setS(seed(start));
              setNote(null);
            }}
            testID="service.demo.reset"
          />
          <SecondaryButton
            label={s.online ? 'Go offline' : 'Back online'}
            onPress={() =>
              setS({
                ...s,
                online: !s.online,
                refused: '',
                runOut: s.runOut == null ? null : { ...s.runOut, refused: '' },
              })
            }
            testID="service.demo.online"
          />
          <SecondaryButton
            label={s.teamLanded ? 'Before sc-36034 lands' : 'After sc-36034 lands'}
            onPress={() => setS({ ...s, teamLanded: !s.teamLanded })}
            testID="service.demo.team"
          />
          <SecondaryButton
            label={s.manage ? 'View without service.manage' : 'View with service.manage'}
            onPress={() => {
              setS({ ...s, manage: !s.manage });
              setTab(s.manage ? 'next' : 'service');
            }}
            testID="service.demo.manage"
          />
          {s.runOut?.runOut === true && (
            <SecondaryButton
              label="A guest arrives late and starts waiting"
              onPress={() => {
                if (s.runOut != null) applyRunOut(lateArrival(s.runOut));
              }}
              testID="service.demo.late"
            />
          )}
          {s.runOut != null && <AnswerSwitch r={s.runOut} apply={applyRunOut} />}
        </DemoOnly>
      </ScrollView>
      <TabBar
        tabs={tabs}
        current={shown}
        onPick={setTab}
        bottom={Math.max(insets.bottom, tokens.spaceSm)}
      />
      <GiveSheet s={s} apply={apply} opener={opener} setNote={setNote} />
      <RunOutPanel r={s.runOut} can={can} onChange={applyRunOut} opener={runOpener} />
    </View>
  );
}

type Note = { id: string; words: string } | null;

function Blocks({
  s,
  apply,
  note,
  setNote,
  opener,
  wide,
  onChoose,
}: {
  s: ServiceState;
  apply: (next: ServiceState) => void;
  note: Note;
  setNote: (n: Note) => void;
  opener: RefObject<ViewInstance | null>;
  wide: boolean;
  onChoose: (ref: ViewInstance | null) => void;
}) {
  const sum = shownSummary(s);
  const runAlert = s.runOut == null ? null : alertOf(s.runOut);
  const course = <CourseBlock sum={sum} wide={wide} />;
  const sections = (
    <View style={shared.card}>
      <Text size={20} weight="bold" accessibilityRole="header">
        Sections
      </Text>
      <Text size={14} style={shared.secondary}>
        Nobody on it first, then the most left each.
      </Text>
      {sum.sections.map((sec, i) => (
        <SectionRow key={sec.id} s={s} sec={sec} first={i === 0} apply={apply} />
      ))}
    </View>
  );
  const kitchen = (
    <View style={shared.card}>
      <Text size={20} weight="bold" accessibilityRole="header">
        The kitchen
      </Text>
      <Text size={14} style={shared.secondary}>
        Each item as its station last marked it.
      </Text>
      {sum.kitchen.map((k, i) =>
        k.state === 'Run out' ? (
          <RunOutKitchenRow
            key={k.item}
            k={k}
            first={i === 0}
            onPress={s.manage && k.course == null ? onChoose : null}
          />
        ) : (
          <KitchenRow key={k.item} k={k} first={i === 0} />
        ),
      )}
      {s.manage && sum.kitchen.some((k) => k.state === 'Run out' && k.course != null) && (
        <DemoOnly title="Demo only: an earlier course’s line">
          <Text size={14}>
            In the product this line opens Small chops’s own choice panel, with the Starter’s items,
            as Chicken’s line opens Chicken’s. The demo plays Chicken’s.
          </Text>
        </DemoOnly>
      )}
    </View>
  );
  const alerts = (
    <View style={shared.card}>
      <Text size={20} weight="bold" accessibilityRole="header">
        Alerts
      </Text>
      <Text size={14} style={shared.secondary}>
        Newest first. Each leaves by itself once its cause clears.
      </Text>
      {sum.alerts.length === 0 && runAlert == null && (
        <Text size={15} style={shared.secondary}>
          Nothing needs you.
        </Text>
      )}
      {runAlert != null && (
        <RunOutAlertRow
          title={runAlert.title}
          sub={runAlert.sub}
          count={runAlert.count}
          onChoose={onChoose}
        />
      )}
      {sum.alerts.map((a, i) => (
        <AlertRow
          key={a.id}
          s={s}
          a={a}
          first={i === 0 && runAlert == null}
          note={note?.id === a.id ? note.words : ''}
          onPress={(ref) => {
            const b = buttonOf(s, a);
            if (b === 'Give to…') {
              opener.current = ref;
              apply(openGive(s, a.id));
            } else if (b === 'Go to table' && a.kind === 'request') {
              router.push('/demo/requests?state=alert');
            } else if (b === 'Go to table') {
              setNote({ id: a.id, words: `Opens ${a.table} on Floor (sc-4021).` });
            } else {
              setNote({
                id: a.id,
                words: `Opens Team on ${TEAM_PLACE[a.kind] ?? 'the place it names'} (sc-36034).`,
              });
            }
          }}
        />
      ))}
    </View>
  );
  const earlier = (
    <View style={shared.card}>
      <Text size={20} weight="bold" accessibilityRole="header">
        Earlier courses
      </Text>
      {sum.earlier.map((e, i) => (
        <View key={e.course} style={[styles.earlier, i > 0 && shared.sep]}>
          <Glyph paths={PATHS.check} ink={tokens.colorInkSecondary} side={16} />
          <Text size={15} weight="medium" style={shared.grow}>
            {`${e.course} · ${e.served} of ${e.due} served · ${e.minutes} min`}
          </Text>
        </View>
      ))}
    </View>
  );

  if (!wide)
    return (
      <>
        {course}
        {sections}
        {kitchen}
        {alerts}
        {earlier}
      </>
    );
  return (
    <View style={styles.grid}>
      {course}
      <View style={styles.columns}>
        {/* Not collapsable, so VoiceOver reads the left column, then the right, whatever the cards' heights. */}
        <View style={styles.column} collapsable={false}>
          {sections}
          {earlier}
        </View>
        <View style={styles.column} collapsable={false}>
          {kitchen}
          {alerts}
        </View>
      </View>
    </View>
  );
}

const COUNTS: readonly { key: CountKey; word: string }[] = [
  { key: 'choice', word: 'Waiting for a choice' },
  { key: 'onTray', word: 'On a tray' },
  { key: 'kitchen', word: 'Waiting on the kitchen' },
  { key: 'toServe', word: 'To serve' },
  { key: 'served', word: 'Served' },
];

const BAR_PART = {
  choice: { backgroundColor: tokens.colorInk },
  served: { backgroundColor: tokens.colorAccent },
  onTray: { backgroundColor: tokens.colorAccentTintBorder },
  kitchen: { backgroundColor: tokens.colorTrack },
  toServe: { backgroundColor: tokens.colorTrack },
} as const;

function CourseBlock({ sum, wide }: { sum: Summary; wide: boolean }) {
  const c = sum.course;
  const counts = COUNTS.filter((k) => k.key !== 'choice' || c.choice > 0);
  return (
    <View style={shared.card}>
      <Text size={13} weight="semibold" style={styles.kicker}>
        NOW · {c.name.toUpperCase()}
      </Text>
      <Text size={24} weight="bold" accessibilityRole="header">
        {`${c.served} of ${c.due} guests have had ${c.name}`}
      </Text>
      <View
        style={styles.bar}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {[...counts]
          .reverse()
          .filter((k) => c[k.key] > 0)
          .map((k) => (
            <View key={k.key} style={[styles.barPart, BAR_PART[k.key], { flex: c[k.key] }]}>
              {k.key === 'kitchen' && <Hatch />}
            </View>
          ))}
      </View>
      <View style={wide && styles.countsWide}>
        {counts.map((k, i) => (
          <View
            key={k.key}
            accessible
            accessibilityLabel={`${k.word}, ${c[k.key]}`}
            style={wide ? styles.countTile : [styles.countRow, i > 0 && shared.sep]}
          >
            <CountShape kind={k.key} />
            <Text size={16} weight="semibold" style={shared.grow}>
              {k.word}
            </Text>
            <Text size={20} weight="bold" style={styles.number}>
              {String(c[k.key])}
            </Text>
          </View>
        ))}
      </View>
      <View accessible accessibilityLabel={`Not here yet, ${c.notHere}`} style={styles.notHere}>
        <Glyph paths={PATHS.person} ink={tokens.colorInkSecondary} side={16} />
        <Text size={15} weight="semibold" style={shared.grow}>
          Not here yet
        </Text>
        <Text size={18} weight="bold" style={styles.number}>
          {String(c.notHere)}
        </Text>
      </View>
    </View>
  );
}

function SectionRow({
  s,
  sec,
  first,
  apply,
}: {
  s: ServiceState;
  sec: Section;
  first: boolean;
  apply: (next: ServiceState) => void;
}) {
  const ws = waitersOn(s.summary, sec.id);
  return (
    <View style={[styles.section, !first && shared.sep]} testID={`service.section.${sec.id}`}>
      <Text size={16} weight="semibold">
        {`${sec.name} · ${people(sec.people)}`}
      </Text>
      <View style={shared.wrap}>
        {sec.people === 0 && <Chip word="Nobody on it" paths={PATHS.nobody} />}
        {sec.behind && <Chip word="Behind" paths={PATHS.behind} />}
        <Text size={14} weight="medium" style={[shared.secondary, styles.number]}>
          {`${sec.served} of ${sec.due}`}
        </Text>
        {sec.people > 0 && (
          <Text size={14} weight="semibold" style={styles.number}>
            {` · ${sec.leftEach} left each`}
          </Text>
        )}
      </View>
      {ws.map((w) => {
        const kind = lineKind(w);
        return (
          <View key={w.name} style={styles.waiter}>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Initials name={w.name} />
            </View>
            <View style={[shared.grow, styles.waiterText]}>
              <Text size={14} weight="medium">
                {waiterLine(w)}
              </Text>
              {(w.asWell === sec.id || kind === 'paused') && (
                <View style={shared.wrap}>
                  {w.asWell === sec.id && <Chip word="As well" paths={PATHS.given} />}
                  {kind === 'paused' && <Chip word="Paused" paths={PATHS.pause} tone="paused" />}
                </View>
              )}
              {kind === 'started' && (
                <TextAction
                  label="Pause the tray"
                  accessibilityLabel={`Pause ${w.name}’s tray for ${w.tray?.table ?? ''}`}
                  paths={PATHS.pause}
                  onPress={() => apply(pause(s, w.name))}
                  testID={`service.pause.${sec.id}.${w.name}`}
                />
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function KitchenRow({ k, first }: { k: KitchenItem; first: boolean }) {
  if (k.station == null)
    return (
      <View style={[styles.kitchen, !first && shared.sep]}>
        <Text size={13} weight="semibold" style={styles.kicker}>
          NO STATION
        </Text>
        <Text size={16} weight="semibold">
          {k.item}
        </Text>
      </View>
    );
  const who = k.people === '' ? `Nobody on ${k.station}` : k.people;
  return (
    <View style={[styles.kitchen, !first && shared.sep]}>
      <View style={styles.kitchenHead}>
        {k.people === '' && <Glyph paths={PATHS.nobody} ink={tokens.colorInk} side={16} />}
        <Text size={16} weight="semibold" style={shared.grow}>
          {`${k.item} · ${k.station} · ${who}`}
        </Text>
      </View>
      <View style={shared.wrap}>
        {k.state === 'Ready' && <Chip word="Ready" paths={PATHS.diamond} tone="accent" />}
        {k.state === 'Preparing' && <Chip word="Preparing" paths={PATHS.clock} circle />}
        {k.heldUpMin != null && (
          <Chip word={`Held up · ${k.heldUpMin} min`} paths={PATHS.hourglass} tone="outline" />
        )}
      </View>
      {k.readyIn != null && (
        <Text size={14} weight="medium">
          {`Ready in about ${k.readyIn} min`}
        </Text>
      )}
      {k.waiting > 0 && (
        <Text size={14} style={shared.secondary}>
          {`${k.waiting} waiting`}
        </Text>
      )}
    </View>
  );
}

function RunOutKitchenRow({
  k,
  first,
  onPress,
}: {
  k: KitchenItem;
  first: boolean;
  onPress: ((ref: ViewInstance | null) => void) | null;
}) {
  const ref = useRef<ViewInstance | null>(null);
  const line = `${k.course == null ? '' : `${k.course} · `}${k.item} · ${k.station ?? ''} · Run out`;
  const sub = k.waiting > 0 ? waitingWords(k.waiting) : '';
  const words = (
    <>
      <View style={[shared.grow, styles.waiterText]}>
        <View style={styles.kitchenHead}>
          <Glyph paths={PATHS.ban} ink={tokens.colorInk} side={16} circle />
          <Text size={16} weight="semibold" style={shared.grow}>
            {line}
          </Text>
        </View>
        {sub !== '' && (
          <Text size={14} weight="medium">
            {sub}
          </Text>
        )}
      </View>
      {onPress != null && <Glyph paths={PATHS.given} ink={tokens.colorAccentText} side={18} />}
    </>
  );
  if (onPress == null)
    return <View style={[styles.runOutKitchen, !first && shared.sep]}>{words}</View>;
  return (
    <Pressable
      ref={ref}
      onPress={() => onPress(ref.current)}
      accessibilityRole="button"
      accessibilityLabel={sub === '' ? line : `${line}, ${sub}`}
      style={({ pressed }) => [
        styles.runOutKitchen,
        !first && shared.sep,
        pressed && styles.pressed,
      ]}
      testID="service.kitchen.runOut"
    >
      {words}
    </Pressable>
  );
}

function RunOutAlertRow({
  title,
  sub,
  count,
  onChoose,
}: {
  title: string;
  sub: string;
  count: string;
  onChoose: (ref: ViewInstance | null) => void;
}) {
  const ref = useRef<ViewInstance | null>(null);
  return (
    <View style={styles.alert} testID="service.alert.runOut">
      <View style={styles.alertHead}>
        <View style={styles.alertIcon}>
          <Glyph paths={PATHS.ban} circle ink={tokens.colorInk} side={18} />
        </View>
        <View style={[shared.grow, styles.waiterText]}>
          <Text size={16} weight="semibold">
            {title}
          </Text>
          <Text size={14} style={shared.secondary}>
            {sub}
          </Text>
          {count !== '' && (
            <Text size={14} weight="semibold" testID="service.alert.runOut.count">
              {count}
            </Text>
          )}
        </View>
      </View>
      <PrimaryButton
        label="Choose"
        accessibilityLabel={`Choose what guests get instead of ${ITEM}`}
        ref={ref}
        onPress={() => onChoose(ref.current)}
        testID="service.choose"
      />
    </View>
  );
}

function AlertRow({
  s,
  a,
  first,
  note,
  onPress,
}: {
  s: ServiceState;
  a: Alert;
  first: boolean;
  note: string;
  onPress: (ref: ViewInstance | null) => void;
}) {
  const ref = useRef<ViewInstance | null>(null);
  const b = buttonOf(s, a);
  const icon = ALERT_ICON[a.kind];
  return (
    <View style={[styles.alert, !first && shared.sep]} testID={`service.alert.${a.id}`}>
      <View style={styles.alertHead}>
        <View style={styles.alertIcon}>
          <Glyph paths={icon.paths} circle={icon.circle} ink={tokens.colorInk} side={18} />
        </View>
        <View style={[shared.grow, styles.waiterText]}>
          <Text size={16} weight="semibold">
            {a.title}
          </Text>
          <Text size={14} style={shared.secondary}>
            {a.sub}
          </Text>
          {a.flag !== '' && <FlagLine flag={a.flag} />}
        </View>
      </View>
      {b === 'Give to…' ? (
        <PrimaryButton
          label="Give to…"
          ref={ref}
          onPress={() => onPress(ref.current)}
          testID={`service.give.${a.id}`}
        />
      ) : b != null ? (
        <SecondaryButton
          label={b}
          onPress={() => onPress(ref.current)}
          testID={`service.act.${a.id}`}
        />
      ) : null}
      {note !== '' && (
        <Text size={14} style={shared.secondary}>
          {note}
        </Text>
      )}
    </View>
  );
}

function GiveSheet({
  s,
  apply,
  opener,
  setNote,
}: {
  s: ServiceState;
  apply: (next: ServiceState) => void;
  opener: RefObject<ViewInstance | null>;
  setNote: (n: Note) => void;
}) {
  const g = s.give;
  const list = g == null ? [] : candidates(s.summary, g);
  const section = g == null ? '' : sectionName(s.summary, g.section);
  const [teamNote, setTeamNote] = useState('');
  return (
    <Sheet
      open={g != null}
      onClose={() => apply(closeGive(s))}
      scrimLabel="Close Give to…"
      opener={opener}
      testID="service.giveSheet"
    >
      {g != null && (
        <View style={styles.sheet}>
          <Text size={22} weight="bold" accessibilityRole="header">
            {`Give ${g.table}’s tray to…`}
          </Text>
          <Text size={15} weight="medium" style={shared.secondary}>
            {giveLine(s.summary, g)}
          </Text>
          {s.refused !== '' && (
            <View accessibilityRole="alert" style={styles.refused}>
              <Text size={15} weight="semibold">
                {s.refused}
              </Text>
            </View>
          )}
          {list.length === 0 ? (
            <View style={styles.nobody}>
              <Text size={16} weight="semibold">
                {nobodyElse(section)}
              </Text>
              <SecondaryButton
                label="Team"
                onPress={() => setTeamNote(`Opens Team on ${section} (sc-36034).`)}
                testID="service.give.team"
              />
              {teamNote !== '' && (
                <Text size={14} style={shared.secondary}>
                  {teamNote}
                </Text>
              )}
            </View>
          ) : (
            list.map((c, i) => (
              <Pressable
                key={c.name}
                onPress={() => {
                  apply(giveTo(s, c.name));
                  setNote(null);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Give to ${c.name}${c.asWell ? ', as well' : ''}. ${c.inHand}`}
                style={({ pressed }) => [
                  styles.candidate,
                  i > 0 && shared.sep,
                  pressed && styles.pressed,
                ]}
                testID={`service.give.to.${c.name}`}
              >
                <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  <Initials name={c.name} />
                </View>
                <View style={[shared.grow, styles.waiterText]}>
                  <View style={shared.wrap}>
                    <Text size={16} weight="semibold">
                      {c.name}
                    </Text>
                    {c.asWell && <Chip word="As well" paths={PATHS.given} />}
                  </View>
                  <Text size={14} style={shared.secondary}>
                    {c.inHand}
                  </Text>
                </View>
                <Glyph paths={PATHS.given} ink={tokens.colorAccentText} side={18} />
              </Pressable>
            ))
          )}
          <SecondaryButton
            label="Cancel"
            onPress={() => apply(closeGive(s))}
            testID="service.give.cancel"
          />
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colorPage },
  body: { padding: tokens.spaceLg, gap: tokens.spaceMd, paddingBottom: tokens.spaceXl },
  back: { minHeight: tokens.sizeHit, justifyContent: 'center', alignSelf: 'flex-start' },
  header: { gap: tokens.spaceXs },
  kicker: { color: tokens.colorInkSecondary, letterSpacing: 0.6 },
  number: { fontVariant: ['tabular-nums'] },
  bar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', gap: 2 },
  barPart: { minWidth: 4, overflow: 'hidden' },
  kitchen: { gap: 4, paddingVertical: 10 },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceMd, minHeight: 48 },
  countsWide: { flexDirection: 'row', gap: tokens.spaceSm },
  countTile: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spaceSm,
    padding: tokens.spaceMd,
    borderRadius: 12,
    backgroundColor: tokens.colorInset,
  },
  grid: { gap: tokens.spaceMd },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceMd },
  column: { flex: 1, minWidth: 0, gap: tokens.spaceMd },
  notHere: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    minHeight: 48,
    paddingHorizontal: tokens.spaceMd,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: tokens.colorControlBorder,
  },
  section: { gap: 6, paddingVertical: 10 },
  waiter: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: 4 },
  waiterText: { gap: 3 },
  kitchenHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  alert: { gap: tokens.spaceSm, paddingVertical: tokens.spaceMd },
  alertHead: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceMd },
  alertIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tokens.colorInset,
    alignItems: 'center',
    justifyContent: 'center',
  },
  earlier: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  sheet: { gap: tokens.spaceSm, paddingBottom: tokens.spaceLg },
  refused: { padding: tokens.spaceMd, borderRadius: 12, backgroundColor: tokens.colorInset },
  nobody: { gap: tokens.spaceSm, paddingVertical: tokens.spaceSm },
  candidate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    minHeight: 64,
    paddingVertical: 10,
  },
  pressed: { opacity: tokens.opacityPressed },
  runOutKitchen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    minHeight: tokens.sizeHitPhonePrimary,
    paddingVertical: 10,
  },
});

function AnswerSwitch({ r, apply }: { r: RunOut; apply: (next: RunOut) => void }) {
  const g = askedNow(r).sort((a, b) => a.table - b.table || a.seat - b.seat)[0];
  const o = g == null ? undefined : options(g).find((x) => x.no == null);
  if (g == null || o == null) return null;
  return (
    <SecondaryButton
      label={`At table ${g.table}, ${g.name} answers ${o.label}`}
      onPress={() => apply(answer(r, g.id, o.item))}
      testID="service.demo.answer"
    />
  );
}
