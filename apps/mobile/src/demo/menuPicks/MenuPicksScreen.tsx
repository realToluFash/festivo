import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmberLine } from '../../components/Amber.tsx';
import { PrimaryButton, SecondaryButton } from '../../components/Buttons.tsx';
import { FailureLine } from '../../components/FailureLine.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { Refreshing } from '../../components/Refreshing.tsx';
import { Sheet, SheetActions, SheetScrollView } from '../../components/Sheet.tsx';
import { Skeleton } from '../../components/Skeleton.tsx';
import { Text } from '../../components/Text.tsx';
import { useLayout } from '../../layout/useLayout.ts';
import { Confirmed, DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { goBack } from '../DemoScreen.tsx';
import {
  type Access,
  type Course,
  DOWNLOAD_MS,
  type Download,
  type Draft,
  type DraftCheck,
  EVENT_NAME,
  type MenuStart,
  type MenuWorld,
  MW,
  type Opened,
  type Person,
  SAVING_MS,
  type System,
  UPDATED_AT,
  allergenWords,
  checkDraft,
  choose,
  chooseCourses,
  dishAllergens,
  draftPick,
  draftWords,
  guestSends,
  hasChanged,
  header,
  hostCounts,
  hostLineWords,
  menuStart,
  menuStateOf,
  needsHost,
  partySize,
  personOf,
  whoHasnt,
} from './menuPicksModel.ts';
import {
  Card,
  CardTitle,
  ChooseButton,
  Choice,
  CourseCard,
  KitchenSheetPill,
  OverrideAlert,
  SheetFailed,
  styles as parts,
} from './MenuPicksParts.tsx';

export function MenuPicksRoute() {
  const params = useLocalSearchParams<{ state?: string }>();
  const state = menuStateOf(params.state);
  const [round, setRound] = useState(0);

  return (
    <MenuPicks
      key={`${state}.${round}`}
      start={menuStart(state)}
      onReset={() => setRound((n) => n + 1)}
    />
  );
}

const REFRESH_MS = 1200;
const NOW = '19:45';

function MenuPicks({ start, onReset }: { start: MenuStart; onReset: () => void }) {
  const { kind } = useLayout();
  const insets = useSafeAreaInsets();
  const [world, setWorld] = useState<MenuWorld | null>(start.world);
  const [system, setSystem] = useState<System | null>(start.system);
  const [download, setDownload] = useState<Download>(start.download);
  const [opened, setOpened] = useState<Opened | null>(start.opened);
  const [said, setSaid] = useState<string | null>(null);
  const opener = useRef<ViewInstance | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const access = start.access;

  useEffect(
    () => () => {
      if (timer.current != null) clearTimeout(timer.current);
    },
    [],
  );

  const later = (ms: number, then: () => void) => {
    if (timer.current != null) clearTimeout(timer.current);
    timer.current = setTimeout(then, ms);
  };
  const refresh = () => {
    setSystem('refreshing');
    later(REFRESH_MS, () => setSystem(null));
  };
  const downloadSheet = () => {
    setDownload('downloading');
    later(DOWNLOAD_MS, () => setDownload('shared'));
  };
  const open = (personId: string, from: ViewInstance | null, courseId?: string) => {
    opener.current = from;
    setSaid(null);
    setOpened(courseId == null ? { personId } : { personId, courseId });
  };

  const hasMenu = world != null && world.courses.length > 0;
  const loading = system === 'loading' || world == null;
  const bar = (
    <View style={styles.bar}>
      <Pressable
        onPress={goBack}
        accessibilityRole="button"
        accessibilityLabel={MW.back}
        style={({ pressed }) => [styles.back, pressed && parts.pressed]}
        testID="menu.back"
      >
        <Glyph name="back" size={24} ink={tokens.colorAccentText} weight={2.4} />
      </Pressable>
      <View style={parts.flex}>
        <Text size={15} style={parts.secondary} numberOfLines={2}>
          {EVENT_NAME}
        </Text>
        <Text size={kind === 'phone' ? 26 : 30} weight="bold" accessibilityRole="header">
          {MW.title}
        </Text>
      </View>
      {hasMenu && !loading && (
        <KitchenSheetPill downloading={download === 'downloading'} onPress={downloadSheet} />
      )}
    </View>
  );

  const demo = (
    <DemoOnly title="Demo only">
      {world != null && hasMenu && world.people.length > 0 && (
        <SecondaryButton
          label={
            guestSends(world) == null
              ? 'Nobody left to send'
              : `${guestSends(world)?.name} sends their picks`
          }
          off={guestSends(world) == null}
          onPress={() => {
            const sent = guestSends(world);
            if (sent != null) setWorld(sent.world);
          }}
          testID="menu.demo.sends"
        />
      )}
      {loading && (
        <SecondaryButton
          label="Finish loading"
          onPress={() => {
            setWorld(world ?? menuStart('populated').world);
            setSystem(null);
          }}
          testID="menu.demo.loaded"
        />
      )}
      {download === 'downloading' && (
        <SecondaryButton
          label="The download fails"
          onPress={() => setDownload('failed')}
          testID="menu.demo.fails"
        />
      )}
      <SecondaryButton label="Start again" onPress={onReset} testID="menu.demo.reset" />
    </DemoOnly>
  );

  const scroll = (children: React.ReactNode) => (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[
          styles.body,
          kind === 'phone' ? styles.bodyPhone : styles.bodyTablet,
          { paddingBottom: insets.bottom + tokens.space3xl },
        ]}
        refreshControl={
          hasMenu && !loading ? (
            <RefreshControl refreshing={system === 'refreshing'} onRefresh={refresh} />
          ) : undefined
        }
      >
        {bar}
        {children}
        {demo}
      </ScrollView>
    </View>
  );

  if (loading)
    return scroll(
      <Skeleton
        words={MW.loading}
        shape="cards"
        cards={[{ lines: 2 }, { lines: 6 }, { lines: 6 }]}
      />,
    );

  if (!hasMenu)
    return scroll(
      <Card testID="menu.noMenu">
        <CardTitle words={MW.noMenuTitle} />
        <Text size={16} style={parts.secondary}>
          {MW.noMenuBody}
        </Text>
      </Card>,
    );

  const person = opened == null ? undefined : personOf(world, opened.personId);
  const top = (
    <View style={styles.top}>
      <Text size={17} weight="semibold" testID="menu.header">
        {header(world)}
      </Text>
      {system === 'refreshing' && <Refreshing testID="menu.refreshing" words={MW.refreshing} />}
      {system === 'stale' ? (
        <View style={parts.markLine} testID="menu.stale">
          <Glyph name="warn" size={16} ink={tokens.colorAttentionText} />
          <View style={parts.flex}>
            <AmberLine text={MW.stale(UPDATED_AT)} ink />
          </View>
        </View>
      ) : (
        <Text size={15} style={parts.secondary}>
          {MW.live(UPDATED_AT)}
        </Text>
      )}
      {download === 'downloading' && (
        <Text size={15} style={parts.secondary} testID="menu.downloading">
          {MW.downloadingLine}
        </Text>
      )}
      {download === 'failed' && <SheetFailed onRetry={downloadSheet} />}
      {download === 'shared' && (
        <DemoOnly title="Demo only">
          <Text size={15} style={parts.secondary}>
            {MW.shared}
          </Text>
        </DemoOnly>
      )}
      {said != null && <Confirmed words={said} />}
      {world.held > 0 && (
        <Text size={15} style={parts.secondary} testID="menu.held">
          {MW.held(world.held, world.people.length)}
        </Text>
      )}
      {hasChanged(world) && (
        <Text size={15} style={parts.secondary} testID="menu.changed">
          {MW.menuChanged}
        </Text>
      )}
    </View>
  );

  if (world.people.length === 0)
    return scroll(
      <>
        {top}
        <Card testID="menu.nobody">
          <CardTitle words={MW.emptyTitle} />
          <Text size={16} style={parts.secondary}>
            {MW.emptyBody}
          </Text>
          <View style={parts.choose}>
            <PrimaryButton
              label={MW.toGuests}
              onPress={() => router.push('/demo/guests')}
              testID="menu.toGuests"
            />
          </View>
        </Card>
      </>,
    );

  const host = <NeedsHost world={world} access={access} onChoose={open} />;
  const waiting =
    access === 'counts' ? null : <WhoHasnt world={world} access={access} onChoose={open} />;
  const next = (
    <Text size={15} style={parts.secondary} testID="menu.next">
      {MW.nextStep}
    </Text>
  );
  const courses = (two: boolean) => (
    <View style={two ? styles.twoAcross : styles.column}>
      {world.courses.map((course) => (
        <View key={course.id} style={two ? styles.half : null}>
          <CourseCard world={world} course={course} />
        </View>
      ))}
    </View>
  );

  const content =
    kind === 'tabletLandscape' ? (
      <View style={styles.sides}>
        <View style={styles.main}>{courses(false)}</View>
        <View style={styles.side}>
          {host}
          {waiting}
          {next}
        </View>
      </View>
    ) : (
      <View style={styles.column}>
        {host}
        {courses(kind === 'tabletPortrait')}
        {waiting}
        {next}
      </View>
    );

  return (
    <>
      {scroll(
        <>
          {top}
          {content}
        </>,
      )}
      <Sheet
        open={opened != null && person != null}
        onClose={() => setOpened(null)}
        scrimLabel={MW.cancel}
        opener={opener}
        docked={kind === 'tabletLandscape'}
        headingTakesFocus
        testID="menu.chooseFor"
      >
        {opened != null && person != null && (
          <ChooseFor
            key={`${opened.personId}.${opened.courseId ?? ''}`}
            world={world}
            person={person}
            opened={opened}
            onSaved={(course, pick, words) => {
              setWorld((now) => (now == null ? now : choose(now, course.id, person.id, pick)));
              setSaid(words);
            }}
            onClose={() => setOpened(null)}
          />
        )}
      </Sheet>
    </>
  );
}

