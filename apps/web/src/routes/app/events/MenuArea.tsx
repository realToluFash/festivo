import {
  ApiError,
  type Dish,
  DISH_ALLERGENS,
  type EventMenu,
  CHOICE_OPTIONS_MAXIMUM,
  MENU_COURSE_MAXIMUM,
  type MenuAnswer,
  type MenuChange,
  type MenuCourse,
  type MenuDish,
  type MenuDishChoice,
  type OrganisationEvent,
  type UnwarnedOption,
  type UnwarnedPickers,
  asEventMenu,
  realtimeTopic,
} from '@soirely/api-client';
import {
  type ChoiceForm,
  type ChoiceOptionForm,
  type DishForm,
  type VariantForm,
  type VariantMode,
  addChoiceOutcome,
  addVariantOutcome,
  blankChoiceForm,
  blankDishForm,
  blankOptionForm,
  choiceDetailsOf,
  choiceFormOf,
  choiceProblems,
  dishPicked,
  firstChoiceProblem,
  formDraftReasons,
  hasChoiceProblem,
  optionPicked,
  removeChoiceOutcome,
  savesAsDraft,
  blankVariantForm,
  firstVariantProblem,
  hasProblem,
  removeVariantOutcome,
  variantDetailsOf,
  variantFormOf,
  variantPrefix,
  variantProblems,
  dishDetailsOf,
  dishProblems,
  firstDishProblem,
  moneyLanguage,
  roleName,
  sameNamedDish,
  type FixedRow,
  type ItemRow,
  dishItemProblems,
  ownItemProblems,
  sentItems,
} from '@soirely/domain';
import type { TFunction } from 'i18next';
import { type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router';

import { api } from '../../../api.ts';
import { MenuPicksProvider, PicksSummary, useEventPicks } from './menuPicks.tsx';
import {
  keepLoaded,
  keptFor,
  keptKeys,
  useAnsweredAgain,
  useKeptAsShown,
} from '../../../tabKept.ts';
import { Glyph } from '../../../components/Glyph.tsx';
import { Refreshing } from '../../../components/OfflineBand.tsx';
import { useDeskTop } from '../../../deskTop.ts';
import { keepsWhatLoaded, useOffline } from '../../../offline.ts';
import { pageTitle, usePageTitle } from '../../../pageTitle.ts';
import { dateLocale } from '../../../i18n/index.ts';
import { canOn, useSession } from '../../../session.ts';
import {
  type CourseForm,
  canAddCourse,
  closeDay,
  courseProblems,
  coursePicked,
  firstCourseProblem,
  menuClose,
  menuCloseFrom,
  menuCounts,
  moveTarget,
  servedTime,
  zoneCity,
} from './menuArea.ts';
import { type ChoiceAsk, ChoiceFields, ChoiceIntro } from './ChoiceParts.tsx';
import { allergensInSentence } from './allergenWords.ts';
import { choiceName } from './choiceWords.ts';
import { firstItemProblem, ownRowsOf, rowsOf, useOrList, withoutRow } from './menuItems.ts';
import { useShowMenuReady } from './EventNav.tsx';
import {
  AddDishPanel,
  type ChoiceHandlers,
  CourseCard,
  CourseFields,
  EditDishFields,
  LimitLine,
  Said,
  type Told,
  type VariantHandlers,
} from './MenuParts.tsx';
import { type ShownVariant, type VariantAsk, VariantFields } from '../menu/VariantParts.tsx';
import { useHubTopics } from './useHubTopics.ts';
import {
  type DefaultDates,
  type DefaultForm,
  checkDefault,
  choiceLeavesDefault,
  dayIn,
  dayWords,
  defaultForm,
  firstDefaultProblem,
  hasDefaultProblem,
  isDefaultDish,
  isDefaultOption,
  isDefaultVariant,
  type Move,
  moveWords,
  pickWords,
  sentDefault,
  variantLeavesDefault,
} from './courseDefault.ts';
import { DefaultFields, MoveDialog } from './MenuDefault.tsx';
import '../../../components/SettingsParts.css';
import '../../../components/eventsDesk.css';
import '../../../components/eventPage.css';
import './guests.css';
import '../menu/menuLibrary.css';
import './menu.css';

type Load = { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; menu: EventMenu };

type Open =
  | {
      kind: 'addCourse' | 'editCourse';
      courseId: string | null;
      from: string;
      form: CourseForm;
      own: FixedRow[];
      /** sc-1362's default and choose-by date; null on a course that asks guests nothing. */
      pair: DefaultForm | null;
      move: Move | null;
      pressed: boolean;
      failed: string | null;
      full: boolean;
      busy: boolean;
    }
  | {
      kind: 'addDish';
      courseId: string;
      tab: 'library' | 'new';
      query: string;
      form: DishForm;
      onlyEvent: boolean;
      pressed: boolean;
      failed: string | null;
      asking: string | null;
      added: string;
      busy: boolean;
    }
  | {
      kind: 'editDish';
      courseId: string;
      dishId: string;
      form: DishForm;
      items: ItemRow[];
      pressed: boolean;
      failed: string | null;
      busy: boolean;
    }
  | {
      kind: 'variant';
      mode: VariantMode;
      courseId: string;
      dishId: string;
      variantId: string | null;
      forms: VariantForm[];
      pressed: boolean;
      failed: string | null;
      busy: boolean;
    }
  | {
      kind: 'choice';
      courseId: string;
      dishId: string;
      choiceId: string | null;
      form: ChoiceForm;
      openKey: string | null;
      binRefused: string | null;
      optionsFull: boolean;
      pressed: boolean;
      failed: string | null;
      busy: boolean;
    };

type ChoiceOpen = Extract<Open, { kind: 'choice' }>;

type Asking = { kind: 'dish' | 'course'; id: string; failed: string | null };

type Refusal =
  | { kind: 'dish' | 'defaultDish'; id: string }
  | { kind: 'course'; id: string }
  | { kind: 'limit'; at: 'top' | 'end' };

/** /app/events/:id/menu (sc-3902): the event's courses in order with the dishes on each, as its demo draws it. */
export function MenuArea({ event }: { event: OrganisationEvent }) {
  const { t } = useTranslation();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const title = useRef<HTMLHeadingElement>(null);
  const answeredAgain = useAnsweredAgain();
  const { watch, keep, refreshing } = useOffline({
    loaded: load.kind === 'loaded',
    reload: () => setAttempt((n) => n + 1),
    title,
  });

  usePageTitle(pageTitle(t, [t('eventMenu.title'), event.name]));
  const picks = useEventPicks(event.id);

  useEffect(() => {
    let current = true;

    watch(api.menu(event.id)).then(
      (menu) => {
        if (!current) return;
        keepLoaded(keptKeys.menu(event.id), menu);
        setLoad({ kind: 'loaded', menu });
      },
      (error: unknown) => {
        if (!current) return;
        const kept = keepsWhatLoaded(error)
          ? keptFor<EventMenu>(keptKeys.menu(event.id), error)
          : null;

        if (kept != null) keep(kept.at);
        setLoad((was) =>
          was.kind === 'loaded' && keepsWhatLoaded(error)
            ? was
            : kept != null
              ? { kind: 'loaded', menu: kept.value }
              : { kind: 'failed' },
        );
      },
    );

    return () => {
      current = false;
    };
  }, [event.id, attempt, watch, keep, answeredAgain]);
  useKeptAsShown(keptKeys.menu(event.id), load.kind === 'loaded' ? load.menu : null);

  const topics = useMemo(() => [realtimeTopic('EventMenu', event.id)], [event.id]);
  useHubTopics(
    topics,
    () => api.menuSubscription(event.id),
    (data) => {
      const menu = asEventMenu(data);
      if (menu == null || canOn(event, 'budget.read')) setAttempt((n) => n + 1);
      else setLoad({ kind: 'loaded', menu });
    },
    () => setAttempt((n) => n + 1),
  );

  return (
    <div className="desk ev desk-page ev-page gs mn mc">
      <div className="ev-wide mn-page">
        <Crumbs event={event} />
        {load.kind === 'loaded' ? (
          <MenuPicksProvider value={picks}>
            <Courses
              event={event}
              menu={load.menu}
              title={title}
              refreshing={refreshing}
              onMenu={(menu) => setLoad({ kind: 'loaded', menu })}
            />
          </MenuPicksProvider>
        ) : (
          <>
            <header className="gs-top">
              <div className="mn-head">
                <h1 className="gs-title" ref={title} tabIndex={-1}>
                  {t('eventMenu.title')}
                </h1>
              </div>
            </header>
            {load.kind === 'loading' ? (
              <div className="lib-loading" aria-busy="true">
                <p className="lib-loading-words" role="status">
                  {t('eventMenu.loading')}
                </p>
                {[0, 1, 2].map((one) => (
                  <div key={one} className="lib-bone mc-bone" aria-hidden="true" />
                ))}
              </div>
            ) : (
              <div className="desk-card mc-refusal" role="alert">
                <h2>{t('eventMenu.cannotReach')}</h2>
                <p className="mn-quiet">{t('eventMenu.cannotReachBody')}</p>
                <button
                  type="button"
                  className="gs-pill is-primary"
                  onClick={() => {
                    setLoad({ kind: 'loading' });
                    setAttempt((n) => n + 1);
                  }}
                >
                  {t('eventMenu.tryAgain')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Crumbs({ event }: { event: OrganisationEvent }) {
  const { t } = useTranslation();
  const desk = useDeskTop();

  return (
    <div className="ev-crumb-row">
      <nav className="ev-crumb" aria-label={t('eventMenu.crumb')}>
        <ol>
          <li className="ev-crumb-part">
            <Link to="/app/events">{t('eventMenu.events')}</Link>
          </li>
          <li className="ev-crumb-part">
            <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
            <Link className="ev-crumb-name" to={`/app/events/${encodeURIComponent(event.id)}`}>
              {event.name}
            </Link>
          </li>
          <li className="ev-crumb-part" aria-current="page">
            <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
            <span className="ev-crumb-name">{t('eventMenu.title')}</span>
          </li>
        </ol>
      </nav>
      {desk.bell}
    </div>
  );
}

function unwarnedLine(
  t: TFunction,
  language: string,
  dish: string,
  unwarned: UnwarnedPickers | null,
): string | null {
  if (unwarned == null) return null;
  return t('eventMenu.unwarned', {
    count: unwarned.count,
    dish,
    allergens: allergensInSentence(
      t,
      language,
      DISH_ALLERGENS.filter((code) => unwarned.allergens.includes(code)),
    ),
  });
}

function Courses({
  event,
  menu,
  title,
  refreshing,
  onMenu,
}: {
  event: OrganisationEvent;
  menu: EventMenu;
  title: RefObject<HTMLHeadingElement | null>;
  refreshing: boolean;
  onMenu: (menu: EventMenu) => void;
}) {
  const { t, i18n } = useTranslation();
  const session = useSession();
  const organisation = session.organisation;
  const language = moneyLanguage(i18n.language);
  const manage = canOn(event, 'menu.manage');
  const courses = menu.courses;
  const [open, setOpen] = useState<Open | null>(null);
  const [asking, setAsking] = useState<Asking | null>(null);
  const [refused, setRefused] = useState<Refusal | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const backFromPreview = (location.state as { told?: string } | null)?.told === 'preview';
  const [said, setSaid] = useState<Told | null>(() =>
    backFromPreview ? { words: t('eventMenu.previewNothingSaved'), more: null } : null,
  );
  const [dragging, setDragging] = useState<string | null>(null);
  const [library, setLibrary] = useState<{ dishes: Dish[]; prices: boolean } | null>(null);
  const [libraryFailed, setLibraryFailed] = useState(false);
  const [libraryTries, setLibraryTries] = useState(0);
  const [variantAsk, setVariantAsk] = useState<VariantAsk | null>(null);
  const [addRefused, setAddRefused] = useState<VariantHandlers['addRefused']>(null);
  const [choiceAsk, setChoiceAsk] = useState<ChoiceAsk | null>(null);
  const [choiceRefused, setChoiceRefused] = useState<ChoiceHandlers['addRefused']>(null);
  const prices = canOn(event, 'budget.read');
  const focusAfter = useRef<string | null>(backFromPreview ? 'mc-preview' : null);
  const counts = menuCounts(courses);
  useShowMenuReady(event.id, counts.ready, counts.courses);
  const headClose = menuClose(courses);
  const closeAt = headClose?.at ?? null;
  const closeSource = headClose?.source ?? null;
  const [closeSeen, setCloseSeen] = useState({ at: closeAt, source: closeSource });
  const [closeMoved, setCloseMoved] = useState<{ at: string; was: string } | null>(null);
  if (closeSeen.at !== closeAt || closeSeen.source !== closeSource) {
    setCloseSeen({ at: closeAt, source: closeSource });
    setCloseMoved(
      closeSeen.at != null &&
        closeAt != null &&
        closeSeen.source === 'replyBy' &&
        closeSource === 'replyBy'
        ? { at: closeAt, was: closeSeen.at }
        : null,
    );
  }
  const closeWords = (at: string): string => closeDay(at, event.timeZone, dateLocale());
  const openCourse =
    open == null || open.courseId == null
      ? null
      : (courses.find((one) => one.id === open.courseId) ?? null);
  const openDish =
    open?.kind === 'choice'
      ? (openCourse?.dishes.find((one) => one.id === open.dishId) ?? null)
      : null;
  const openChoice =
    open?.kind === 'choice'
      ? (openDish?.choices.find((one) => one.id === open.choiceId) ?? null)
      : null;
  const orList = useOrList();
  const editingDish =
    open?.kind === 'editDish'
      ? (openCourse?.dishes.find((one) => one.id === open.dishId) ?? null)
      : null;
  const shownLibrary = library?.dishes.filter((one) => one.archivedAt == null) ?? [];
  const currency = organisation?.currency ?? '';

  useEffect(() => {
    if (focusAfter.current == null) return;
    document.getElementById(focusAfter.current)?.focus();
    focusAfter.current = null;
  });

  useEffect(() => {
    if (backFromPreview) void navigate('.', { replace: true, state: null });
  }, [backFromPreview, navigate]);

  useEffect(() => {
    if (!manage || organisation == null) return undefined;
    let current = true;

    api.dishes(organisation.id).then(
      (found) => current && setLibrary({ dishes: found.dishes, prices: found.seesPrices }),
      () => current && setLibraryFailed(true),
    );

    return () => {
      current = false;
    };
  }, [manage, organisation, libraryTries]);

  useEffect(() => {
    if (open != null && open.courseId != null && openCourse == null) setOpen(null);
  }, [open, openCourse]);

  function settle() {
    setRefused(null);
    setAsking(null);
    setVariantAsk(null);
    setAddRefused(null);
    setChoiceAsk(null);
    setChoiceRefused(null);
  }

  function tellDone(words: string, more: Told['more'] = null) {
    setSaid({ words, more });
    focusAfter.current = 'mc-said';
  }

  function tellFailed(words: string) {
    setSaid({ words, tone: 'fail' });
    focusAfter.current = 'mc-said';
  }

  function keepAsking(id: string, error: unknown, words: string) {
    setAsking((was) =>
      was?.id === id
        ? {
            ...was,
            failed:
              error instanceof ApiError && error.status === 403 ? t('eventMenu.forbidden') : words,
          }
        : was,
    );
    focusAfter.current = `mc-ask-failed-${id}`;
  }

  function failedLine(error: unknown, button: string): string {
    return error instanceof ApiError && error.status === 403
      ? t('eventMenu.forbidden')
      : t('eventMenu.failedSave', { button });
  }

  /** A course or dish another page removed: the menu as it now stands, and the panel closed. */
  function gone(error: unknown): boolean {
    if (!(error instanceof ApiError) || error.status !== 404) return false;
    setOpen(null);
    api.menu(event.id).then(onMenu, () => undefined);

    return true;
  }

  function close() {
    if (open == null) return;
    const back =
      open.kind === 'addDish'
        ? `mc-add-dish-${open.courseId}`
        : open.kind === 'editDish'
          ? `mc-edit-${open.dishId}`
          : open.kind === 'variant'
            ? open.variantId == null
              ? `mc-addv-${open.dishId}`
              : `mc-vedit-${open.variantId}`
            : open.kind === 'choice'
              ? open.choiceId == null
                ? `mc-addch-${open.dishId}`
                : `mc-chedit-${open.choiceId}`
              : open.from;
    setOpen(null);
    focusAfter.current = back;
  }

  function pressAddCourse(at: 'top' | 'end') {
    settle();
    if (!canAddCourse(courses)) {
      setRefused({ kind: 'limit', at });
      return;
    }
    setSaid(null);
    setOpen({
      kind: 'addCourse',
      courseId: null,
      from: at === 'top' ? 'mc-add-course' : 'mc-add-course-end',
      form: { name: '', servedAt: '' },
      own: [],
      pair: null,
      move: null,
      pressed: false,
      failed: null,
      full: false,
      busy: false,
    });
    focusAfter.current = 'mc-panel-title';
  }

  function openEditCourse(course: MenuCourse) {
    settle();
    setSaid(null);
    setOpen({
      kind: 'editCourse',
      courseId: course.id,
      from: `mc-edit-${course.id}`,
      form: { name: course.name, servedAt: course.servedAt ?? '' },
      own: ownRowsOf(course.ownItems),
      pair: course.picksClose == null ? null : defaultForm(course),
      move: null,
      pressed: false,
      failed: null,
      full: false,
      busy: false,
    });
    focusAfter.current = 'mc-panel-title';
  }

  function openAddDish(course: MenuCourse) {
    settle();
    setSaid(null);
    setOpen({
      kind: 'addDish',
      courseId: course.id,
      tab: 'library',
      query: '',
      form: blankDishForm(currency),
      onlyEvent: false,
      pressed: false,
      failed: null,
      asking: null,
      added: '',
      busy: false,
    });
    focusAfter.current = 'mc-panel-title';
  }

  function openEditDish(course: MenuCourse, dish: MenuDish) {
    settle();
    setSaid(null);
    setOpen({
      kind: 'editDish',
      courseId: course.id,
      dishId: dish.id,
      form: {
        name: dish.name,
        description: dish.description ?? '',
        allergens: dish.allergens ?? [],
        none: dish.allergens != null && dish.allergens.length === 0,
        diets: dish.diets,
        amount: '',
        currency,
      },
      items: rowsOf(dish.items),
      pressed: false,
      failed: null,
      busy: false,
    });
    focusAfter.current = 'mc-panel-title';
  }

  function datesOf(course: MenuCourse): DefaultDates {
    const stored = course.default?.chooseBy ?? null;

    return {
      today: dayIn(new Date(), event.timeZone),
      event: dayIn(new Date(event.startsAt), event.timeZone),
      stored,
      locked:
        stored != null && course.picksClose?.source === 'chooseBy' && course.picksClose.closed,
    };
  }

  const day = (date: string): string => dayWords(date, dateLocale());

  async function saveCourse(confirmMove = false) {
    if (open == null || (open.kind !== 'addCourse' && open.kind !== 'editCourse') || open.busy)
      return;
    const pairCourse = open.kind === 'editCourse' ? openCourse : null;
    const pairErrors =
      open.pair == null || pairCourse == null
        ? null
        : checkDefault(open.pair, pairCourse, datesOf(pairCourse), t, day);
    const problem =
      firstCourseProblem(courseProblems(open.form)) ??
      firstItemProblem(open.own, ownItemProblems(open.own), true) ??
      (pairErrors != null &&
      hasDefaultProblem(pairErrors) &&
      open.pair != null &&
      pairCourse != null
        ? firstDefaultProblem(pairErrors, open.pair, pairCourse)
        : null);
    if (problem != null) {
      setOpen({ ...open, pressed: true, failed: null, full: false });
      focusAfter.current = problem;
      return;
    }
    const adding = open.kind === 'addCourse';
    const details = { name: open.form.name.trim(), servedAt: servedTime(open.form.servedAt) };
    setOpen({ ...open, pressed: true, busy: true, failed: null, full: false });
    const sent =
      open.pair == null || pairCourse == null ? undefined : sentDefault(open.pair, pairCourse);

    try {
      if (adding) {
        const changed = await api.addMenuCourse(event.id, details);
        onMenu(changed.menu);
        setOpen(null);
        const all = changed.menu.courses.length;
        const at = changed.menu.courses.findIndex((one) => one.id === changed.courseId);
        tellDone(t('eventMenu.courseAdded', { name: details.name, n: at + 1, count: all }));
        return;
      }
      const course = openCourse;
      if (course == null) return;
      const changed = await api.changeMenuCourse(event.id, course.id, {
        ...details,
        answer: course.answer,
        skippable: course.skippable,
        ownItems: open.own.map((one) => one.name.trim()),
        ...(sent == null ? {} : { default: sent }),
        ...(confirmMove ? { confirmMove } : {}),
      });
      onMenu(changed.menu);
      setOpen(null);
      tellDone(
        open.move != null && confirmMove
          ? moveWords(t, open.move).done
          : t('eventMenu.saved', { name: details.name }),
      );
    } catch (error) {
      if (gone(error)) return;
      if (error instanceof ApiError && error.is('menu_default_move') && sent?.dish != null) {
        const course = openCourse;
        const was = course?.default ?? null;
        const problem = error.problem;
        if (course != null && was != null) {
          setOpen((now) =>
            now == null || now.kind !== 'editCourse'
              ? now
              : {
                  ...now,
                  busy: false,
                  move: {
                    move: problem?.move ?? 0,
                    back: problem?.back ?? 0,
                    from: pickWords(course, was),
                    to: pickWords(course, {
                      dish: sent.dish ?? '',
                      variant: sent.variant ?? null,
                      options: sent.options ?? [],
                    }),
                    on: day(was.chooseBy),
                  },
                },
          );
          return;
        }
      }
      if (error instanceof ApiError && error.is('menu_course_limit')) {
        setOpen((now) => (now == null ? now : { ...now, busy: false, full: true }));
        focusAfter.current = 'mc-form-full';
        return;
      }
      setOpen((now) =>
        now == null
          ? now
          : {
              ...now,
              busy: false,
              failed: failedLine(
                error,
                adding ? t('eventMenu.addCourse') : t('eventMenu.saveChanges'),
              ),
            },
      );
      focusAfter.current = 'mc-failed';
    }
  }

  async function changeSettings(course: MenuCourse, answer: MenuAnswer, skippable: boolean) {
    settle();
    try {
      const changed = await api.changeMenuCourse(event.id, course.id, {
        name: course.name,
        servedAt: course.servedAt,
        answer,
        skippable,
      });
      onMenu(changed.menu);
    } catch (error) {
      if (gone(error)) return;
      if (error instanceof ApiError && error.is('menu_same_one_dish')) {
        api.menu(event.id).then(onMenu, () => undefined);
        return;
      }
      tellFailed(
        error instanceof ApiError && error.status === 403
          ? t('eventMenu.forbidden')
          : t('eventMenu.failedChange'),
      );
    }
  }

  async function addFromLibrary(course: MenuCourse, dish: Dish) {
    if (open?.kind !== 'addDish' || open.busy) return;
    const was = course.answer;
    setOpen({ ...open, busy: true, failed: null });

    try {
      const changed = await api.addMenuDish(event.id, course.id, { libraryDishId: dish.id });
      onMenu(changed.menu);
      const now = changed.menu.courses.find((one) => one.id === course.id);
      const words = `${t('eventMenu.addedTo', { dish: dish.name, course: course.name })} ${t('dishItems.noItems')}`;
      const also =
        was === 'same' && now?.answer === 'choose'
          ? ` ${t('eventMenu.nowChoose', { course: course.name, count: now.dishes.length })}`
          : '';
      setOpen((then) =>
        then?.kind === 'addDish' ? { ...then, busy: false, added: `${words}${also}` } : then,
      );
    } catch (error) {
      if (gone(error)) return;
      if (error instanceof ApiError && error.is('menu_dish_on_course')) {
        api.menu(event.id).then(onMenu, () => undefined);
        setOpen((then) => (then?.kind === 'addDish' ? { ...then, busy: false } : then));
        return;
      }
      setOpen((then) =>
        then?.kind === 'addDish'
          ? { ...then, busy: false, failed: failedLine(error, t('eventMenu.add')) }
          : then,
      );
      focusAfter.current = 'mc-failed';
    }
  }

  async function saveNewDish(anyway = false) {
    if (open?.kind !== 'addDish' || openCourse == null || open.busy) return;
    const course = openCourse;
    const prices = library?.prices === true && !open.onlyEvent;
    const problem = firstDishProblem(dishProblems(open.form, language, prices));
    if (problem != null) {
      setOpen({ ...open, pressed: true, failed: null, asking: null });
      focusAfter.current = problem;
      return;
    }
    const match =
      open.onlyEvent || anyway ? null : sameNamedDish(open.form.name, library?.dishes ?? [], null);
    if (match != null) {
      setOpen({
        ...open,
        pressed: true,
        asking: sharedLine(t, match.dish.name, match.archivedOnly),
      });
      focusAfter.current = 'mc-asking';
      return;
    }
    const details = dishDetailsOf(open.form, language, prices, anyway);
    const onlyEvent = open.onlyEvent;
    setOpen({ ...open, pressed: true, busy: true, failed: null, asking: null });

    try {
      const changed = await api.addMenuDish(event.id, course.id, {
        ...details,
        onlyForEvent: onlyEvent,
      });
      onMenu(changed.menu);
      if (!onlyEvent && organisation != null)
        api.dishes(organisation.id).then(
          (found) => {
            setLibrary({ dishes: found.dishes, prices: found.seesPrices });
            setLibraryFailed(false);
          },
          () => undefined,
        );
      setOpen(null);
      const now = changed.menu.courses.find((one) => one.id === course.id);
      tellDone(
        t(onlyEvent ? 'eventMenu.addedTo' : 'eventMenu.addedSaved', {
          dish: details.name,
          course: course.name,
        }),
        course.answer === 'same' && now?.answer === 'choose'
          ? t('eventMenu.nowChoose', { course: course.name, count: now.dishes.length })
          : null,
      );
    } catch (error) {
      if (gone(error)) return;
      if (error instanceof ApiError && error.is('dish_name_shared')) {
        setOpen((then) =>
          then?.kind === 'addDish'
            ? {
                ...then,
                busy: false,
                asking: sharedLine(
                  t,
                  error.problem.sharedWith ?? '',
                  error.problem.archived === true,
                ),
              }
            : then,
        );
        focusAfter.current = 'mc-asking';
        return;
      }
      setOpen((then) =>
        then?.kind === 'addDish'
          ? { ...then, busy: false, failed: failedLine(error, t('eventMenu.addDish')) }
          : then,
      );
      focusAfter.current = 'mc-failed';
    }
  }

  function editProblems(form: DishForm, dishId: string) {
    const found = dishProblems(form, language, false);
    const ways = openCourse?.dishes.find((one) => one.id === dishId)?.variants.length ?? 0;

    return ways > 0 ? { ...found, contains: null, clashes: [] } : found;
  }

  async function saveDish() {
    if (open?.kind !== 'editDish' || openCourse == null || open.busy) return;
    const editing = openCourse.dishes.find((one) => one.id === open.dishId);
    const problem =
      firstDishProblem(editProblems(open.form, open.dishId)) ??
      (editing == null
        ? null
        : firstItemProblem(open.items, dishItemProblems(open.items, editing, orList), false));
    if (problem != null) {
      setOpen({ ...open, pressed: true, failed: null });
      focusAfter.current = problem;
      return;
    }
    const { lastPrice: _price, ...details } = dishDetailsOf(open.form, language, false, false);
    setOpen({ ...open, pressed: true, busy: true, failed: null });

    try {
      const changed: MenuChange = await api.changeMenuDish(event.id, open.dishId, {
        ...details,
        items: sentItems(open.items),
      });
      onMenu(changed.menu);
      setOpen(null);
      tellDone(
        t('eventMenu.saved', { name: details.name }),
        unwarnedLine(t, i18n.language, details.name, changed.unwarned),
      );
    } catch (error) {
      if (gone(error)) return;
      setOpen((then) =>
        then?.kind === 'editDish'
          ? { ...then, busy: false, failed: failedLine(error, t('eventMenu.saveChanges')) }
          : then,
      );
      focusAfter.current = 'mc-failed';
    }
  }

  async function move(at: number, to: number, focus: string | null) {
    settle();
    const target = moveTarget(at, to, courses.length);
    const course = courses[at];
    if (target == null || course == null) return;

    try {
      const changed = await api.moveMenuCourse(event.id, course.id, target);
      onMenu(changed.menu);
      setSaid({
        words: t('eventMenu.moved', {
          name: course.name,
          n: target + 1,
          count: changed.menu.courses.length,
        }),
      });
      focusAfter.current = focus;
    } catch (error) {
      if (gone(error)) return;
      setSaid({
        words:
          error instanceof ApiError && error.status === 403
            ? t('eventMenu.forbidden')
            : t('eventMenu.failedMove', { name: course.name, n: at + 1, count: courses.length }),
        tone: 'fail',
      });
    }
  }

  function askRemove(dish: MenuDish) {
    settle();
    setSaid(null);
    const course = courses.find((one) => one.dishes.some((each) => each.id === dish.id));
    if (course != null && isDefaultDish(course, dish.id)) {
      setRefused({ kind: 'defaultDish', id: dish.id });
      return;
    }
    if (dishPicked(dish)) {
      setRefused({ kind: 'dish', id: dish.id });
      return;
    }
    setAsking({ kind: 'dish', id: dish.id, failed: null });
    focusAfter.current = `mc-ask-${dish.id}`;
  }

  async function remove(course: MenuCourse, dish: MenuDish) {
    try {
      const changed = await api.removeMenuDish(event.id, dish.id);
      onMenu(changed.menu);
      setAsking(null);
      if (open?.kind === 'editDish' && open.dishId === dish.id) setOpen(null);
      tellDone(t('eventMenu.removed', { dish: dish.name, course: course.name }));
    } catch (error) {
      if (error instanceof ApiError && error.is('menu_dish_picked')) {
        setAsking(null);
        setRefused({ kind: 'dish', id: dish.id });
        return;
      }
      if (error instanceof ApiError && error.is('menu_is_default')) {
        setAsking(null);
        setRefused({ kind: 'defaultDish', id: dish.id });
        api.menu(event.id).then(onMenu, () => undefined);
        return;
      }
      if (gone(error)) {
        setAsking(null);
        return;
      }
      keepAsking(dish.id, error, t('eventMenu.failedRemove'));
    }
  }

  function openVariant(
    course: MenuCourse,
    dish: MenuDish,
    mode: VariantMode,
    variant: ShownVariant | null,
  ) {
    settle();
    setSaid(null);
    const blank = blankVariantForm(event.currency);
    setOpen({
      kind: 'variant',
      mode,
      courseId: course.id,
      dishId: dish.id,
      variantId: variant?.id ?? null,
      forms:
        variant != null
          ? [variantFormOf(variant, variant.price, language, event.currency)]
          : mode === 'addFirst'
            ? [blank, blank]
            : [blank],
      pressed: false,
      failed: null,
      busy: false,
    });
    focusAfter.current = 'mc-panel-title';
  }

  function addVariant(course: MenuCourse, dish: MenuDish) {
    const outcome = addVariantOutcome(dish.variants, dish.picked);
    if (outcome !== 'open' || variantLeavesDefault(course, dish.id, null, false)) {
      settle();
      setSaid(null);
      setAddRefused({ dishId: dish.id, outcome: outcome === 'open' ? 'default' : outcome });
      return;
    }
    openVariant(course, dish, dish.variants.length === 0 ? 'addFirst' : 'add', null);
  }

  function variantOthers(dish: MenuDish | null, variantId: string | null, mode: VariantMode) {
    if (dish == null || mode === 'addFirst') return [];

    return dish.variants.filter((one) => one.id !== variantId);
  }

  async function saveVariants() {
    if (open?.kind !== 'variant' || openCourse == null || open.busy) return;
    const dish = openCourse.dishes.find((one) => one.id === open.dishId) ?? null;
    const problems = variantProblems(
      open.forms,
      variantOthers(dish, open.variantId, open.mode),
      language,
      prices,
    );
    if (hasProblem(problems)) {
      setOpen({ ...open, pressed: true, failed: null });
      focusAfter.current = firstVariantProblem(problems, open.forms);
      return;
    }
    if (
      open.variantId != null &&
      variantLeavesDefault(
        openCourse,
        open.dishId,
        open.variantId,
        open.forms[0]?.for === 'children',
      )
    ) {
      setOpen({ ...open, pressed: true, failed: null });
      focusAfter.current = `${variantPrefix(0)}for-children`;
      return;
    }
    const details = open.forms.map((form) => variantDetailsOf(form, 'event', language, prices));
    const button = variantSaveLabel(t, open.mode);
    setOpen({ ...open, pressed: true, busy: true, failed: null });

    try {
      const [edited] = details;
      const changed =
        open.variantId == null || edited == null
          ? await api.addMenuVariants(event.id, open.dishId, details)
          : await api.changeMenuVariant(event.id, open.variantId, edited);
      onMenu(changed.menu);
      setOpen(null);
      const dishName = dish?.name ?? '';
      const [first, second] = details;
      if (open.mode === 'addFirst' && first != null && second != null)
        tellDone(
          t('dishVariants.addedTwo', {
            count: 2,
            dish: dishName,
            first: first.name,
            second: second.name,
          }),
        );
      else if (open.mode === 'add' && first != null)
        tellDone(t('dishVariants.added', { variant: first.name, dish: dishName }));
      else if (first != null)
        tellDone(
          t('dishVariants.saved', { variant: first.name }),
          changed.unwarned == null
            ? null
            : t('dishVariants.unwarned', {
                count: changed.unwarned.count,
                dish: dishName,
                variant: first.name,
                allergens: allergensInSentence(
                  t,
                  i18n.language,
                  DISH_ALLERGENS.filter((code) => changed.unwarned?.allergens.includes(code)),
                ),
              }),
        );
    } catch (error) {
      if (gone(error)) return;
      if (error instanceof ApiError && error.is('menu_dish_picked')) {
        setOpen(null);
        setAddRefused({ dishId: open.dishId, outcome: 'picked' });
        return;
      }
      if (error instanceof ApiError && error.is('variant_limit')) {
        setOpen(null);
        setAddRefused({ dishId: open.dishId, outcome: 'limit' });
        return;
      }
      if (error instanceof ApiError && error.is('menu_is_default')) {
        api.menu(event.id).then(onMenu, () => undefined);
        if (open.variantId == null) {
          setOpen(null);
          setAddRefused({ dishId: open.dishId, outcome: 'default' });
          return;
        }
        setOpen((then) => (then?.kind === 'variant' ? { ...then, busy: false } : then));
        focusAfter.current = `${variantPrefix(0)}for-children`;
        return;
      }
      setOpen((then) =>
        then?.kind === 'variant'
          ? { ...then, busy: false, failed: failedLine(error, button) }
          : then,
      );
      focusAfter.current = 'mc-failed';
    }
  }

  function dropOpenRow(dishId: string, choiceId: string | null) {
    setOpen((then) =>
      then?.kind === 'editDish' && then.dishId === dishId
        ? { ...then, items: withoutRow(then.items, choiceId) }
        : then,
    );
  }

  function askRemoveVariant(dish: MenuDish, variant: ShownVariant) {
    settle();
    setSaid(null);
    const course = courses.find((one) => one.dishes.some((each) => each.id === dish.id));
    if (course != null && isDefaultVariant(course, dish.id, variant.id)) {
      setVariantAsk({
        variantId: variant.id,
        kind: 'refused',
        lines: [],
        said: t('courseDefault.refuseVariant', { variant: variant.name, course: course.name }),
      });
      return;
    }
    const outcome = removeVariantOutcome(dish.variants, variant);
    if (outcome.kind === 'refused') {
      setVariantAsk({ variantId: variant.id, kind: 'refused', lines: outcome.lines });
      return;
    }
    setVariantAsk({ variantId: variant.id, kind: outcome.kind });
    focusAfter.current = `mc-vask-${variant.id}`;
  }

  async function confirmVariant(dish: MenuDish, variant: ShownVariant) {
    const staying = dish.variants.find((one) => one.id !== variant.id) ?? null;
    const folding = dish.variants.length <= 2;

    try {
      const changed = await api.removeMenuVariant(event.id, variant.id);
      onMenu(changed.menu);
      setVariantAsk(null);
      if (folding) dropOpenRow(dish.id, null);
      if (open?.kind === 'variant' && open.dishId === dish.id) setOpen(null);
      if (folding && staying != null)
        tellDone(
          t(prices ? 'dishVariants.foldedCost' : 'dishVariants.folded', {
            dish: dish.name,
            variant: staying.name,
          }),
        );
      else tellDone(t('dishVariants.removed', { variant: variant.name, dish: dish.name }));
    } catch (error) {
      if (error instanceof ApiError && error.is('variant_picked')) {
        setVariantAsk({ variantId: variant.id, kind: 'refused', lines: ['picked'] });
        return;
      }
      if (error instanceof ApiError && error.is('menu_is_default')) {
        const course = courses.find((one) => one.dishes.some((each) => each.id === dish.id));
        setVariantAsk({
          variantId: variant.id,
          kind: 'refused',
          lines: [],
          said: t('courseDefault.refuseVariant', {
            variant: variant.name,
            course: course?.name ?? '',
          }),
        });
        api.menu(event.id).then(onMenu, () => undefined);
        return;
      }
      if (error instanceof ApiError && error.is('variant_last_everyone')) {
        setVariantAsk({ variantId: variant.id, kind: 'refused', lines: ['lastEveryone'] });
        return;
      }
      if (gone(error)) {
        setVariantAsk(null);
        return;
      }
      setVariantAsk(null);
      tellFailed(
        error instanceof ApiError && error.status === 403
          ? t('eventMenu.forbidden')
          : t('dishVariants.failedChange', { dish: dish.name, count: dish.variants.length }),
      );
    }
  }

  const variantHandlers: VariantHandlers = {
    prices,
    language,
    ask: variantAsk,
    addRefused,
    lit: open?.kind === 'variant' ? open.variantId : null,
    onAdd: (dish) => {
      const course = courses.find((one) => one.dishes.some((d) => d.id === dish.id));
      if (course != null) addVariant(course, dish);
    },
    onEdit: (dish, variant) => {
      const course = courses.find((one) => one.dishes.some((d) => d.id === dish.id));
      if (course != null) openVariant(course, dish, 'edit', variant);
    },
    onRemove: askRemoveVariant,
    onKeep: (variant) => {
      setVariantAsk(null);
      focusAfter.current = `mc-vremove-${variant.id}`;
    },
    onConfirm: (dish, variant) => void confirmVariant(dish, variant),
  };

  function openChoicePanel(course: MenuCourse, dish: MenuDish, choice: MenuDishChoice | null) {
    settle();
    setSaid(null);
    setOpen({
      kind: 'choice',
      courseId: course.id,
      dishId: dish.id,
      choiceId: choice?.id ?? null,
      form: choice == null ? blankChoiceForm() : choiceFormOf(choice),
      openKey: null,
      binRefused: null,
      optionsFull: false,
      pressed: false,
      failed: null,
      busy: false,
    });
    focusAfter.current = 'mc-panel-title';
  }

  function addChoice(course: MenuCourse, dish: MenuDish) {
    const outcome = addChoiceOutcome(dish);
    if (outcome !== 'open') {
      settle();
      setSaid(null);
      setChoiceRefused({ dishId: dish.id, outcome });
      return;
    }
    openChoicePanel(course, dish, null);
  }

  function changeChoice(now: ChoiceOpen, next: Partial<ChoiceOpen>) {
    setOpen({ ...now, binRefused: null, optionsFull: false, ...next });
  }

  function pressBin(now: ChoiceOpen, key: string) {
    const option = now.form.options.find((one) => one.key === key);
    const saved = openChoice?.options.find((one) => one.id === option?.id);
    const isDefault =
      openCourse != null && saved != null && isDefaultOption(openCourse, now.dishId, saved.id);
    if (saved != null && (isDefault || optionPicked(saved))) {
      setOpen({ ...now, binRefused: key, optionsFull: false });
      focusAfter.current = `ch-${key}-bin`;
      return;
    }
    const options = now.form.options.filter((one) => one.key !== key);
    const at = now.form.options.findIndex((one) => one.key === key);
    changeChoice(now, {
      form: { ...now.form, options },
      openKey: now.openKey === key ? null : now.openKey,
    });
    const after = options[Math.min(at, options.length - 1)];
    focusAfter.current = after == null ? 'ch-add-option' : `ch-${after.key}-name`;
  }

  function pressAddOption(now: ChoiceOpen) {
    if (now.form.options.length >= CHOICE_OPTIONS_MAXIMUM) {
      setOpen({ ...now, binRefused: null, optionsFull: true });
      focusAfter.current = 'ch-add-option';
      return;
    }
    const added: ChoiceOptionForm = blankOptionForm();
    changeChoice(now, { form: { ...now.form, options: [...now.form.options, added] } });
    focusAfter.current = `ch-${added.key}-name`;
  }

  function optionLines(lines: readonly UnwarnedOption[]): string[] {
    return lines.map((line) =>
      t('dishChoices.unwarned', {
        count: line.count,
        option: line.option,
        allergens: allergensInSentence(
          t,
          i18n.language,
          DISH_ALLERGENS.filter((code) => line.allergens.includes(code)),
        ),
      }),
    );
  }

  async function saveChoice() {
    if (open?.kind !== 'choice' || openDish == null || open.busy) return;
    const was = openChoice;
    const problems = choiceProblems(open.form, was);
    if (hasChoiceProblem(problems)) {
      const problem = firstChoiceProblem(problems, open.form, was);
      setOpen({
        ...open,
        pressed: true,
        failed: null,
        binRefused: null,
        openKey: problem?.open ?? open.openKey,
      });
      focusAfter.current = problem?.id ?? null;
      return;
    }
    const leaves = choiceLeavesDefault(openCourse, open.dishId, open.form, was, problems);
    if (leaves != null) {
      setOpen({ ...open, pressed: true, failed: null, binRefused: null });
      focusAfter.current = defaultControl(leaves, open.form, was);
      return;
    }
    const details = choiceDetailsOf(open.form, was);
    const button = choiceSaveLabel(t, open.choiceId == null, savesAsDraft(open.form, was));
    const dish = openDish;
    setOpen({ ...open, pressed: true, busy: true, failed: null });

    try {
      const changed =
        open.choiceId == null
          ? await api.addMenuChoice(event.id, open.dishId, details)
          : await api.changeMenuChoice(event.id, open.choiceId, details);
      onMenu(changed.menu);
      setOpen(null);
      const savedId = changed.choiceId ?? open.choiceId;
      const all =
        changed.menu.courses.flatMap((one) => one.dishes).find((one) => one.id === dish.id)
          ?.choices ?? [];
      const at = all.findIndex((one) => one.id === savedId);
      const saved = all[at];
      if (saved?.draft === true)
        tellDone(
          t('dishChoices.draftSaved', {
            named:
              saved.question === ''
                ? t('dishChoices.numbered', { n: at + 1 })
                : t('dishChoices.quoted', { question: saved.question }),
            dish: dish.name,
          }),
        );
      else if (open.choiceId == null)
        tellDone(t('dishChoices.added', { question: details.question, dish: dish.name }));
      else
        tellDone(
          t('dishChoices.saved', { question: details.question }),
          optionLines(changed.unwarnedOptions ?? []),
        );
    } catch (error) {
      if (gone(error)) return;
      if (error instanceof ApiError && error.is('menu_dish_picked')) {
        setOpen(null);
        setChoiceRefused({ dishId: open.dishId, outcome: 'picked' });
        return;
      }
      if (error instanceof ApiError && error.is('choice_limit')) {
        setOpen(null);
        setChoiceRefused({ dishId: open.dishId, outcome: 'limit' });
        return;
      }
      if (error instanceof ApiError && (error.status === 409 || error.status === 422)) {
        api.menu(event.id).then(onMenu, () => undefined);
        setOpen((then) => (then?.kind === 'choice' ? { ...then, busy: false } : then));
        focusAfter.current = 'mc-panel-title';
        return;
      }
      setOpen((then) =>
        then?.kind === 'choice'
          ? { ...then, busy: false, failed: failedLine(error, button) }
          : then,
      );
      focusAfter.current = 'mc-failed';
    }
  }

  function askRemoveChoice(choice: MenuDishChoice) {
    settle();
    setSaid(null);
    const kind = removeChoiceOutcome(choice);
    setChoiceAsk({ choiceId: choice.id, kind });
    if (kind === 'ask') focusAfter.current = `mc-chask-${choice.id}`;
  }

  async function confirmChoice(dish: MenuDish, choice: MenuDishChoice) {
    try {
      const changed = await api.removeMenuChoice(event.id, choice.id);
      onMenu(changed.menu);
      setChoiceAsk(null);
      dropOpenRow(dish.id, choice.id);
      if (open?.kind === 'choice' && open.choiceId === choice.id) setOpen(null);
      tellDone(t('dishChoices.removed', { question: choice.question, dish: dish.name }));
    } catch (error) {
      if (error instanceof ApiError && error.is('choice_answered')) {
        setChoiceAsk({ choiceId: choice.id, kind: 'answered' });
        return;
      }
      if (gone(error)) {
        setChoiceAsk(null);
        return;
      }
      setChoiceAsk(null);
      tellFailed(failedLine(error, t('dishChoices.removeChoice')));
    }
  }

  const courseOf = (dish: MenuDish) =>
    courses.find((one) => one.dishes.some((d) => d.id === dish.id));

  const choiceHandlers: ChoiceHandlers = {
    ask: choiceAsk,
    addRefused: choiceRefused,
    lit: open?.kind === 'choice' ? open.choiceId : null,
    onAdd: (dish) => {
      const course = courseOf(dish);
      if (course != null) addChoice(course, dish);
    },
    onEdit: (dish, choice) => {
      const course = courseOf(dish);
      if (course != null) openChoicePanel(course, dish, choice);
    },
    onRemove: (_dish, choice) => askRemoveChoice(choice),
    onKeep: (choice) => {
      setChoiceAsk(null);
      focusAfter.current = `mc-chremove-${choice.id}`;
    },
    onConfirm: (dish, choice) => void confirmChoice(dish, choice),
  };

  function askDelete(course: MenuCourse) {
    settle();
    setSaid(null);
    if (coursePicked(course)) {
      setRefused({ kind: 'course', id: course.id });
      return;
    }
    setAsking({ kind: 'course', id: course.id, failed: null });
    focusAfter.current = `mc-ask-${course.id}`;
  }

  async function deleteCourse(course: MenuCourse) {
    try {
      const changed = await api.deleteMenuCourse(event.id, course.id);
      onMenu(changed.menu);
      setAsking(null);
      if (open?.courseId === course.id) setOpen(null);
      tellDone(t('eventMenu.deleted', { course: course.name }));
    } catch (error) {
      if (error instanceof ApiError && error.is('menu_course_picked')) {
        setAsking(null);
        setRefused({ kind: 'course', id: course.id });
        return;
      }
      if (gone(error)) {
        setAsking(null);
        return;
      }
      keepAsking(course.id, error, t('eventMenu.failedDelete'));
    }
  }

  const limitLine = (at: 'top' | 'end') =>
    refused?.kind === 'limit' && refused.at === at
      ? t('eventMenu.atLimit', { most: MENU_COURSE_MAXIMUM })
      : '';

  return (
    <>
      <header className="gs-top mc-top">
        <div className="mn-head">
          <h1 className="gs-title" ref={title} tabIndex={-1}>
            {t('eventMenu.title')}
          </h1>
          <p className="mc-counts">
            {courses.length > 0 && (
              <span>
                {t('eventMenu.counts', {
                  courses: t('eventMenu.courses', { count: counts.courses }),
                  dishes: t('eventMenu.dishes', { count: counts.dishes }),
                })}
              </span>
            )}
            {counts.ready < counts.courses && (
              <span className="mc-ready-line">
                <span className="mc-ring is-empty" aria-hidden="true" />
                {t('eventMenu.ready', { ready: counts.ready, count: counts.courses })}
              </span>
            )}
            {headClose != null && (
              <span className="mc-picks-head">
                <Glyph name={headClose.closed ? 'lock' : 'clock'} size={15} weight={2.4} />
                {headClose.closed
                  ? t('eventMenu.picksHeadClosed', { date: closeWords(headClose.at) })
                  : t(menuCloseFrom(courses) ? 'eventMenu.picksHeadFrom' : 'eventMenu.picksHead', {
                      date: closeWords(headClose.at),
                    })}
              </span>
            )}
            {refreshing && <Refreshing />}
          </p>
        </div>
        {courses.some((course) => course.picksClose != null) && (
          <Link
            id="mc-preview"
            className="gs-pill is-secondary mc-preview"
            to={`/preview/events/${encodeURIComponent(event.id)}/meals`}
          >
            <Glyph name="eye" size={16} weight={2.4} />
            {t('eventMenu.previewAsGuest')}
          </Link>
        )}
        {manage && courses.length > 0 && (
          <div className="mc-add-wrap">
            <button
              id="mc-add-course"
              type="button"
              className="gs-pill is-primary mc-add-course"
              aria-describedby="mc-limit-top"
              onClick={() => pressAddCourse('top')}
            >
              <Glyph name="plus" size={16} weight={2.6} />
              {t('eventMenu.addCourse')}
            </button>
            <LimitLine id="mc-limit-top" words={limitLine('top')} />
          </div>
        )}
      </header>
      {!manage && (
        <p className="mn-lock">
          <Glyph name="lock" size={16} weight={2.2} />
          {event.roleOnEvent == null
            ? t('eventMenu.lock', {
                role: organisation == null ? '' : roleName(t, organisation.role),
              })
            : t('eventMenu.lockOnEvent', { role: t(`eventPeople.role.${event.roleOnEvent}`) })}
        </p>
      )}
      <Said said={said} />
      <div className="mc-picks-said" role="status">
        {closeMoved != null && (
          <p className="mc-said-line">
            <Glyph name="clock" size={17} weight={2.4} />
            {t('eventMenu.picksMoved', {
              date: closeWords(closeMoved.at),
              was: closeWords(closeMoved.was),
            })}
          </p>
        )}
      </div>
      <div className={open == null ? 'mn-split mc-split' : 'mn-split mc-split is-open'}>
        <div className="mn-list mc-list">
          {courses.length === 0 ? (
            <div className="desk-card lib-empty mc-empty">
              <h2>{t('eventMenu.emptyTitle')}</h2>
              {manage && (
                <>
                  <p>{t('eventMenu.emptyBody')}</p>
                  <button
                    id="mc-add-course"
                    type="button"
                    className="gs-pill is-primary mc-add-course"
                    onClick={() => pressAddCourse('top')}
                  >
                    <Glyph name="plus" size={16} weight={2.6} />
                    {t('eventMenu.addCourse')}
                  </button>
                </>
              )}
            </div>
          ) : (
            <ol className="mc-courses">
              {courses.map((course, index) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  index={index}
                  all={courses.length}
                  manage={manage}
                  timeZone={event.timeZone}
                  lit={open?.courseId === course.id}
                  litDish={open?.kind === 'editDish' ? open.dishId : null}
                  asking={
                    asking == null
                      ? null
                      : asking.kind === 'course'
                        ? asking.id === course.id
                          ? 'course'
                          : null
                        : asking.id
                  }
                  askFailed={asking?.failed ?? null}
                  refused={
                    refused == null || refused.kind === 'limit' || refused.kind === 'defaultDish'
                      ? null
                      : refused.kind === 'course'
                        ? refused.id === course.id
                          ? 'course'
                          : null
                        : refused.id
                  }
                  defaultRefused={refused?.kind === 'defaultDish' ? refused.id : null}
                  dragging={dragging === course.id}
                  onDragStart={() => setDragging(course.id)}
                  onDragEnd={() => setDragging(null)}
                  onDrop={() => {
                    const from = courses.findIndex((one) => one.id === dragging);
                    setDragging(null);
                    if (from >= 0) void move(from, index, null);
                  }}
                  onMove={(by) =>
                    void move(
                      index,
                      index + by,
                      by < 0 ? `mc-up-${course.id}` : `mc-down-${course.id}`,
                    )
                  }
                  onEdit={() => openEditCourse(course)}
                  onAskDelete={() => askDelete(course)}
                  onDelete={() => void deleteCourse(course)}
                  onKeep={(back) => {
                    setAsking(null);
                    focusAfter.current = back;
                  }}
                  onAnswer={(answer) => void changeSettings(course, answer, course.skippable)}
                  onSkip={(skip) => void changeSettings(course, course.answer, skip)}
                  onAddDish={() => openAddDish(course)}
                  onEditDish={(dish) => openEditDish(course, dish)}
                  onAskRemove={(dish) => askRemove(dish)}
                  onRemove={(dish) => void remove(course, dish)}
                  variants={variantHandlers}
                  choices={choiceHandlers}
                />
              ))}
            </ol>
          )}
          {manage && courses.length > 0 && (
            <div className="mc-add-wrap mc-add-end">
              <button
                id="mc-add-course-end"
                type="button"
                className="gs-pill is-secondary mc-add-course"
                aria-describedby="mc-limit-end"
                onClick={() => pressAddCourse('end')}
              >
                <Glyph name="plus" size={16} weight={2.6} />
                {t('eventMenu.addCourse')}
              </button>
              <LimitLine id="mc-limit-end" words={limitLine('end')} />
            </div>
          )}
        </div>
        {open == null && (
          <PicksSummary
            closeLine={
              headClose == null
                ? null
                : t(
                    headClose.closed
                      ? 'eventMenu.picksClosed'
                      : menuCloseFrom(courses)
                        ? 'eventMenu.picksCloseFrom'
                        : 'eventMenu.picksClose',
                    { date: closeWords(headClose.at) },
                  )
            }
          />
        )}
        {open != null && (
          <aside className="mn-panel mc-panel" aria-labelledby="mc-panel-title">
            <button type="button" className="desk-text mc-back" onClick={close}>
              <Glyph name="back" size={16} weight={2.4} />
              {t('eventMenu.backToMenu')}
            </button>
            <div className="mn-panel-top">
              <div className="mn-panel-names">
                {open.kind === 'choice' && open.choiceId == null && openDish != null ? (
                  <p className="mn-eyebrow">{t('dishChoices.eyebrow', { dish: openDish.name })}</p>
                ) : (
                  openCourse != null && <p className="mn-eyebrow">{openCourse.name}</p>
                )}
                <h2 id="mc-panel-title" tabIndex={-1}>
                  {open.kind === 'variant'
                    ? variantTitle(t, open, openCourse)
                    : open.kind === 'choice'
                      ? choiceTitle(t, openDish, openChoice)
                      : panelTitle(t, open)}
                </h2>
              </div>
              <button
                type="button"
                className="ev-round mn-close"
                aria-label={t('eventMenu.close')}
                onClick={close}
              >
                <Glyph name="clear" size={16} weight={2.4} />
              </button>
            </div>
            <div className="mn-panel-body">
              {(open.kind === 'addCourse' || open.kind === 'editCourse') && (
                <CourseFields
                  form={open.form}
                  adding={open.kind === 'addCourse'}
                  problems={open.pressed ? courseProblems(open.form) : null}
                  zone={zoneCity(event.timeZone)}
                  own={open.own}
                  ownProblems={open.pressed ? ownItemProblems(open.own) : null}
                  onOwn={(own) => setOpen({ ...open, own })}
                  onPatch={(next) =>
                    setOpen({ ...open, form: { ...open.form, ...next }, full: false })
                  }
                />
              )}
              {open.kind === 'editCourse' && open.pair != null && openCourse != null && (
                <DefaultFields
                  course={openCourse}
                  form={open.pair}
                  dates={datesOf(openCourse)}
                  errors={
                    open.pressed
                      ? checkDefault(open.pair, openCourse, datesOf(openCourse), t, day)
                      : null
                  }
                  zone={zoneCity(event.timeZone)}
                  day={day}
                  onPatch={(pair) => setOpen({ ...open, pair, move: null })}
                />
              )}
              {open.kind === 'editCourse' && open.move != null && (
                <MoveDialog
                  move={open.move}
                  busy={open.busy}
                  onCancel={() => {
                    setOpen({ ...open, move: null });
                    focusAfter.current = 'mc-panel-save';
                  }}
                  onMove={() => void saveCourse(true)}
                />
              )}
              {open.kind === 'addDish' && openCourse != null && (
                <AddDishPanel
                  tab={open.tab}
                  query={open.query}
                  added={open.added}
                  form={open.form}
                  onlyEvent={open.onlyEvent}
                  course={openCourse}
                  library={shownLibrary}
                  loading={library == null && !libraryFailed}
                  failed={libraryFailed}
                  onRetry={() => {
                    setLibraryFailed(false);
                    setLibraryTries((tries) => tries + 1);
                    focusAfter.current = 'mc-find';
                  }}
                  prices={library?.prices === true}
                  language={language}
                  problems={
                    open.pressed
                      ? dishProblems(
                          open.form,
                          language,
                          library?.prices === true && !open.onlyEvent,
                        )
                      : null
                  }
                  onTab={(tab) =>
                    setOpen({ ...open, tab, pressed: false, failed: null, asking: null })
                  }
                  onFind={(query) => setOpen({ ...open, query })}
                  onAdd={(dish) => void addFromLibrary(openCourse, dish)}
                  onStartNew={(name) => {
                    setOpen({ ...open, tab: 'new', form: { ...open.form, name }, added: '' });
                    focusAfter.current = 'lib-name';
                  }}
                  onPatch={(next) =>
                    setOpen({ ...open, form: { ...open.form, ...next }, asking: null })
                  }
                  onOnlyEvent={(onlyEvent) => setOpen({ ...open, onlyEvent, asking: null })}
                />
              )}
              {open.kind === 'variant' && openCourse != null && (
                <VariantPanel
                  open={open}
                  course={openCourse}
                  prices={prices}
                  language={language}
                  currency={event.currency}
                  others={(dish) => variantOthers(dish, open.variantId, open.mode)}
                  onPatch={(at, next) =>
                    setOpen({
                      ...open,
                      forms: open.forms.map((form, i) => (i === at ? { ...form, ...next } : form)),
                    })
                  }
                />
              )}
              {open.kind === 'choice' && openDish != null && (
                <ChoiceFields
                  form={open.form}
                  problems={open.pressed ? choiceProblems(open.form, openChoice) : null}
                  draft={
                    savesAsDraft(open.form, openChoice)
                      ? formDraftReasons(open.form, openChoice)
                      : null
                  }
                  ways={openDish.variants.length}
                  openKey={open.openKey}
                  binRefused={open.binRefused}
                  binWords={binDefaultWords(t, open, openCourse, openChoice)}
                  defaultLine={
                    open.pressed
                      ? choiceDefaultLine(t, open, openCourse, openDish, openChoice)
                      : null
                  }
                  optionsFull={open.optionsFull}
                  intro={
                    <ChoiceIntro
                      ways={openDish.variants.length}
                      n={open.choiceId == null ? openDish.choices.length + 1 : null}
                    />
                  }
                  onPatch={(next) => changeChoice(open, { form: { ...open.form, ...next } })}
                  onOption={(key, next) =>
                    changeChoice(open, {
                      form: {
                        ...open.form,
                        options: open.form.options.map((one) =>
                          one.key === key ? { ...one, ...next } : one,
                        ),
                      },
                    })
                  }
                  onOpen={(key) =>
                    changeChoice(open, { openKey: open.openKey === key ? null : key })
                  }
                  onBin={(key) => pressBin(open, key)}
                  onAddOption={() => pressAddOption(open)}
                />
              )}
              {open.kind === 'editDish' && openCourse != null && (
                <EditDishFields
                  form={open.form}
                  dish={openCourse.dishes.find((one) => one.id === open.dishId) ?? null}
                  language={language}
                  problems={open.pressed ? editProblems(open.form, open.dishId) : null}
                  items={open.items}
                  itemProblems={
                    open.pressed && editingDish != null
                      ? dishItemProblems(open.items, editingDish, orList)
                      : null
                  }
                  onItems={(items) => setOpen({ ...open, items })}
                  onPatch={(next) => setOpen({ ...open, form: { ...open.form, ...next } })}
                />
              )}
            </div>
            {open.kind === 'addDish' && open.tab === 'library' ? (
              open.failed != null && (
                <div className="mn-panel-foot">
                  <p id="mc-failed" className="mn-failed" role="alert" tabIndex={-1}>
                    <Glyph name="alert" size={16} weight={2.2} />
                    {open.failed}
                  </p>
                </div>
              )
            ) : (
              <div className="mn-panel-foot">
                {open.kind === 'addDish' && open.asking != null && (
                  <div className="mn-ask lib-ask">
                    <p id="mc-asking" tabIndex={-1}>
                      {open.asking}
                    </p>
                    <div className="mn-ask-acts">
                      <button
                        type="button"
                        className="desk-text"
                        onClick={() => {
                          setOpen({ ...open, asking: null });
                          focusAfter.current = 'lib-name';
                        }}
                      >
                        {t('eventMenu.cancel')}
                      </button>
                      <button
                        type="button"
                        className="gs-pill is-primary"
                        aria-busy={open.busy || undefined}
                        onClick={() => void saveNewDish(true)}
                      >
                        {t('menuLibrary.addAnyway')}
                      </button>
                    </div>
                  </div>
                )}
                {open.failed != null && (
                  <p id="mc-failed" className="mn-failed" role="alert" tabIndex={-1}>
                    <Glyph name="alert" size={16} weight={2.2} />
                    {open.failed}
                  </p>
                )}
                {!(open.kind === 'addDish' && open.asking != null) && (
                  <div className="mn-panel-acts">
                    <button type="button" className="desk-text" onClick={close}>
                      {t('eventMenu.cancel')}
                    </button>
                    <button
                      id="mc-panel-save"
                      type="button"
                      className="gs-pill is-primary"
                      aria-busy={open.busy || undefined}
                      aria-describedby={open.kind === 'addCourse' ? 'mc-form-full' : undefined}
                      onClick={() => {
                        if (open.kind === 'addCourse' || open.kind === 'editCourse')
                          void saveCourse();
                        else if (open.kind === 'addDish') void saveNewDish();
                        else if (open.kind === 'variant') void saveVariants();
                        else if (open.kind === 'choice') void saveChoice();
                        else void saveDish();
                      }}
                    >
                      {open.kind === 'choice'
                        ? choiceSaveLabel(
                            t,
                            open.choiceId == null,
                            savesAsDraft(open.form, openChoice),
                          )
                        : saveLabel(t, open)}
                    </button>
                  </div>
                )}
                {open.kind === 'addCourse' && (
                  <LimitLine
                    id="mc-form-full"
                    words={open.full ? t('eventMenu.atLimit', { most: MENU_COURSE_MAXIMUM }) : ''}
                    focusable
                  />
                )}
              </div>
            )}
          </aside>
        )}
      </div>
    </>
  );
}

/** The Edit choice panel's status line for a bin refused because the option is part of the course's default (sc-1362). */
function binDefaultWords(
  t: TFunction,
  open: ChoiceOpen,
  course: MenuCourse | null,
  choice: MenuDishChoice | null,
): string | null {
  const key = open.binRefused;
  const id = open.form.options.find((one) => one.key === key)?.id;
  const option = choice?.options.find((one) => one.id === id);
  if (course == null || option == null || !isDefaultOption(course, open.dishId, option.id))
    return null;

  return t('courseDefault.refuseOption', { option: option.name, course: course.name });
}

/** The Edit choice panel's line for an edit that would leave the course's default unfinished (sc-1362). */
function choiceDefaultLine(
  t: TFunction,
  open: ChoiceOpen,
  course: MenuCourse | null,
  dish: MenuDish,
  choice: MenuDishChoice | null,
): { at: 'pick' | 'required' | 'draft'; words: string } | null {
  const at = choiceLeavesDefault(
    course,
    open.dishId,
    open.form,
    choice,
    choiceProblems(open.form, choice),
  );
  if (at == null || course == null) return null;

  return { at, words: t('courseDefault.refuseDish', { dish: dish.name, course: course.name }) };
}

function defaultControl(
  at: 'pick' | 'required' | 'draft',
  form: ChoiceForm,
  was: MenuDishChoice | null,
): string {
  if (at === 'pick') return was != null && form.pick > was.pick ? 'ch-fewer' : 'ch-more';
  if (at === 'required') return 'ch-required';

  return form.question.trim() === '' ? 'ch-question' : 'ch-add-option';
}

function sharedLine(t: TFunction, name: string, archivedOnly: boolean): string {
  return t(archivedOnly ? 'menuLibrary.duplicateArchived' : 'menuLibrary.duplicate', { name });
}

function variantSaveLabel(t: TFunction, mode: VariantMode): string {
  if (mode === 'addFirst') return t('dishVariants.addVariants');

  return mode === 'add' ? t('dishVariants.addVariant') : t('dishVariants.saveVariant');
}

function VariantPanel({
  open,
  course,
  prices,
  language,
  currency,
  others,
  onPatch,
}: {
  open: Extract<Open, { kind: 'variant' }>;
  course: MenuCourse;
  prices: boolean;
  language: ReturnType<typeof moneyLanguage>;
  currency: string;
  others: (dish: MenuDish | null) => MenuDish['variants'];
  onPatch: (at: number, next: Partial<VariantForm>) => void;
}) {
  const { t } = useTranslation();
  const dish = course.dishes.find((one) => one.id === open.dishId) ?? null;
  if (dish == null) return null;
  const variant = dish.variants.find((one) => one.id === open.variantId) ?? null;

  return (
    <VariantFields
      mode={open.mode}
      dish={dish}
      forms={open.forms}
      problems={open.pressed ? variantProblems(open.forms, others(dish), language, prices) : null}
      forRefused={
        open.pressed &&
        variant != null &&
        variantLeavesDefault(course, dish.id, variant.id, open.forms[0]?.for === 'children')
          ? t('courseDefault.refuseDish', { dish: dish.name, course: course.name })
          : null
      }
      where="event"
      prices={prices}
      language={language}
      eventCurrency={currency}
      pricedIn={variant?.pricedIn ?? null}
      after={
        dish.libraryDishId != null && <p className="lib-own-copy">{t('eventMenu.copyOnly')}</p>
      }
      onPatch={onPatch}
    />
  );
}

function choiceSaveLabel(t: TFunction, adding: boolean, draft: boolean): string {
  if (draft) return t('dishChoices.saveDraft');

  return adding ? t('dishChoices.addChoiceSave') : t('dishChoices.saveChoice');
}

function choiceTitle(t: TFunction, dish: MenuDish | null, choice: MenuDishChoice | null): string {
  if (dish == null || choice == null) return t('dishChoices.addTitle');
  const question = choiceName(t, choice, dish.choices.indexOf(choice));

  return choice.draft
    ? t('dishChoices.finishTitle', { question })
    : t('dishChoices.editTitle', { question });
}

function panelTitle(t: TFunction, open: Open): string {
  if (open.kind === 'addCourse') return t('eventMenu.addCourse');
  if (open.kind === 'editCourse') return t('eventMenu.editCourse');
  if (open.kind === 'addDish') return t('eventMenu.addDish');

  return t('eventMenu.editDish');
}

function variantTitle(
  t: TFunction,
  open: Extract<Open, { kind: 'variant' }>,
  course: MenuCourse | null,
): string {
  const dish = course?.dishes.find((one) => one.id === open.dishId);
  const name = dish?.name ?? '';
  if (open.mode === 'addFirst') return t('dishVariants.addFirstTitle', { dish: name });
  if (open.mode === 'add') return t('dishVariants.addTitle', { dish: name });

  return t('dishVariants.editTitle', {
    variant: dish?.variants.find((one) => one.id === open.variantId)?.name ?? '',
  });
}

function saveLabel(t: TFunction, open: Open): string {
  if (open.kind === 'addCourse') return t('eventMenu.addCourse');
  if (open.kind === 'addDish') return t('eventMenu.addDish');
  if (open.kind === 'variant') return variantSaveLabel(t, open.mode);

  return t('eventMenu.saveChanges');
}
