import type {
  EventMenu as Menu,
  EventPicks,
  MenuCourse,
  OrganisationEvent,
  PicksCourse,
  PicksRow,
} from '@soirely/api-client';
import {
  clockOf,
  courseHostCount,
  defaultPick,
  hostCount,
  menuCourseOf,
  waitingSplit,
} from '@soirely/domain';
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, RefreshControl, StyleSheet, View, type ViewInstance } from 'react-native';

import { api } from '../api.ts';
import { dateLocale, useShownLanguage } from '../i18n/index.ts';
import { headerClose, hostLine, openWords, picksAccess } from '../kit/menuPicksWords.ts';
import { writeToShare } from '../kit/sharedFile.ts';
import type { LayoutKind } from '../layout/classify.ts';
import { Confirmed } from '../steps/Lines.tsx';
import { tokens } from '../theme/tokens.ts';
import { AmberLine } from './Amber.tsx';
import { bodyEdges } from './bodyEdges.ts';
import { PrimaryButton } from './Buttons.tsx';
import { Glyph } from './Glyph.tsx';
import { ChooseFor, ChooseWho, type Said } from './MenuChoose.tsx';
import {
  Card,
  CardTitle,
  ChooseButton,
  CourseCard,
  KitchenSheetPill,
  SheetFailed,
  styles as parts,
  useAllergens,
} from './MenuPicksParts.tsx';
import { Refreshing } from './Refreshing.tsx';
import { Screen } from './Screen.tsx';
import { Sheet } from './Sheet.tsx';
import { Skeleton } from './Skeleton.tsx';
import { Text, type TextHandle } from './Text.tsx';
import { BodyTitle } from './Title.tsx';
import { PAGE_TITLE, pageTitle } from './topTitle.ts';

/** Under 10 seconds, so counts move while the screen is open (sc-3914). */
export const POLL_MS = 8000;

const PDF = { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' };

type Load =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'loaded'; picks: EventPicks; menu: Menu; stale: boolean };

type Opened =
  | { kind: 'chooseFor'; personId: string; courseIds: string[]; given?: boolean }
  | { kind: 'chooseWho'; courseId: string; row: PicksRow };

type Download = 'idle' | 'downloading' | 'failed';