function NeedsHost({
  world,
  access,
  onChoose,
}: {
  world: MenuWorld;
  access: Access;
  onChoose: (personId: string, from: ViewInstance | null, courseId?: string) => void;
}) {
  const lines = needsHost(world);
  if (lines.length === 0) return null;

  return (
    <Card testID="menu.needsHost">
      <View style={parts.markLine}>
        <Glyph name="alert" size={18} ink={tokens.colorAttentionText} />
        <CardTitle words={MW.needsHost} />
      </View>
      <Text size={15} style={parts.secondary}>
        {MW.needsHostBody}
      </Text>
      {access === 'counts' ? (
        <>
          {hostCounts(world).map((line) => (
            <Text key={line} size={16} style={styles.line}>
              {line}
            </Text>
          ))}
          <Text size={15} style={parts.secondary}>
            {MW.needsRead}
          </Text>
        </>
      ) : (
        <>
          {lines.map((line) => (
            <View key={`${line.person.id}.${line.course.id}`} style={styles.line}>
              <Text size={17} weight="semibold">
                {line.person.name}
              </Text>
              <Text size={15} style={parts.secondary}>
                {hostLineWords(line)}
              </Text>
              <ChooseButton
                name={line.person.name}
                access={access}
                onPress={(from) => onChoose(line.person.id, from, line.course.id)}
                testID={`menu.host.${line.person.id}.${line.course.id}`}
              />
            </View>
          ))}
          {access === 'read' && (
            <Text size={15} style={parts.secondary}>
              {MW.needsManage}
            </Text>
          )}
        </>
      )}
    </Card>
  );
}

