import {
  ApiError,
  type Dish,
  DISH_ALLERGENS,
  type EventMenu,
  MENU_COURSE_MAXIMUM,
  type MenuAnswer,
  type MenuChange,
  type MenuCourse,
  type MenuDish,
  type OrganisationEvent,
  type UnwarnedPickers,
  asEventMenu,
  realtimeTopic,
} from '@soirely/api-client';
import {
  type DishForm,
  type VariantForm,
  type VariantMode,
  addVariantOutcome,
  blankDishForm,
  blankVariantForm,
  firstVariantProblem,
  hasProblem,
  removeVariantOutcome,
  variantDetailsOf,
  variantFormOf,
  variantProblems,
  dishDetailsOf,
  dishProblems,
  firstDishProblem,
  listFormat,
  moneyLanguage,
  roleName,
  sameNamedDish,
} from '@soirely/domain';
import type { TFunction } from 'i18next';
import { type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { api } from '../../../api.ts';
import { Glyph } from '../../../components/Glyph.tsx';
import { Refreshing } from '../../../components/OfflineBand.tsx';
import { useDeskTop } from '../../../deskTop.ts';
import { keepsWhatLoaded, useOffline } from '../../../offline.ts';
import { pageTitle, usePageTitle } from '../../../pageTitle.ts';
import { canOn, useSession } from '../../../session.ts';
import {
  type CourseForm,
  canAddCourse,
  courseProblems,
  coursePicked,
  firstCourseProblem,
  menuCounts,
  moveTarget,
  servedTime,
  zoneCity,
} from './menuArea.ts';
import {
  AddDishPanel,
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
    };

type Asking = { kind: 'dish' | 'course'; id: string; failed: string | null };

type Refusal =
  | { kind: 'dish'; id: string }
  | { kind: 'course'; id: string }
  | { kind: 'limit'; at: 'top' | 'end' };

/** /app/events/:id/menu (sc-3902): the event's courses in order with the dishes on each, as its demo draws it. */
export function MenuArea({ event }: { event: OrganisationEvent }) {
  const { t } = useTranslation();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const title = useRef<HTMLHeadingElement>(null);
  const { watch, refreshing } = useOffline({
    loaded: load.kind === 'loaded',
    reload: () => setAttempt((n) => n + 1),
    title,
  });

  usePageTitle(pageTitle(t, [t('eventMenu.title'), event.name]));

  useEffect(() => {
    let current = true;

    watch(api.menu(event.id)).then(
      (menu) => current && setLoad({ kind: 'loaded', menu }),
      (error: unknown) =>
        current &&
        setLoad((was) =>
          was.kind === 'loaded' && keepsWhatLoaded(error) ? was : { kind: 'failed' },
        ),
    );

    return () => {
      current = false;
    };
  }, [event.id, attempt, watch]);

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
          <Courses
            event={event}
            menu={load.menu}
            title={title}
            refreshing={refreshing}
            onMenu={(menu) => setLoad({ kind: 'loaded', menu })}
          />
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
  const names = DISH_ALLERGENS.filter((code) => unwarned.allergens.includes(code)).map((code) =>
    t(`guestNeeds.allergen.${code}`),
  );

  return t('eventMenu.unwarned', {
    count: unwarned.count,
    dish,
    allergens: listFormat(language, { type: 'conjunction' }).format(names),
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
  const [said, setSaid] = useState<Told | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [library, setLibrary] = useState<{ dishes: Dish[]; prices: boolean } | null>(null);
  const [libraryFailed, setLibraryFailed] = useState(false);
  const [libraryTries, setLibraryTries] = useState(0);
  const [variantAsk, setVariantAsk] = useState<VariantAsk | null>(null);
  const [addRefused, setAddRefused] = useState<VariantHandlers['addRefused']>(null);
  const prices = canOn(event, 'budget.read');
  const focusAfter = useRef<string | null>(null);
  const counts = menuCounts(courses);
  const openCourse =
    open == null || open.courseId == null
      ? null
      : (courses.find((one) => one.id === open.courseId) ?? null);
  const shownLibrary = library?.dishes.filter((one) => one.archivedAt == null) ?? [];
  const currency = organisation?.currency ?? '';

  useEffect(() => {
    if (focusAfter.current == null) return;
    document.getElementById(focusAfter.current)?.focus();
    focusAfter.current = null;
  });

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
  }

  function tellDone(words: string, more: string | null = null) {
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
      pressed: false,
      failed: null,
      busy: false,
    });
    focusAfter.current = 'mc-panel-title';
  }

  async function saveCourse() {
    if (open == null || (open.kind !== 'addCourse' && open.kind !== 'editCourse') || open.busy)
      return;
    const problem = firstCourseProblem(courseProblems(open.form));
    if (problem != null) {
      setOpen({ ...open, pressed: true, failed: null, full: false });
      focusAfter.current = problem;
      return;
    }
    const adding = open.kind === 'addCourse';
    const details = { name: open.form.name.trim(), servedAt: servedTime(open.form.servedAt) };
    setOpen({ ...open, pressed: true, busy: true, failed: null, full: false });

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
      });
      onMenu(changed.menu);
      setOpen(null);
      tellDone(t('eventMenu.saved', { name: details.name }));
    } catch (error) {
      if (gone(error)) return;
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
      const words = t('eventMenu.addedTo', { dish: dish.name, course: course.name });
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
    const problem = firstDishProblem(editProblems(open.form, open.dishId));
    if (problem != null) {
      setOpen({ ...open, pressed: true, failed: null });
      focusAfter.current = problem;
      return;
    }
    const { lastPrice: _price, ...details } = dishDetailsOf(open.form, language, false, false);
    setOpen({ ...open, pressed: true, busy: true, failed: null });

    try {
      const changed: MenuChange = await api.changeMenuDish(event.id, open.dishId, details);
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
    if (dish.picked) {
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
    if (outcome !== 'open') {
      settle();
      setSaid(null);
      setAddRefused({ dishId: dish.id, outcome });
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
                allergens: listFormat(i18n.language, { type: 'conjunction' }).format(
                  DISH_ALLERGENS.filter((code) => changed.unwarned?.allergens.includes(code)).map(
                    (code) => t(`guestNeeds.allergen.${code}`),
                  ),
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
      setOpen((then) =>
        then?.kind === 'variant'
          ? { ...then, busy: false, failed: failedLine(error, button) }
          : then,
      );
      focusAfter.current = 'mc-failed';
    }
  }

  function askRemoveVariant(dish: MenuDish, variant: ShownVariant) {
    settle();
    setSaid(null);
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
            {refreshing && <Refreshing />}
          </p>
        </div>
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
                    refused == null || refused.kind === 'limit'
                      ? null
                      : refused.kind === 'course'
                        ? refused.id === course.id
                          ? 'course'
                          : null
                        : refused.id
                  }
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
        {open != null && (
          <aside className="mn-panel mc-panel" aria-labelledby="mc-panel-title">
            <button type="button" className="desk-text mc-back" onClick={close}>
              <Glyph name="back" size={16} weight={2.4} />
              {t('eventMenu.backToMenu')}
            </button>
            <div className="mn-panel-top">
              <div className="mn-panel-names">
                {openCourse != null && <p className="mn-eyebrow">{openCourse.name}</p>}
                <h2 id="mc-panel-title" tabIndex={-1}>
                  {open.kind === 'variant'
                    ? variantTitle(t, open, openCourse)
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
                  onPatch={(next) =>
                    setOpen({ ...open, form: { ...open.form, ...next }, full: false })
                  }
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
              {open.kind === 'editDish' && openCourse != null && (
                <EditDishFields
                  form={open.form}
                  dish={openCourse.dishes.find((one) => one.id === open.dishId) ?? null}
                  language={language}
                  problems={open.pressed ? editProblems(open.form, open.dishId) : null}
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
                        else void saveDish();
                      }}
                    >
                      {saveLabel(t, open)}
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