/** The event's Menu in the app (sc-3914): its picks as See picks counts them, Choose for them and Choose who gets it, the kitchen sheet to share; the menu itself is changed on the web. */
export function EventMenu({
  event,
  kind,
  titleRef,
  onGuests,
}: {
  event: OrganisationEvent;
  kind: LayoutKind;
  titleRef: RefObject<TextHandle | null>;
  onGuests: () => void;
}) {
  const { t } = useTranslation();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [pulling, setPulling] = useState(false);
  const [download, setDownload] = useState<Download>('idle');
  const [opened, setOpened] = useState<Opened | null>(null);
  const [said, setSaid] = useState<Said>([]);
  const opener = useRef<ViewInstance | null>(null);
  const asked = useRef(0);
  const out = useRef(false);

  const drop = () => {
    asked.current += 1;
    out.current = false;
  };

  const read = useCallback(() => {
    const mine = ++asked.current;
    out.current = true;
    const landed = () => {
      if (mine !== asked.current) return false;
      out.current = false;
      setPulling(false);

      return true;
    };
    Promise.all([api.menuPicks(event.id), api.menu(event.id)]).then(
      ([picks, menu]) => {
        if (landed()) setLoad({ kind: 'loaded', picks, menu, stale: false });
      },
      () => {
        if (landed())
          setLoad((was) => (was.kind === 'loaded' ? { ...was, stale: true } : { kind: 'failed' }));
      },
    );
  }, [event.id]);

  useEffect(() => {
    read();
    const timer = setInterval(() => {
      if (!out.current && AppState.currentState === 'active') read();
    }, POLL_MS);

    return () => {
      clearInterval(timer);
      asked.current += 1;
      out.current = false;
    };
  }, [read]);

  const pull = () => {
    setPulling(true);
    read();
  };

  const shareSheet = async () => {
    setDownload('downloading');
    try {
      const { name, bytes } = await api.kitchenSheetPdf(event.id);
      const file = await writeToShare(bytes, name ?? `${t('menuPicks.kitchenSheet')}.pdf`, PDF);
      setDownload('idle');
      await file.hand();
    } catch {
      setDownload('failed');
    }
  };

  const loaded = load.kind === 'loaded' ? load : null;
  const hasMenu = loaded != null && loaded.menu.courses.length > 0;
  const phone = kind === 'phone';

  const heading = (
    <View style={styles.bar}>
      <View style={parts.flex}>
        <Text size={15} style={parts.secondary} numberOfLines={2}>
          {event.name}
        </Text>
        <BodyTitle size={PAGE_TITLE} accessibilityRole="header" ref={titleRef} style={pageTitle}>
          {t('eventNav.menu')}
        </BodyTitle>
      </View>
      {hasMenu && (
        <KitchenSheetPill
          downloading={download === 'downloading'}
          onPress={() => void shareSheet()}
        />
      )}
    </View>
  );

  const body = (() => {
    if (load.kind === 'loading')
      return (
        <Skeleton
          words={t('menuPicks.loading')}
          shape="cards"
          cards={[{ lines: 2 }, { lines: 6 }, { lines: 6 }]}
        />
      );
    if (load.kind === 'failed')
      return (
        <Card testID="menu.failed">
          <Text size={16}>{t('menuPicks.failed')}</Text>
          <View style={parts.choose}>
            <PrimaryButton
              label={t('menuPicks.tryAgain')}
              onPress={() => {
                setLoad({ kind: 'loading' });
                read();
              }}
              testID="menu.retry"
            />
          </View>
        </Card>
      );
    if (!hasMenu)
      return (
        <Card testID="menu.noMenu">
          <CardTitle words={t('menuPicks.noMenuTitle')} />
          <Text size={16} style={parts.secondary}>
            {t('menuPicks.noMenuBody')}
          </Text>
        </Card>
      );

    return (
      <Picks
        event={event}
        kind={kind}
        picks={load.picks}
        menu={load.menu}
        stale={load.stale}
        pulling={pulling}
        download={download}
        said={said}
        onRetrySheet={() => void shareSheet()}
        onGuests={onGuests}
        onOpen={(next, from) => {
          opener.current = from;
          setSaid([]);
          setOpened(next);
        }}
      />
    );
  })();

  const picks = loaded?.picks ?? null;
  const menu = loaded?.menu ?? null;
  const person =
    opened?.kind === 'chooseFor' ? picks?.people?.find((one) => one.id === opened.personId) : null;
  const whoCourse =
    opened?.kind === 'chooseWho'
      ? picks?.courses.find((one) => one.id === opened.courseId)
      : undefined;
  const onSaved = (next: EventPicks, lines: Said) => {
    drop();
    setLoad((was) => (was.kind === 'loaded' ? { ...was, picks: next, stale: false } : was));
    setSaid(lines);
  };

  return (
    <>
      <Screen
        edges={bodyEdges(kind)}
        contentStyle={phone ? styles.phone : styles.tablet}
        refreshControl={
          hasMenu ? <RefreshControl refreshing={pulling} onRefresh={pull} /> : undefined
        }
      >
        {heading}
        {body}
      </Screen>
      <Sheet
        open={(person != null && menu != null) || (whoCourse != null && menu != null)}
        onClose={() => setOpened(null)}
        scrimLabel={t('menuPicks.cancel')}
        opener={opener}
        docked={kind === 'tabletLandscape'}
        headingTakesFocus
        testID="menu.chooseFor"
      >
        {opened?.kind === 'chooseFor' && person != null && menu != null && picks != null && (
          <ChooseFor
            key={`${opened.personId}.${opened.courseIds.join('.')}.${opened.given === true ? 'given' : ''}`}
            eventId={event.id}
            person={person}
            courses={opened.courseIds
              .map((id) => menuCourseOf(menu, id))
              .filter((one): one is MenuCourse => one != null)}
            given={opened.given === true}
            onSaved={onSaved}
            onClose={() => setOpened(null)}
          />
        )}
        {opened?.kind === 'chooseWho' && whoCourse != null && menu != null && picks != null && (
          <ChooseWho
            key={`${opened.courseId}.${opened.row.id}`}
            eventId={event.id}
            picks={picks}
            course={whoCourse}
            dish={menuCourseOf(menu, opened.courseId)?.dishes.find(
              (one) => one.id === opened.row.dish,
            )}
            row={opened.row}
            onSaved={onSaved}
            onClose={() => setOpened(null)}
          />
        )}
      </Sheet>
    </>
  );
}