function WhoHasnt({
  world,
  access,
  onChoose,
}: {
  world: MenuWorld;
  access: Access;
  onChoose: (personId: string, from: ViewInstance | null) => void;
}) {
  const groups = whoHasnt(world);

  return (
    <Card testID="menu.whoHasnt">
      <CardTitle words={MW.whoHasnt} />
      {groups.length === 0 && (
        <Text size={15} style={parts.secondary}>
          {world.courses.length > 0 && needsHost(world).length === 0 ? MW.allIn : MW.whoHasntNone}
        </Text>
      )}
      {groups.map((group) => (
        <View key={group.party.id} style={styles.group}>
          <Text size={15} weight="semibold" style={parts.secondary}>
            {MW.replied(group.party.replier, partySize(world, group.party))}
          </Text>
          {group.people.map(({ person, courses }) => (
            <View key={person.id} style={styles.line}>
              <Text size={17} weight="semibold">
                {person.name}
              </Text>
              <Text size={15} style={parts.secondary}>
                {MW.notChosenOn(courseList(courses))}
              </Text>
              <ChooseButton
                name={person.name}
                access={access}
                onPress={(from) => onChoose(person.id, from)}
                testID={`menu.wait.${person.id}`}
              />
            </View>
          ))}
        </View>
      ))}
      {access === 'read' && groups.length > 0 && (
        <Text size={15} style={parts.secondary}>
          {MW.needsManage}
        </Text>
      )}
    </Card>
  );
}