function Picks({
  event,
  kind,
  picks,
  menu,
  stale,
  pulling,
  download,
  said,
  onRetrySheet,
  onGuests,
  onOpen,
}: {
  event: OrganisationEvent;
  kind: LayoutKind;
  picks: EventPicks;
  menu: Menu;
  stale: boolean;
  pulling: boolean;
  download: Download;
  said: Said;
  onRetrySheet: () => void;
  onGuests: () => void;
  onOpen: (next: Opened, from: ViewInstance | null) => void;
}) {
  const { t } = useTranslation();
  const language = useShownLanguage();
  const allergens = useAllergens();
  const access = picksAccess(picks);
  const manage = access === 'manage';
  const names = access !== 'counts';
  const at = clockOf(picks.updatedAt);
  const courseName = (id: string) => picks.courses.find((one) => one.id === id)?.name ?? '';
  const close = headerClose(t, menu, event.timeZone, dateLocale());
  const figures = {
    answered: picks.answered,
    room: picks.room,
    percent: picks.percent,
  };

  const top = (
    <View style={styles.top}>
      {picks.room > 0 && (
        <Text size={17} weight="semibold" testID="menu.header">
          {close == null
            ? t('menuPicks.header', figures)
            : t('menuPicks.headerClose', { ...figures, close })}
        </Text>
      )}
      {pulling && <Refreshing testID="menu.refreshing" words={t('menuPicks.refreshing')} />}
      {stale ? (
        <View style={parts.markLine} testID="menu.stale">
          <Glyph name="warn" size={16} ink={tokens.colorAttentionText} />
          <View style={parts.flex}>
            <AmberLine text={t('menuPicks.stale', { at })} ink />
          </View>
        </View>
      ) : (
        <Text size={15} style={parts.secondary} testID="menu.live">
          {t('menuPicks.live', { at })}
        </Text>
      )}
      {download === 'downloading' && (
        <Text size={15} style={parts.secondary} testID="menu.downloading">
          {t('menuPicks.downloadingLine')}
        </Text>
      )}
      {download === 'failed' && <SheetFailed onRetry={onRetrySheet} />}
      {said.map((line) => (
        <Confirmed key={line} words={line} />
      ))}
      {picks.held > 0 && (
        <Text size={15} style={parts.secondary} testID="menu.held">
          {t('menuPicks.held', { count: picks.held, room: picks.room })}
        </Text>
      )}
      {picks.courses.some((course) => course.menuChanged > 0) && (
        <Text size={15} style={parts.secondary} testID="menu.changed">
          {t('menuPicks.menuChanged')}
        </Text>
      )}
    </View>
  );

  if (picks.room === 0 && picks.held === 0)
    return (
      <>
        {top}
        <Card testID="menu.nobody">
          <CardTitle words={t('menuPicks.emptyTitle')} />
          <Text size={16} style={parts.secondary}>
            {t('menuPicks.emptyBody')}
          </Text>
          <View style={parts.choose}>
            <PrimaryButton
              label={t('menuPicks.toGuests')}
              onPress={onGuests}
              testID="menu.toGuests"
            />
          </View>
        </Card>
      </>
    );

  const host =
    hostCount(picks) === 0 ? null : (
      <Card testID="menu.needsHost">
        <View style={parts.markLine}>
          <Glyph name="alert" size={18} ink={tokens.colorAttentionText} />
          <CardTitle words={t('menuPicks.needsHost')} />
        </View>
        <Text size={15} style={parts.secondary}>
          {t('menuPicks.needsHostBody')}
        </Text>
        {picks.needsHost == null ? (
          <>
            {picks.courses
              .filter((course) => courseHostCount(course) > 0)
              .map((course) => (
                <Text key={course.id} size={16} style={styles.line}>
                  {t('menuPicks.hostCount', {
                    course: course.name,
                    count: courseHostCount(course),
                  })}
                </Text>
              ))}
            <Text size={15} style={parts.secondary}>
              {t('menuPicks.needsRead')}
            </Text>
          </>
        ) : (
          <>
            {picks.needsHost.map((line) =>
              line.person == null ? null : (
                <HostLine
                  key={`${line.person.id}.${line.course}`}
                  name={line.person.name}
                  words={hostLine(t, allergens, line, courseName(line.course))}
                  manage={manage}
                  onChoose={(from) =>
                    onOpen(
                      {
                        kind: 'chooseFor',
                        personId: line.person?.id ?? '',
                        courseIds: [line.course],
                      },
                      from,
                    )
                  }
                  testID={`menu.host.${line.person.id}.${line.course}`}
                />
              ),
            )}
            {!manage && (
              <Text size={15} style={parts.secondary}>
                {t('menuPicks.needsManage')}
              </Text>
            )}
          </>
        )}
      </Card>
    );

  const { never, parties } = waitingSplit(picks.waiting ?? []);
  const given = picks.given ?? [];
  const givenCount = given.reduce((sum, party) => sum + party.people.length, 0);
  const words = (person: (typeof never)[number]) => openWords(t, language, person, courseName);
  const opensOn = (person: (typeof never)[number]) => [
    ...person.courses,
    ...person.changed.map((one) => one.course).filter((id) => !person.courses.includes(id)),
  ];
  const changedLines = (person: (typeof never)[number]) =>
    person.changed.map((one) => (
      <View key={one.course} style={parts.markLine}>
        <Glyph name="alert" size={16} ink={tokens.colorAttentionText} />
        <Text size={15} style={parts.secondary}>
          {t('menuPicks.changedOn', { course: courseName(one.course), dish: one.picked })}
        </Text>
      </View>
    ));

  const waiting = !names ? null : (
    <>
      <Card testID="menu.whoHasnt">
        <CardTitle words={t('menuPicks.whoHasnt')} />
        {never.length > 0 && (
          <View style={styles.group} testID="menu.neverGiven">
            <View style={parts.markLine}>
              <Glyph name="alert" size={16} ink={tokens.colorAttentionText} />
              <Text size={15} weight="semibold" accessibilityRole="header">
                {t('menuPicks.neverGiven', { count: never.length })}
              </Text>
            </View>
            <Text size={15} style={parts.secondary}>
              {t('menuPicks.neverGivenBody')}
            </Text>
            {never.map((person) => (
              <View key={person.id} style={styles.line}>
                <Text size={17} weight="semibold">
                  {person.name}
                </Text>
                {person.courses.length > 0 && (
                  <Text size={15} style={parts.secondary}>
                    {words(person)}
                  </Text>
                )}
                {changedLines(person)}
                <ChooseButton
                  name={person.name}
                  manage={manage}
                  onPress={(from) =>
                    onOpen(
                      { kind: 'chooseFor', personId: person.id, courseIds: opensOn(person) },
                      from,
                    )
                  }
                  testID={`menu.never.${person.id}`}
                />
              </View>
            ))}
          </View>
        )}
        {parties.length === 0 && never.length === 0 && (
          <Text size={15} style={parts.secondary}>
            {picks.allIn ? t('menuPicks.allIn') : t('menuPicks.whoHasntNone')}
          </Text>
        )}
        {parties.map((party) => (
          <View key={party.id} style={styles.group}>
            <Text size={15} weight="semibold" style={parts.secondary}>
              {t('menuPicks.replied', { name: party.replier, count: party.people.length })}
            </Text>
            {party.people.map((person) => (
              <View key={person.id} style={styles.line}>
                <Text size={17} weight="semibold">
                  {person.name}
                </Text>
                {person.courses.length > 0 && (
                  <Text size={15} style={parts.secondary}>
                    {words(person)}
                  </Text>
                )}
                {changedLines(person)}
                <ChooseButton
                  name={person.name}
                  manage={manage}
                  onPress={(from) =>
                    onOpen(
                      { kind: 'chooseFor', personId: person.id, courseIds: opensOn(person) },
                      from,
                    )
                  }
                  testID={`menu.wait.${person.id}`}
                />
              </View>
            ))}
          </View>
        ))}
        {!manage && parties.length + never.length > 0 && (
          <Text size={15} style={parts.secondary}>
            {t('menuPicks.needsManage')}
          </Text>
        )}
      </Card>
      {givenCount > 0 && (
        <Card testID="menu.given">
          <CardTitle words={t('menuPicks.given', { count: givenCount })} />
          <Text size={15} style={parts.secondary}>
            {t('menuPicks.givenBody')}
          </Text>
          {given.map((party) => (
            <View key={party.id} style={styles.group}>
              <Text size={15} weight="semibold" style={parts.secondary}>
                {t('menuPicks.replied', { name: party.replier, count: party.people.length })}
              </Text>
              {party.people.map((person) => (
                <View key={person.id} style={styles.line}>
                  <Text size={17} weight="semibold">
                    {person.name}
                  </Text>
                  {person.courses.map((one) => (
                    <Text key={one.course} size={15} style={parts.secondary}>
                      {t('menuPicks.givenOn', {
                        course: courseName(one.course),
                        pick: defaultPick(menu, one),
                      })}
                    </Text>
                  ))}
                  <ChooseButton
                    name={person.name}
                    manage={manage}
                    onPress={(from) =>
                      onOpen(
                        {
                          kind: 'chooseFor',
                          personId: person.id,
                          courseIds: person.courses.map((one) => one.course),
                          given: true,
                        },
                        from,
                      )
                    }
                    testID={`menu.given.${person.id}`}
                  />
                </View>
              ))}
            </View>
          ))}
          {!manage && (
            <Text size={15} style={parts.secondary}>
              {t('menuPicks.needsManage')}
            </Text>
          )}
        </Card>
      )}
    </>
  );

  const next = (
    <Text size={15} style={parts.secondary} testID="menu.next">
      {t('menuPicks.nextStep')}
    </Text>
  );
  const courses = (two: boolean) => (
    <View style={two ? styles.twoAcross : styles.column}>
      {picks.courses.map((course: PicksCourse) => (
        <View key={course.id} style={two ? styles.half : null}>
          <CourseCard
            menu={menu}
            course={course}
            room={picks.room}
            timeZone={event.timeZone}
            manage={manage}
            onChooseWho={(row, from) =>
              onOpen({ kind: 'chooseWho', courseId: course.id, row }, from)
            }
          />
        </View>
      ))}
    </View>
  );

  return (
    <>
      {top}
      {kind === 'tabletLandscape' ? (
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
      )}
    </>
  );
}

function HostLine({
  name,
  words,
  manage,
  onChoose,
  testID,
}: {
  name: string;
  words: string;
  manage: boolean;
  onChoose: (from: ViewInstance | null) => void;
  testID: string;
}) {
  return (
    <View style={styles.line}>
      <Text size={17} weight="semibold">
        {name}
      </Text>
      <Text size={15} style={parts.secondary}>
        {words}
      </Text>
      <ChooseButton name={name} manage={manage} onPress={onChoose} testID={testID} />
    </View>
  );
}

const styles = StyleSheet.create({
  phone: { gap: tokens.spaceLg, paddingHorizontal: tokens.spaceLg, paddingTop: tokens.spaceSm },
  tablet: { gap: tokens.spaceLg, paddingHorizontal: tokens.spaceXxl, paddingTop: tokens.spaceXl },
  bar: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  top: { gap: tokens.spaceXs },
  column: { gap: tokens.spaceLg },
  twoAcross: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceLg },
  half: { flexBasis: '48%', flexGrow: 0 },
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
});