function courseList(courses: readonly Course[]): string {
  const names = courses.map((one) => one.name);
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1) as string}`;
}

function firstCheck(course: Course, person: Person, opened: Opened): DraftCheck | null {
  if (opened.press !== true) return null;
  return checkDraft(course, person, opened.draft ?? null);
}

function ChooseFor({
  world,
  person,
  opened,
  onSaved,
  onClose,
}: {
  world: MenuWorld;
  person: Person;
  opened: Opened;
  onSaved: (course: Course, pick: ReturnType<typeof draftPick>, words: string) => void;
  onClose: () => void;
}) {
  const [courses] = useState(() => chooseCourses(world, person, opened.courseId));
  const [at, setAt] = useState(0);
  const [draft, setDraft] = useState<Draft>(opened.draft ?? null);
  const first = courses[0] == null ? null : firstCheck(courses[0], person, opened);
  const [blank, setBlank] = useState<string | null>(first?.kind === 'blank' ? first.words : null);
  const [asking, setAsking] = useState<DraftCheck | null>(
    first?.kind === 'ruledOut' ? first : null,
  );
  const [refused, setRefused] = useState(first?.kind === 'ok' && opened.refuses === true);
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const course = courses[at];

  useEffect(
    () => () => {
      if (timer.current != null) clearTimeout(timer.current);
    },
    [],
  );

  if (course == null) return null;
  const last = at === courses.length - 1;

  const commit = (override: boolean) => {
    if (draft == null) return;
    setAsking(null);
    setSaving(true);
    timer.current = setTimeout(() => {
      setSaving(false);
      if (opened.refuses === true) {
        setRefused(true);
        return;
      }
      const check = checkDraft(course, person, draft);
      const words =
        override && check.kind === 'ruledOut'
          ? MW.savedOverride(person.name, draftWords(course, draft), allergenWords(check.allergens))
          : MW.savedFor(course.name, person.name, draftWords(course, draft));
      onSaved(course, draftPick(draft, override, NOW), words);
      if (last) onClose();
      else {
        setAt(at + 1);
        setDraft(null);
        setBlank(null);
      }
    }, SAVING_MS);
  };
  const save = () => {
    if (saving || refused) return;
    const check = checkDraft(course, person, draft);
    if (check.kind === 'blank') return setBlank(check.words);
    setBlank(null);
    if (check.kind === 'ruledOut') return setAsking(check);
    commit(false);
  };
  const pickDish = (dishId: string) => {
    const found = course.dishes.find((one) => one.id === dishId);
    setBlank(null);
    setDraft({
      kind: 'dish',
      dishId,
      variantId: found?.variants.length === 1 ? (found.variants[0]?.id ?? null) : null,
      sideId: null,
    });
  };
  const chosen =
    draft?.kind === 'dish' ? course.dishes.find((one) => one.id === draft.dishId) : undefined;

  return (
    <View style={styles.sheet}>
      <Text size={tokens.typeTitleDialog.size} weight="bold" accessibilityRole="header">
        {MW.choosing(person.name)}
      </Text>
      <Text size={15} style={parts.secondary}>
        {MW.courseOf(course.name, at + 1, courses.length)}
      </Text>
      <SheetScrollView style={styles.sheetList} contentContainerStyle={styles.sheetScroll}>
        <View accessibilityRole="radiogroup" style={styles.choices}>
          {course.dishes.map((dish) => {
            const ruled = dishAllergens(dish, person);
            return (
              <Choice
                key={dish.id}
                on={draft?.kind === 'dish' && draft.dishId === dish.id}
                title={dish.name}
                lines={
                  dish.contains.length === 0 ? [] : [MW.contains(allergenWords(dish.contains))]
                }
                allergy={ruled.length === 0 ? null : MW.ruledOut(allergenWords(ruled), person.name)}
                onPress={() => pickDish(dish.id)}
                testID={`menu.choose.${dish.id}`}
              />
            );
          })}
          <Choice
            on={draft?.kind === 'kitchen'}
            title={MW.kitchenChoose}
            lines={[]}
            allergy={null}
            onPress={() => {
              setBlank(null);
              setDraft({ kind: 'kitchen' });
            }}
            testID="menu.choose.kitchen"
          />
        </View>
        {chosen != null && draft?.kind === 'dish' && chosen.variants.length > 1 && (
          <View accessibilityRole="radiogroup" style={styles.choices}>
            <Text size={17} weight="semibold" accessibilityRole="header">
              {MW.whichWay(chosen.name)}
            </Text>
            {chosen.variants.map((way) => {
              const ruled = dishAllergens(chosen, person, way.id);
              return (
                <Choice
                  key={way.id}
                  on={draft.variantId === way.id}
                  title={way.name}
                  lines={
                    way.contains.length === 0 ? [] : [MW.contains(allergenWords(way.contains))]
                  }
                  allergy={
                    ruled.length === 0 ? null : MW.ruledOut(allergenWords(ruled), person.name)
                  }
                  onPress={() => {
                    setBlank(null);
                    setDraft({ ...draft, variantId: way.id });
                  }}
                  testID={`menu.choose.${way.id}`}
                />
              );
            })}
          </View>
        )}
        {chosen != null && draft?.kind === 'dish' && chosen.sides.length > 0 && (
          <View accessibilityRole="radiogroup" style={styles.choices}>
            <Text size={17} weight="semibold" accessibilityRole="header">
              {MW.whichSide}
            </Text>
            {chosen.sides.map((side) => (
              <Choice
                key={side.id}
                on={draft.sideId === side.id}
                title={side.name}
                lines={[]}
                allergy={null}
                onPress={() => setDraft({ ...draft, sideId: side.id })}
                testID={`menu.choose.${side.id}`}
              />
            ))}
          </View>
        )}
        {blank != null && <FailureLine words={blank} testID="menu.choose.blank" />}
        {refused && <FailureLine words={MW.refused} testID="menu.choose.refused" />}
      </SheetScrollView>
      <SheetActions>
        <SecondaryButton label={MW.cancel} onPress={onClose} testID="menu.choose.cancel" />
        <PrimaryButton
          label={last ? MW.save : MW.saveNext}
          onPress={save}
          busy={saving}
          off={refused}
          testID="menu.choose.save"
        />
      </SheetActions>
      {asking?.kind === 'ruledOut' && (
        <OverrideAlert
          title={asking.title}
          body={asking.body}
          onAnother={() => setAsking(null)}
          onAnyway={() => commit(true)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colorPage },
  body: { gap: tokens.spaceLg },
  bodyPhone: { paddingHorizontal: tokens.spaceLg },
  bodyTablet: { paddingHorizontal: tokens.spaceXxl },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    paddingTop: tokens.spaceSm,
  },
  back: {
    width: tokens.sizeHit,
    height: tokens.sizeHit,
    alignItems: 'center',
    justifyContent: 'center',
  },
  top: { gap: tokens.spaceXs },
  column: { gap: tokens.spaceLg },
  twoAcross: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceLg },
  half: { flexBasis: '47%', flexGrow: 1 },
  sides: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceXl },
  main: { flex: 3, gap: tokens.spaceLg },
  side: { flex: 2, gap: tokens.spaceLg },
  line: {
    gap: tokens.spaceXxs,
    paddingTop: tokens.spaceSm,
    borderTopWidth: 1,
    borderTopColor: tokens.colorBorder,
  },
  group: { gap: tokens.spaceXs, marginTop: tokens.spaceSm },
  sheet: {
    flexShrink: 1,
    gap: tokens.spaceMd,
    paddingHorizontal: tokens.spaceXl,
    paddingTop: tokens.spaceXxl,
    paddingBottom: tokens.spaceLg,
  },
  sheetList: { flexShrink: 1 },
  sheetScroll: { gap: tokens.spaceMd },
  choices: { gap: tokens.spaceSm },
});
