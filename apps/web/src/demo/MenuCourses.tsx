import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import { NotFound } from '../routes/public/NotFound.tsx';
import { Switch } from '../components/GeneralParts.tsx';
import { HintButton } from '../components/HintButton.tsx';
import type { Tell } from '../components/SettingsParts.tsx';
import { DemoBell } from './DemoBell.tsx';
import {
  type Variant,
  type VariantAsk,
  type VariantForm,
  type VariantMode,
  EVENT_CURRENCY,
  VW,
  addOutcome,
  blankVariant,
  checkVariants,
  firstVariantProblem,
  foldInto,
  hasVariants,
  othersFor,
  removeOutcome,
  removeVariant,
  stayingAfter,
  variantForm,
  variantSaveLabel,
  variantsOf,
  waysName,
  withSavedVariants,
} from './dishVariants.ts';
import { AddVariantButton, RowLine, VariantFields, VariantInsets } from './DishVariants.tsx';
import {
  type Choice,
  type ChoiceAsk,
  type ChoiceForm,
  type ChoiceMode,
  type OptionForm,
  CHW,
  OPTION_MAX,
  addChoiceOutcome,
  blankChoice,
  blankOption,
  checkChoice,
  choiceForm,
  choiceSaveLabel,
  choicesOf,
  courseHint,
  dishHidden,
  firstChoiceProblem,
  formDraftReasons,
  hasChoices,
  hasProblem,
  optionPicked,
  questionOf,
  removeChoice,
  removeChoiceOutcome,
  savesAsDraft,
  withSavedChoice,
} from './dishChoices.ts';
import {
  AddChoiceButton,
  ChoiceFields,
  ChoiceInsets,
  ChoiceIntro,
  NotOffered,
} from './DishChoices.tsx';
import { DemoOffline } from './DemoOffline.tsx';
import {
  DishPicks,
  MenuPicksProvider,
  PicksSummary,
  SeePicksLink,
  useHasPicks,
} from './MenuPicks.tsx';
import { samplePicks } from './seePicks.ts';
import { KeptArea, KeptHere } from './KeptOffline.tsx';
import { clockWords } from './tabKept.ts';
import { EventsShell } from './EventParts.tsx';
import { EventSidebar } from './EventSidebar.tsx';
import { type SampleEvent } from './events.ts';
import { RETRY_MS } from './general.ts';
import { Pill } from './GuestsParts.tsx';
import { clockOfKitchen } from './kitchen.ts';
import {
  type CourseForm,
  type CoursesStart,
  type EvCourse,
  type EvDish,
  CW,
  addedAllergenLine,
  canAddCourse,
  canSame,
  checkCourse,
  copyOf,
  courseLine,
  coursePicked,
  firstCourseProblem,
  headerLines,
  isPicked,
  isReady,
  menuLinkLine,
  moveCourse,
  onlyDrafts,
  newCourse,
  newDish,
  servedTime,
  withDishes,
} from './menuCourses.ts';
import {
  AddDishPanel,
  CourseFields,
  EditDishFields,
  Said,
  type Told,
} from './MenuCoursesParts.tsx';
import {
  type DishForm,
  type Lang,
  LW,
  ORG_CURRENCY,
  SAMPLE_DISHES,
  blankForm,
  checkDish,
  dietName,
  firstProblem,
  formOf,
} from './menuLibrary.ts';
import { ActionGlyph, ContainsMark } from './MenuLibrary.tsx';
import { keptInbox, waitingLine } from './messages.ts';
import './guests.css';
import './menu.css';
import './menuLibrary.css';
import './menuCourses.css';

const SAMPLE_LIBRARY = SAMPLE_DISHES.filter((one) => !one.archived);

/** sc-3902's event Menu (board Menu, page e32): its courses in order with the dishes on each, at a desk and down to a 320 px web window. */
export function CoursesAt({
  event,
  first,
  lang,
  budget,
}: {
  event: SampleEvent;
  first: CoursesStart;
  lang: Lang;
  budget: boolean;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const [menuReady, setMenuReady] = useState<string | null>(null);

  return (
    <KeptArea eventId={event.id} area="menu" at={clockWords(clockOfKitchen(), event.timeZone)}>
      <EventsShell
        renderSide={(tell, covered) => (
          <div className={navOpen ? 'mc-nav is-open' : 'mc-nav'} id="mc-nav">
            <EventSidebar
              event={event}
              area="menu"
              now={clockOfKitchen()}
              tell={tell}
              inert={covered}
              waiting={waitingLine(keptInbox())}
              menuLine={menuReady}
            />
          </div>
        )}
      >
        {(tell) => (
          <div className="desk-page ev-page gs mn mc">
            <div className="ev-wide mn-page">
              <KeptHere />
              <Crumbs
                event={event}
                tell={tell}
                navOpen={navOpen}
                onNav={() => setNavOpen((now) => !now)}
                withheld={first.system === 'noAccess'}
              />
              <Body first={first} lang={lang} budget={budget} tell={tell} onReady={setMenuReady} />
            </div>
          </div>
        )}
      </EventsShell>
    </KeptArea>
  );
}

function Crumbs({
  event,
  tell,
  navOpen,
  onNav,
  withheld,
}: {
  event: SampleEvent;
  tell: Tell;
  navOpen: boolean;
  onNav: () => void;
  withheld: boolean;
}) {
  return (
    <div className="ev-crumb-row">
      <button
        type="button"
        className="gs-pill is-secondary mc-nav-button"
        aria-expanded={navOpen}
        aria-controls="mc-nav"
        onClick={onNav}
      >
        <Glyph name={navOpen ? 'clear' : 'filter'} size={16} weight={2.4} />
        {navOpen ? CW.closeNavigation : CW.navigation}
      </button>
      <nav className="ev-crumb" aria-label={CW.crumb}>
        <ol>
          <li className="ev-crumb-part">
            <Link to="/demo/events">{CW.events}</Link>
          </li>
          {!withheld && (
            <>
              <li className="ev-crumb-part">
                <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
                <Link className="ev-crumb-name" to={`/demo/events/${event.id}`}>
                  {event.name}
                </Link>
              </li>
              <li className="ev-crumb-part" aria-current="page">
                <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
                <span className="ev-crumb-name">{CW.title}</span>
              </li>
            </>
          )}
        </ol>
      </nav>
      <DemoBell tell={tell} />
    </div>
  );
}

function Body({
  first,
  lang,
  budget,
  tell,
  onReady,
}: {
  first: CoursesStart;
  lang: Lang;
  budget: boolean;
  tell: Tell;
  onReady: (line: string | null) => void;
}) {
  const [retried, setRetried] = useState(false);
  const [picks] = useState(() => (first.picks === true ? samplePicks() : null));
  if (first.system === 'noAccess') return <NotFound />;
  if (first.system === 'gone')
    return (
      <Refusal
        title={CW.gone}
        body={CW.goneBody}
        action={CW.backToEvents}
        onAction={() => tell('Back to Events.')}
      />
    );
  if (first.system === 'cannotReach' && !retried)
    return (
      <Refusal
        title={CW.cannotReach}
        body={CW.cannotReachBody}
        action={CW.tryAgain}
        onAction={() => setRetried(true)}
      />
    );
  if (first.system === 'loading') return <Loading />;

  return (
    <MenuPicksProvider value={picks}>
      <Courses first={first} lang={lang} budget={budget} onReady={onReady} />
    </MenuPicksProvider>
  );
}

function Refusal({
  title,
  body,
  action,
  onAction,
}: {
  title: string;
  body: string;
  action: string | null;
  onAction: () => void;
}) {
  return (
    <div className="desk-card mc-refusal" role="alert">
      <h1 className="gs-title">{title}</h1>
      <p className="mn-quiet">{body}</p>
      {action != null && <Pill label={action} onClick={onAction} />}
    </div>
  );
}

function Loading() {
  return (
    <>
      <header className="gs-top">
        <div className="mn-head">
          <h1 className="gs-title">{CW.title}</h1>
        </div>
      </header>
      <div className="lib-loading" aria-busy="true">
        <p className="lib-loading-words" role="status">
          {CW.loading}
        </p>
        {[0, 1, 2].map((one) => (
          <div key={one} className="lib-bone mc-bone" aria-hidden="true" />
        ))}
      </div>
    </>
  );
}

export type Open =
  | {
      kind: 'addCourse' | 'editCourse';
      courseId: string | null;
      form: CourseForm;
      pressed: boolean;
      failed: string | null;
      full: boolean;
      /** Another open Menu page has added the 10th course: the server refuses this one. */
      serverFull: boolean;
    }
  | {
      kind: 'addDish';
      courseId: string;
      tab: 'library' | 'new';
      q: string;
      form: DishForm;
      onlyEvent: boolean;
      pressed: boolean;
      failed: string | null;
      added: string;
    }
  | {
      kind: 'editDish';
      courseId: string;
      dishId: string;
      form: DishForm;
      pressed: boolean;
      failed: string | null;
    }
  | {
      kind: 'variants';
      courseId: string;
      dishId: string;
      mode: VariantMode;
      variantId: string | null;
      forms: VariantForm[];
      pressed: boolean;
      failed: string | null;
    }
  | {
      kind: 'choice';
      courseId: string;
      dishId: string;
      mode: ChoiceMode;
      choiceId: string | null;
      form: ChoiceForm;
      /** The option whose allergens are open; one at a time. */
      openKey: string | null;
      /** A picked option's bin, pressed: it removes nothing and says so until the next change. */
      binRefused: string | null;
      optionsFull: boolean;
      pressed: boolean;
      failed: string | null;
    };

const dishIn = (courses: readonly EvCourse[], dishId: string): EvDish | null =>
  courses.flatMap((one) => one.dishes).find((one) => one.id === dishId) ?? null;

function variantForms(
  dish: EvDish,
  mode: VariantMode,
  variantId: string | null,
  lang: Lang,
  over: readonly Partial<VariantForm>[] = [],
): VariantForm[] {
  const was = variantsOf(dish).find((one) => one.id === variantId);
  const base =
    mode === 'edit' && was != null
      ? [variantForm(was, lang, EVENT_CURRENCY)]
      : mode === 'addFirst'
        ? [blankVariant(EVENT_CURRENCY), blankVariant(EVENT_CURRENCY)]
        : [blankVariant(EVENT_CURRENCY)];

  return base.map((form, at) => ({ ...form, ...over[at] }));
}

/** Edit on a dish with variants checks only its Name and Description. */
function dishErrors(form: DishForm, dish: EvDish | null, lang: Lang) {
  const found = checkDish(form, lang, false);
  if (dish == null || !hasVariants(dish)) return found;

  return { ...found, contains: null, clashes: [], currency: null, amount: null };
}

function openOf(first: CoursesStart, lang: Lang): Open | null {
  const o = first.opened;
  if (o == null) return null;
  if (o.kind === 'addCourse')
    return {
      kind: 'addCourse',
      courseId: null,
      form: o.form ?? { name: '', servedAt: '' },
      pressed: o.press === true,
      failed: null,
      full: o.serverFull === true,
      serverFull: o.serverFull === true,
    };
  if (o.kind === 'editCourse') {
    const course = first.courses.find((one) => one.id === o.courseId) as EvCourse;

    return {
      kind: 'editCourse',
      courseId: course.id,
      form: { name: course.name, servedAt: course.servedAt ?? '' },
      pressed: false,
      failed: null,
      full: false,
      serverFull: false,
    };
  }
  if (o.kind === 'addDish')
    return {
      kind: 'addDish',
      courseId: o.courseId,
      tab: o.tab,
      q: o.q ?? '',
      form: { ...blankForm(ORG_CURRENCY), ...o.form },
      onlyEvent: false,
      pressed: o.press === true,
      failed: null,
      added: '',
    };
  const dish = dishIn(first.courses, o.dishId) as EvDish;
  if (o.kind === 'choice') return choiceOpen(o, dish);
  if (o.kind === 'variants')
    return {
      kind: 'variants',
      courseId: o.courseId,
      dishId: o.dishId,
      mode: o.mode,
      variantId: o.variantId ?? null,
      forms: variantForms(dish, o.mode, o.variantId ?? null, lang, o.forms),
      pressed: o.press === true,
      failed: null,
    };

  return {
    kind: 'editDish',
    courseId: o.courseId,
    dishId: o.dishId,
    form: {
      ...formOf({ ...dish, used: true, archived: false, price: null }, lang, ORG_CURRENCY),
      ...o.form,
    },
    pressed: o.press === true,
    failed: null,
  };
}

const wasChoice = (dish: EvDish | null, choiceId: string | null): Choice | null =>
  dish == null ? null : (choicesOf(dish).find((one) => one.id === choiceId) ?? null);

function choiceOpen(o: Extract<CoursesStart['opened'], { kind: 'choice' }>, dish: EvDish): Open {
  const was = wasChoice(dish, o.choiceId ?? null);
  const base = was == null ? blankChoice() : choiceForm(was);
  const over = o.options ?? [];
  const options = Array.from({ length: Math.max(base.options.length, over.length) }, (_, at) => ({
    ...(base.options[at] ?? blankOption()),
    ...over[at],
  }));
  const form: ChoiceForm = { ...base, ...o.form, options };
  const pressed = o.press === true;
  const problem = pressed ? firstChoiceProblem(checkChoice(form, was), form, was) : null;
  const keyAt = (at: number | undefined) => (at == null ? null : (options[at]?.key ?? null));

  return {
    kind: 'choice',
    courseId: o.courseId,
    dishId: o.dishId,
    mode: o.mode,
    choiceId: o.choiceId ?? null,
    form,
    openKey: problem?.open ?? keyAt(o.openAt),
    binRefused: keyAt(o.binAt),
    optionsFull: o.optionsFull === true,
    pressed,
    failed: null,
  };
}

/** A state that opens pressed puts focus where a press would: the first field refused, or the limit line. */
function firstFocus(
  open: Open | null,
  courses: readonly EvCourse[],
  budget: boolean,
): string | null {
  if (open?.kind === 'choice' && open.binRefused != null) return `ch-${open.binRefused}-bin`;
  if (open?.kind === 'choice' && open.optionsFull) return 'ch-add-option';
  if (open == null || !open.pressed) return null;
  if (open.kind === 'choice') {
    const was = wasChoice(dishIn(courses, open.dishId), open.choiceId);

    return firstChoiceProblem(checkChoice(open.form, was), open.form, was)?.id ?? null;
  }
  if (open.kind === 'variants') {
    const dish = dishIn(courses, open.dishId);
    if (dish == null) return null;
    const errors = checkVariants(open.forms, {
      where: 'event',
      lang: 'en',
      budget,
      others: othersFor(dish, open.mode, open.variantId),
    });

    return firstVariantProblem(errors, open.forms);
  }
  if (open.kind === 'addDish' || open.kind === 'editDish')
    return firstProblem(checkDish(open.form, 'en', false));

  return firstCourseProblem(checkCourse(open.form)) ?? (open.full ? 'mc-form-full' : null);
}

function Courses({
  first,
  lang,
  budget,
  onReady,
}: {
  first: CoursesStart;
  lang: Lang;
  budget: boolean;
  onReady: (line: string | null) => void;
}) {
  const [courses, setCourses] = useState(first.courses);
  const [open, setOpen] = useState<Open | null>(() => openOf(first, lang));
  const [asking, setAsking] = useState(first.asking);
  const [refused, setRefused] = useState(first.refused);
  const [said, setSaid] = useState<Told | null>(
    first.said === '' ? null : { words: first.said, more: first.saidMore ?? null },
  );
  const [dragging, setDragging] = useState<string | null>(null);
  const failing = useRef(first.failing);
  const focusAfter = useRef<string | null>(firstFocus(open, first.courses, budget));
  const library = first.library ?? SAMPLE_LIBRARY;
  const [libraryFailed, setLibraryFailed] = useState(first.libraryFailed === true);
  const [libraryRetrying, setLibraryRetrying] = useState(false);
  const retryFails = useRef(first.libraryRetryFails === true);
  const manage = first.manage;
  const lines = headerLines(courses);
  const openCourse =
    open == null || open.courseId == null
      ? null
      : (courses.find((one) => one.id === open.courseId) ?? null);
  const openDish =
    open?.kind === 'variants' || open?.kind === 'choice' ? dishIn(courses, open.dishId) : null;
  const linkLine = menuLinkLine(courses);

  useEffect(() => {
    onReady(linkLine);
  }, [linkLine, onReady]);

  useEffect(() => {
    if (focusAfter.current == null) return;
    document.getElementById(focusAfter.current)?.focus();
    focusAfter.current = null;
  });

  useEffect(() => {
    if (!libraryRetrying) return;
    const timer = setTimeout(() => {
      setLibraryRetrying(false);
      setLibraryFailed(retryFails.current);
      retryFails.current = false;
    }, RETRY_MS);

    return () => clearTimeout(timer);
  }, [libraryRetrying]);

  function settle() {
    setRefused(null);
    setAsking(null);
  }

  function failsNow(): 'none' | 'network' | 'forbidden' {
    const now = failing.current;
    failing.current = 'none';

    return now;
  }

  function tellDone(words: string, more: Told['more'] = null) {
    setSaid({ words, more });
    focusAfter.current = 'mc-said';
  }

  function close(back: string | null) {
    setOpen(null);
    focusAfter.current = back;
  }

  function closeBack(): string | null {
    if (open == null) return null;
    if (open.kind === 'addDish') return `mc-add-dish-${open.courseId}`;
    if (open.kind === 'editDish') return `mc-edit-${open.dishId}`;
    if (open.kind === 'variants')
      return open.mode === 'edit' ? `mc-vedit-${open.variantId ?? ''}` : `mc-addv-${open.dishId}`;
    if (open.kind === 'choice')
      return open.mode === 'edit' ? `mc-chedit-${open.choiceId ?? ''}` : `mc-addch-${open.dishId}`;

    return open.kind === 'addCourse' ? 'mc-add-course' : `mc-edit-${open.courseId ?? ''}`;
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
      form: { name: '', servedAt: '' },
      pressed: false,
      failed: null,
      full: false,
      serverFull: false,
    });
    focusAfter.current = 'mc-panel-title';
  }

  function openEditCourse(course: EvCourse) {
    settle();
    setSaid(null);
    setOpen({
      kind: 'editCourse',
      courseId: course.id,
      form: { name: course.name, servedAt: course.servedAt ?? '' },
      pressed: false,
      failed: null,
      full: false,
      serverFull: false,
    });
    focusAfter.current = 'mc-panel-title';
  }

  function openAddDish(course: EvCourse) {
    settle();
    setSaid(null);
    setOpen({
      kind: 'addDish',
      courseId: course.id,
      tab: 'library',
      q: '',
      form: blankForm(ORG_CURRENCY),
      onlyEvent: false,
      pressed: false,
      failed: null,
      added: '',
    });
    focusAfter.current = 'mc-panel-title';
  }

  function openEditDish(course: EvCourse, dish: EvDish) {
    settle();
    setSaid(null);
    setOpen({
      kind: 'editDish',
      courseId: course.id,
      dishId: dish.id,
      form: formOf({ ...dish, used: true, archived: false, price: null }, lang, ORG_CURRENCY),
      pressed: false,
      failed: null,
    });
    focusAfter.current = 'mc-panel-title';
  }

  function saveCourse() {
    if (open == null || (open.kind !== 'addCourse' && open.kind !== 'editCourse')) return;
    const problem = firstCourseProblem(checkCourse(open.form));
    if (problem != null) {
      setOpen({ ...open, pressed: true, failed: null, full: false });
      focusAfter.current = problem;
      return;
    }
    const adding = open.kind === 'addCourse';
    if (open.kind === 'addCourse' && (open.serverFull || !canAddCourse(courses))) {
      setOpen({ ...open, pressed: true, failed: null, full: true });
      focusAfter.current = 'mc-form-full';
      return;
    }
    const fails = failsNow();
    if (fails !== 'none') {
      setOpen({
        ...open,
        pressed: true,
        full: false,
        failed:
          fails === 'forbidden'
            ? CW.forbidden
            : CW.failedSave(adding ? CW.addCourse : CW.saveChanges),
      });
      focusAfter.current = 'mc-failed';
      return;
    }
    const name = open.form.name.trim();
    const servedAt = servedTime(open.form.servedAt);
    if (adding) {
      const next = newCourse(name, servedAt);
      setCourses([...courses, next]);
      setOpen(null);
      tellDone(CW.courseAdded(name, courses.length + 1, courses.length + 1));
      return;
    }
    setCourses(courses.map((one) => (one.id === open.courseId ? { ...one, name, servedAt } : one)));
    setOpen(null);
    tellDone(CW.saved(name));
  }

  function changeCourse(id: string, change: (course: EvCourse) => EvCourse) {
    setCourses((now) => now.map((one) => (one.id === id ? change(one) : one)));
  }

  function addFromLibrary(course: EvCourse, libraryId: string) {
    if (open?.kind !== 'addDish') return;
    const libDish = library.find((one) => one.id === libraryId);
    if (libDish == null) return;
    const { course: next, said: also } = withDishes(course, [...course.dishes, copyOf(libDish)]);
    changeCourse(course.id, () => next);
    setOpen({
      ...open,
      added:
        also == null
          ? CW.addedTo(libDish.name, course.name)
          : `${CW.addedTo(libDish.name, course.name)} ${also}`,
    });
  }

  function saveNewDish() {
    if (open?.kind !== 'addDish' || openCourse == null) return;
    const withPrice = budget && !open.onlyEvent;
    const found = checkDish(open.form, lang, withPrice);
    const problem = firstProblem(found);
    if (problem != null) {
      setOpen({ ...open, pressed: true, failed: null });
      focusAfter.current = problem;
      return;
    }
    const fails = failsNow();
    if (fails !== 'none') {
      setOpen({
        ...open,
        pressed: true,
        failed: fails === 'forbidden' ? CW.forbidden : CW.failedSave(CW.addDish),
      });
      focusAfter.current = 'mc-failed';
      return;
    }
    const dish = newDish(open.form, open.onlyEvent);
    const { course: next, said: also } = withDishes(openCourse, [...openCourse.dishes, dish]);
    changeCourse(openCourse.id, () => next);
    setOpen(null);
    tellDone(
      open.onlyEvent
        ? CW.addedTo(dish.name, openCourse.name)
        : CW.addedSaved(dish.name, openCourse.name),
      also,
    );
  }

  function saveDish() {
    if (open?.kind !== 'editDish' || openCourse == null) return;
    const dish = openCourse.dishes.find((one) => one.id === open.dishId);
    if (dish == null) return;
    const problem = firstProblem(dishErrors(open.form, dish, lang));
    if (problem != null) {
      setOpen({ ...open, pressed: true, failed: null });
      focusAfter.current = problem;
      return;
    }
    const fails = failsNow();
    if (fails !== 'none') {
      setOpen({
        ...open,
        pressed: true,
        failed: fails === 'forbidden' ? CW.forbidden : CW.failedSave(CW.saveChanges),
      });
      focusAfter.current = 'mc-failed';
      return;
    }
    const keeps = hasVariants(dish);
    const contains = keeps ? dish.contains : open.form.none ? 'none' : open.form.allergens.slice();
    const next: EvDish = {
      ...dish,
      name: open.form.name.trim(),
      desc: open.form.desc.trim(),
      contains,
      diets: keeps ? dish.diets : open.form.diets.slice(),
    };
    changeCourse(openCourse.id, (one) => ({
      ...one,
      dishes: one.dishes.map((d) => (d.id === dish.id ? next : d)),
    }));
    setOpen(null);
    tellDone(CW.saved(next.name), addedAllergenLine(dish, dish.contains, contains, lang));
  }

  function changeDish(course: EvCourse, dish: EvDish) {
    changeCourse(course.id, (one) => ({
      ...one,
      dishes: one.dishes.map((d) => (d.id === dish.id ? dish : d)),
    }));
  }

  function pressAddVariant(course: EvCourse, dish: EvDish) {
    settle();
    setSaid(null);
    const outcome = addOutcome(dish, isPicked(dish));
    if (outcome !== 'open') {
      setRefused({ kind: 'addVariant', dishId: dish.id, why: outcome });
      return;
    }
    const mode: VariantMode = hasVariants(dish) ? 'add' : 'addFirst';
    setOpen({
      kind: 'variants',
      courseId: course.id,
      dishId: dish.id,
      mode,
      variantId: null,
      forms: variantForms(dish, mode, null, lang),
      pressed: false,
      failed: null,
    });
    focusAfter.current = 'mc-panel-title';
  }

  function openEditVariant(course: EvCourse, dish: EvDish, variant: Variant) {
    settle();
    setSaid(null);
    setOpen({
      kind: 'variants',
      courseId: course.id,
      dishId: dish.id,
      mode: 'edit',
      variantId: variant.id,
      forms: variantForms(dish, 'edit', variant.id, lang),
      pressed: false,
      failed: null,
    });
    focusAfter.current = 'mc-panel-title';
  }

  function saveVariants() {
    if (open?.kind !== 'variants' || openCourse == null) return;
    const dish = openCourse.dishes.find((one) => one.id === open.dishId);
    if (dish == null) return;
    const how = { where: 'event' as const, lang, budget };
    const errors = checkVariants(open.forms, {
      ...how,
      others: othersFor(dish, open.mode, open.variantId),
    });
    const problem = firstVariantProblem(errors, open.forms);
    if (problem != null) {
      setOpen({ ...open, pressed: true, failed: null });
      focusAfter.current = problem;
      return;
    }
    const fails = failsNow();
    if (fails !== 'none') {
      setOpen({
        ...open,
        pressed: true,
        failed: fails === 'forbidden' ? CW.forbidden : VW.failedSave(variantSaveLabel(open.mode)),
      });
      focusAfter.current = 'mc-failed';
      return;
    }
    const saved = withSavedVariants(dish, open.mode, open.variantId, open.forms, how);
    changeDish(openCourse, saved.dish);
    setOpen(null);
    tellDone(saved.said, saved.more);
  }

  function pressRemoveVariant(dish: EvDish, variant: Variant) {
    settle();
    setSaid(null);
    const outcome = removeOutcome(dish, variant, 'event');
    if (outcome.kind === 'refused') {
      setAsking({
        kind: 'variant',
        dishId: dish.id,
        ask: { variantId: variant.id, kind: 'refused', lines: outcome.lines },
      });
      return;
    }
    setAsking({
      kind: 'variant',
      dishId: dish.id,
      ask: { variantId: variant.id, kind: outcome.kind },
    });
    focusAfter.current = `mc-vask-${variant.id}`;
  }

  function variantChangeFails(dish: EvDish): boolean {
    const fails = failsNow();
    if (fails === 'none') return false;
    setAsking(null);
    setSaid({
      words:
        fails === 'forbidden' ? CW.forbidden : VW.failedChange(dish.name, variantsOf(dish).length),
      tone: 'fail',
    });
    focusAfter.current = 'mc-said';

    return true;
  }

  function confirmRemoveVariant(course: EvCourse, dish: EvDish, variant: Variant) {
    if (variantChangeFails(dish)) return;
    changeDish(course, removeVariant(dish, variant));
    setAsking(null);
    if (open?.kind === 'variants' && open.variantId === variant.id) setOpen(null);
    tellDone(VW.removed(variant.name, dish.name));
  }

  function confirmFold(course: EvCourse, dish: EvDish, variant: Variant) {
    const staying = stayingAfter(dish, variant);
    if (staying == null || variantChangeFails(dish)) return;
    const folded = foldInto(dish, staying);
    changeDish(course, { ...folded.dish, cost: folded.price, pickers: staying.pickers });
    setAsking(null);
    if (open?.kind === 'variants' && open.dishId === dish.id) setOpen(null);
    tellDone(VW.folded(dish.name, staying.name, budget ? 'event' : null));
  }

  function pressAddChoice(course: EvCourse, dish: EvDish) {
    settle();
    setSaid(null);
    const outcome = addChoiceOutcome(dish);
    if (outcome !== 'open') {
      setRefused({ kind: 'addChoice', dishId: dish.id, why: outcome });
      return;
    }
    setOpen({
      kind: 'choice',
      courseId: course.id,
      dishId: dish.id,
      mode: 'add',
      choiceId: null,
      form: blankChoice(),
      openKey: null,
      binRefused: null,
      optionsFull: false,
      pressed: false,
      failed: null,
    });
    focusAfter.current = 'mc-panel-title';
  }

  function openEditChoice(course: EvCourse, dish: EvDish, choice: Choice) {
    settle();
    setSaid(null);
    setOpen({
      kind: 'choice',
      courseId: course.id,
      dishId: dish.id,
      mode: 'edit',
      choiceId: choice.id,
      form: choiceForm(choice),
      openKey: null,
      binRefused: null,
      optionsFull: false,
      pressed: false,
      failed: null,
    });
    focusAfter.current = 'mc-panel-title';
  }

  type ChoiceOpen = Extract<Open, { kind: 'choice' }>;

  function changeChoice(now: ChoiceOpen, next: Partial<ChoiceOpen>) {
    setOpen({ ...now, binRefused: null, optionsFull: false, ...next });
  }

  function pressBin(now: ChoiceOpen, key: string) {
    const was = wasChoice(openDish, now.choiceId);
    const option = now.form.options.find((one) => one.key === key);
    const saved = was?.options.find((one) => one.id === option?.id);
    if (saved != null && optionPicked(saved)) {
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
    if (now.form.options.length >= OPTION_MAX) {
      setOpen({ ...now, binRefused: null, optionsFull: true });
      focusAfter.current = 'ch-add-option';
      return;
    }
    const added: OptionForm = blankOption();
    changeChoice(now, { form: { ...now.form, options: [...now.form.options, added] } });
    focusAfter.current = `ch-${added.key}-name`;
  }

  function saveChoice() {
    if (open?.kind !== 'choice' || openCourse == null) return;
    const dish = openCourse.dishes.find((one) => one.id === open.dishId);
    if (dish == null) return;
    const was = wasChoice(dish, open.choiceId);
    const errors = checkChoice(open.form, was);
    if (hasProblem(errors)) {
      const problem = firstChoiceProblem(errors, open.form, was);
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
    const fails = failsNow();
    if (fails !== 'none') {
      setOpen({
        ...open,
        pressed: true,
        failed:
          fails === 'forbidden'
            ? CW.forbidden
            : CW.failedSave(choiceSaveLabel(open.mode, savesAsDraft(open.form, was))),
      });
      focusAfter.current = 'mc-failed';
      return;
    }
    const saved = withSavedChoice(dish, open.mode, open.choiceId, open.form, lang);
    changeDish(openCourse, saved.dish);
    setOpen(null);
    tellDone(saved.said, saved.more);
  }

  function pressRemoveChoice(dish: EvDish, choice: Choice) {
    settle();
    setSaid(null);
    const ask: ChoiceAsk = { choiceId: choice.id, kind: removeChoiceOutcome(choice) };
    setAsking({ kind: 'choice', dishId: dish.id, ask });
    if (ask.kind === 'ask') focusAfter.current = `mc-chask-${choice.id}`;
  }

  function confirmRemoveChoice(course: EvCourse, dish: EvDish, choice: Choice) {
    const fails = failsNow();
    if (fails !== 'none') {
      setAsking(null);
      setSaid({
        words: fails === 'forbidden' ? CW.forbidden : CW.failedSave(CHW.removeChoice),
        tone: 'fail',
      });
      focusAfter.current = 'mc-said';
      return;
    }
    changeDish(course, removeChoice(dish, choice));
    setAsking(null);
    if (open?.kind === 'choice' && open.choiceId === choice.id) setOpen(null);
    tellDone(CHW.removed(choice.question, dish.name));
  }

  function move(at: number, to: number, focus: string | null) {
    settle();
    const result = moveCourse(courses, at, to);
    if (result == null) return;
    if (failsNow() !== 'none') {
      const course = courses[at] as EvCourse;
      setSaid({ words: CW.failedMove(course.name, at + 1, courses.length), tone: 'fail' });
      return;
    }
    setCourses(result.courses);
    setSaid({ words: result.said });
    focusAfter.current = focus;
  }

  function askRemove(dish: EvDish) {
    settle();
    setSaid(null);
    if (isPicked(dish)) {
      setRefused({ kind: 'dish', dishId: dish.id });
      return;
    }
    setAsking({ kind: 'dish', dishId: dish.id });
    focusAfter.current = `mc-ask-${dish.id}`;
  }

  function remove(course: EvCourse, dish: EvDish) {
    const { course: next } = withDishes(
      course,
      course.dishes.filter((one) => one.id !== dish.id),
    );
    changeCourse(course.id, () => next);
    setAsking(null);
    if (open?.kind === 'editDish' && open.dishId === dish.id) setOpen(null);
    tellDone(CW.removed(dish.name, course.name));
  }

  function askDelete(course: EvCourse) {
    settle();
    setSaid(null);
    if (coursePicked(course)) {
      setRefused({ kind: 'course', courseId: course.id });
      return;
    }
    setAsking({ kind: 'course', courseId: course.id });
    focusAfter.current = `mc-ask-${course.id}`;
  }

  function deleteCourse(course: EvCourse) {
    setCourses(courses.filter((one) => one.id !== course.id));
    setAsking(null);
    if (open?.courseId === course.id) setOpen(null);
    tellDone(CW.deleted(course.name));
  }

  const limitLine = (at: 'top' | 'end') =>
    refused?.kind === 'limit' && refused.at === at ? CW.atLimit : '';

  return (
    <>
      <DemoOffline on={first.system === 'offline'} />
      <header className="gs-top mc-top">
        <div className="mn-head">
          <h1 className="gs-title">{CW.title}</h1>
          <p className="mc-counts">
            {courses.length > 0 && <span>{lines.counts}</span>}
            {lines.ready != null && (
              <span className="mc-ready-line">
                <span className="mc-ring is-empty" aria-hidden="true" />
                {lines.ready}
              </span>
            )}
            {first.system === 'refreshing' && (
              <span className="lib-refreshing" role="status">
                <Glyph name="refresh" size={15} weight={2.4} />
                {CW.refreshing}
              </span>
            )}
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
              {CW.addCourse}
            </button>
            <LimitLine id="mc-limit-top" words={limitLine('top')} />
          </div>
        )}
      </header>
      {!manage && (
        <p className="mn-lock">
          <Glyph name="lock" size={16} weight={2.2} />
          {first.lock}
        </p>
      )}
      <Said said={said} />
      <div className={open == null ? 'mn-split mc-split' : 'mn-split mc-split is-open'}>
        <div className="mn-list mc-list">
          {courses.length === 0 ? (
            <div className="desk-card lib-empty mc-empty">
              <h2>{CW.emptyTitle}</h2>
              {manage && (
                <>
                  <p>{CW.emptyBody}</p>
                  <button
                    id="mc-add-course"
                    type="button"
                    className="gs-pill is-primary mc-add-course"
                    onClick={() => pressAddCourse('top')}
                  >
                    <Glyph name="plus" size={16} weight={2.6} />
                    {CW.addCourse}
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
                  lang={lang}
                  lit={open?.courseId === course.id}
                  litDish={open?.kind === 'editDish' ? open.dishId : null}
                  asking={asking}
                  refused={refused}
                  dragging={dragging === course.id}
                  onDragStart={() => setDragging(course.id)}
                  onDragEnd={() => setDragging(null)}
                  onDrop={() => {
                    const from = courses.findIndex((one) => one.id === dragging);
                    setDragging(null);
                    if (from >= 0) move(from, index, null);
                  }}
                  onMove={(by) =>
                    move(index, index + by, by < 0 ? `mc-up-${course.id}` : `mc-down-${course.id}`)
                  }
                  onEdit={() => openEditCourse(course)}
                  onAskDelete={() => askDelete(course)}
                  onDelete={() => deleteCourse(course)}
                  onKeep={(back) => {
                    setAsking(null);
                    focusAfter.current = back;
                  }}
                  onAnswer={(answer) => {
                    settle();
                    changeCourse(course.id, (one) => ({ ...one, answer }));
                  }}
                  onSkip={(skip) => {
                    settle();
                    changeCourse(course.id, (one) => ({ ...one, skip }));
                  }}
                  onAddDish={() => openAddDish(course)}
                  onEditDish={(dish) => openEditDish(course, dish)}
                  onAskRemove={(dish) => askRemove(dish)}
                  onRemove={(dish) => remove(course, dish)}
                  variants={{
                    budget,
                    lit: open?.kind === 'variants' ? open.variantId : null,
                    onAdd: (dish) => pressAddVariant(course, dish),
                    onEdit: (dish, variant) => openEditVariant(course, dish, variant),
                    onRemove: (dish, variant) => pressRemoveVariant(dish, variant),
                    onKeep: (variant) => {
                      setAsking(null);
                      focusAfter.current = `mc-vremove-${variant.id}`;
                    },
                    onConfirmRemove: (dish, variant) => confirmRemoveVariant(course, dish, variant),
                    onConfirmFold: (dish, variant) => confirmFold(course, dish, variant),
                  }}
                  choices={{
                    lit: open?.kind === 'choice' ? open.choiceId : null,
                    onAdd: (dish) => pressAddChoice(course, dish),
                    onEdit: (dish, choice) => openEditChoice(course, dish, choice),
                    onRemove: (dish, choice) => pressRemoveChoice(dish, choice),
                    onKeep: (choice) => {
                      setAsking(null);
                      focusAfter.current = `mc-chremove-${choice.id}`;
                    },
                    onConfirmRemove: (dish, choice) => confirmRemoveChoice(course, dish, choice),
                  }}
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
                {CW.addCourse}
              </button>
              <LimitLine id="mc-limit-end" words={limitLine('end')} />
            </div>
          )}
        </div>
        {open == null && <PicksSummary />}
        {open != null && (
          <aside className="mn-panel mc-panel" aria-labelledby="mc-panel-title">
            <button type="button" className="desk-text mc-back" onClick={() => close(closeBack())}>
              <Glyph name="back" size={16} weight={2.4} />
              {CW.backToMenu}
            </button>
            <div className="mn-panel-top">
              <div className="mn-panel-names">
                {openCourse != null && (
                  <p className="mn-eyebrow">
                    {open.kind === 'choice' && open.mode === 'add' && openDish != null
                      ? CHW.eyebrow(openDish.name)
                      : openCourse.name}
                  </p>
                )}
                <h2 id="mc-panel-title" tabIndex={-1}>
                  {panelTitle(open, openDish)}
                </h2>
              </div>
              <button
                type="button"
                className="ev-round mn-close"
                aria-label={CW.close}
                onClick={() => close(closeBack())}
              >
                <Glyph name="clear" size={16} weight={2.4} />
              </button>
            </div>
            <div className="mn-panel-body">
              {(open.kind === 'addCourse' || open.kind === 'editCourse') && (
                <CourseFields
                  form={open.form}
                  adding={open.kind === 'addCourse'}
                  errors={open.pressed ? checkCourse(open.form) : null}
                  onPatch={(next) =>
                    setOpen({ ...open, form: { ...open.form, ...next }, full: false })
                  }
                />
              )}
              {open.kind === 'addDish' && openCourse != null && (
                <AddDishPanel
                  open={open}
                  course={openCourse}
                  lang={lang}
                  budget={budget}
                  library={library}
                  loading={first.libraryLoading === true || libraryRetrying}
                  failed={libraryFailed}
                  onRetry={() => {
                    setLibraryFailed(false);
                    setLibraryRetrying(true);
                    focusAfter.current = 'mc-find';
                  }}
                  errors={
                    open.pressed ? checkDish(open.form, lang, budget && !open.onlyEvent) : null
                  }
                  onTab={(tab) => setOpen({ ...open, tab, pressed: false, failed: null })}
                  onFind={(q) => setOpen({ ...open, q })}
                  onAdd={(libraryId) => addFromLibrary(openCourse, libraryId)}
                  onStartNew={(name) => {
                    setOpen({ ...open, tab: 'new', form: { ...open.form, name }, added: '' });
                    focusAfter.current = 'lib-name';
                  }}
                  onPatch={(next) => setOpen({ ...open, form: { ...open.form, ...next } })}
                  onOnlyEvent={(onlyEvent) => setOpen({ ...open, onlyEvent })}
                />
              )}
              {open.kind === 'editDish' && openCourse != null && (
                <EditDishFields
                  form={open.form}
                  dish={openCourse.dishes.find((one) => one.id === open.dishId) ?? null}
                  lang={lang}
                  errors={
                    open.pressed
                      ? dishErrors(
                          open.form,
                          openCourse.dishes.find((one) => one.id === open.dishId) ?? null,
                          lang,
                        )
                      : null
                  }
                  onPatch={(next) => setOpen({ ...open, form: { ...open.form, ...next } })}
                />
              )}
              {open.kind === 'variants' && openDish != null && (
                <VariantFields
                  mode={open.mode}
                  dish={openDish}
                  forms={open.forms}
                  errors={
                    open.pressed
                      ? checkVariants(open.forms, {
                          where: 'event',
                          lang,
                          budget,
                          others: othersFor(openDish, open.mode, open.variantId),
                        })
                      : null
                  }
                  where="event"
                  budget={budget}
                  lang={lang}
                  pricedIn={
                    variantsOf(openDish).find((one) => one.id === open.variantId)?.pricedIn ?? null
                  }
                  after={
                    openDish.libraryId != null && <p className="lib-own-copy">{CW.copyOnly}</p>
                  }
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
                  errors={
                    open.pressed ? checkChoice(open.form, wasChoice(openDish, open.choiceId)) : null
                  }
                  draft={
                    savesAsDraft(open.form, wasChoice(openDish, open.choiceId))
                      ? formDraftReasons(open.form, wasChoice(openDish, open.choiceId))
                      : null
                  }
                  ways={variantsOf(openDish).length}
                  openKey={open.openKey}
                  binRefused={open.binRefused}
                  optionsFull={open.optionsFull}
                  lang={lang}
                  intro={
                    <ChoiceIntro
                      ways={variantsOf(openDish).length}
                      k={open.mode === 'add' ? choicesOf(openDish).length + 1 : null}
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
            </div>
            {!(open.kind === 'addDish' && open.tab === 'library') && (
              <div className="mn-panel-foot">
                {open.failed != null && (
                  <p id="mc-failed" className="mn-failed" role="alert" tabIndex={-1}>
                    <Glyph name="alert" size={16} weight={2.2} />
                    {open.failed}
                  </p>
                )}
                <div className="mn-panel-acts">
                  <button type="button" className="desk-text" onClick={() => close(closeBack())}>
                    {CW.cancel}
                  </button>
                  <button
                    id="mc-panel-save"
                    type="button"
                    className="gs-pill is-primary"
                    aria-describedby={open.kind === 'addCourse' ? 'mc-form-full' : undefined}
                    onClick={() => {
                      if (open.kind === 'addCourse' || open.kind === 'editCourse') saveCourse();
                      else if (open.kind === 'addDish') saveNewDish();
                      else if (open.kind === 'variants') saveVariants();
                      else if (open.kind === 'choice') saveChoice();
                      else saveDish();
                    }}
                  >
                    {open.kind === 'choice'
                      ? choiceSaveLabel(
                          open.mode,
                          savesAsDraft(open.form, wasChoice(openDish, open.choiceId)),
                        )
                      : saveLabel(open)}
                  </button>
                </div>
                {open.kind === 'addCourse' && (
                  <LimitLine id="mc-form-full" words={open.full ? CW.atLimit : ''} focusable />
                )}
              </div>
            )}
          </aside>
        )}
      </div>
    </>
  );
}

function panelTitle(open: Open, dish: EvDish | null): string {
  if (open.kind === 'addCourse') return CW.addCourse;
  if (open.kind === 'choice') {
    if (open.mode === 'add') return CHW.addTitle;
    const all = dish == null ? [] : choicesOf(dish);
    const at = all.findIndex((one) => one.id === open.choiceId);
    const choice = all[at];
    if (choice == null) return CHW.addTitle;
    const named = questionOf(choice, at);

    return formDraftReasons(choiceForm(choice), null).length > 0
      ? CHW.finishTitle(named)
      : CHW.editTitle(named);
  }
  if (open.kind === 'editCourse') return CW.editCourse;
  if (open.kind === 'addDish') return CW.addDish;
  if (open.kind === 'variants') {
    const name = dish?.name ?? '';
    if (open.mode === 'addFirst') return VW.addFirstTitle(name);
    if (open.mode === 'add') return VW.addTitle(name);
    const variant = variantsOf(dish ?? { name, contains: null, diets: [] }).find(
      (one) => one.id === open.variantId,
    );

    return VW.editTitle(variant?.name ?? '');
  }

  return CW.editDish;
}

function saveLabel(open: Open): string {
  if (open.kind === 'addCourse') return CW.addCourse;
  if (open.kind === 'addDish') return CW.addDish;
  if (open.kind === 'variants') return variantSaveLabel(open.mode);

  return CW.saveChanges;
}

interface ChoiceHandlers {
  lit: string | null;
  onAdd: (dish: EvDish) => void;
  onEdit: (dish: EvDish, choice: Choice) => void;
  onRemove: (dish: EvDish, choice: Choice) => void;
  onKeep: (choice: Choice) => void;
  onConfirmRemove: (dish: EvDish, choice: Choice) => void;
}

interface VariantHandlers {
  budget: boolean;
  lit: string | null;
  onAdd: (dish: EvDish) => void;
  onEdit: (dish: EvDish, variant: Variant) => void;
  onRemove: (dish: EvDish, variant: Variant) => void;
  onKeep: (variant: Variant) => void;
  onConfirmRemove: (dish: EvDish, variant: Variant) => void;
  onConfirmFold: (dish: EvDish, variant: Variant) => void;
}

function LimitLine({
  id,
  words,
  focusable = false,
}: {
  id: string;
  words: string;
  focusable?: boolean;
}) {
  return (
    <p
      id={id}
      className="mc-limit"
      role="status"
      tabIndex={focusable && words !== '' ? -1 : undefined}
    >
      {words !== '' && (
        <>
          <span className="mc-ring is-warn" aria-hidden="true">
            !
          </span>
          {words}
        </>
      )}
    </p>
  );
}

function Grip() {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="currentColor"
    >
      {[6, 12, 18].flatMap((y) =>
        [9, 15].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r={1.6} />),
      )}
    </svg>
  );
}

function CourseCard({
  course,
  index,
  all,
  manage,
  lang,
  lit,
  litDish,
  asking,
  refused,
  dragging,
  onDragStart,
  onDragEnd,
  onDrop,
  onMove,
  onEdit,
  onAskDelete,
  onDelete,
  onKeep,
  onAnswer,
  onSkip,
  onAddDish,
  onEditDish,
  onAskRemove,
  onRemove,
  variants,
  choices,
}: {
  course: EvCourse;
  index: number;
  all: number;
  manage: boolean;
  lang: Lang;
  lit: boolean;
  litDish: string | null;
  asking: CoursesStart['asking'];
  refused: CoursesStart['refused'];
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDrop: () => void;
  onMove: (by: -1 | 1) => void;
  onEdit: () => void;
  onAskDelete: () => void;
  onDelete: () => void;
  onKeep: (back: string) => void;
  onAnswer: (answer: EvCourse['answer']) => void;
  onSkip: (skip: boolean) => void;
  onAddDish: () => void;
  onEditDish: (dish: EvDish) => void;
  onAskRemove: (dish: EvDish) => void;
  onRemove: (dish: EvDish) => void;
  variants: VariantHandlers;
  choices: ChoiceHandlers;
}) {
  const picked = useHasPicks();
  const ready = isReady(course);
  const hint = course.answer === 'same' ? courseHint(course.dishes) : null;
  const drafts = onlyDrafts(course);
  const sameOk = canSame(course);
  const asked = asking?.kind === 'course' && asking.courseId === course.id;

  return (
    <li
      className={['desk-card', 'mn-course', 'mc-course', lit && 'is-lit', dragging && 'is-dragging']
        .filter(Boolean)
        .join(' ')}
      aria-labelledby={`mc-c-${course.id}`}
      onDragOver={(event) => {
        if (manage) event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop();
      }}
    >
      <div className="mn-course-top mc-course-top">
        {manage && (
          <span
            className="mc-grip"
            draggable
            role="img"
            aria-label={CW.dragAria(course.name)}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', course.id);
              onDragStart();
            }}
            onDragEnd={onDragEnd}
          >
            <Grip />
          </span>
        )}
        <div className="mn-course-names">
          <p className="mn-eyebrow">{courseLine(index, all, course.servedAt)}</p>
          <h2 id={`mc-c-${course.id}`}>{course.name}</h2>
          <p className={ready ? 'mc-state is-ready' : 'mc-state is-empty'}>
            <span className={ready ? 'mc-ring is-ready' : 'mc-ring is-empty'} aria-hidden="true">
              {ready && <Glyph name="tick" size={12} weight={3} />}
            </span>
            {ready ? CW.readyTag : drafts ? CHW.noFinishedDish : CW.emptyTag}
          </p>
        </div>
        {manage && (
          <div className="lib-acts mc-acts" role="group" aria-label={CW.actionsFor(course.name)}>
            <HintButton
              id={`mc-up-${course.id}`}
              label={CW.moveUp(course.name)}
              hint={CW.moveUpHint}
              className="lib-act"
              disabled={index === 0}
              onClick={() => onMove(-1)}
            >
              <Glyph name="chevup" size={20} weight={2} />
            </HintButton>
            <HintButton
              id={`mc-down-${course.id}`}
              label={CW.moveDown(course.name)}
              hint={CW.moveDownHint}
              className="lib-act"
              disabled={index === all - 1}
              onClick={() => onMove(1)}
            >
              <Glyph name="chevdown" size={20} weight={2} />
            </HintButton>
            <HintButton
              id={`mc-edit-${course.id}`}
              label={CW.editAria(course.name)}
              hint={CW.editHint}
              className="lib-act"
              onClick={onEdit}
            >
              <ActionGlyph icon="edit" />
            </HintButton>
            <HintButton
              id={`mc-delete-${course.id}`}
              label={CW.deleteAria(course.name)}
              hint={CW.deleteHint}
              className="lib-act"
              onClick={onAskDelete}
            >
              <ActionGlyph icon="bin" />
            </HintButton>
          </div>
        )}
      </div>
      {refused?.kind === 'course' && refused.courseId === course.id && (
        <p className="mc-refused" role="status">
          <span className="mc-ring is-warn" aria-hidden="true">
            !
          </span>
          {CW.coursePicked}
        </p>
      )}
      {asked && (
        <div className="mn-ask">
          <p id={`mc-ask-${course.id}`} tabIndex={-1}>
            {CW.deleteAsk(course.name, course.dishes.length)}
          </p>
          <div className="mn-ask-acts">
            <button
              type="button"
              className="desk-text"
              onClick={() => onKeep(`mc-delete-${course.id}`)}
            >
              {CW.keepIt}
            </button>
            <Pill label={CW.deleteCourse} onClick={onDelete} />
          </div>
        </div>
      )}
      {course.dishes.length === 0 ? (
        <p className="mc-no-dishes">{CW.emptyCourse}</p>
      ) : (
        <ul className="mn-dishes">
          {course.dishes.map((dish) => (
            <DishRow
              key={dish.id}
              dish={dish}
              course={course}
              manage={manage}
              lang={lang}
              lit={litDish === dish.id}
              asking={asking?.kind === 'dish' && asking.dishId === dish.id}
              refused={refused?.kind === 'dish' && refused.dishId === dish.id}
              onEdit={() => onEditDish(dish)}
              onAskRemove={() => onAskRemove(dish)}
              onKeep={() => onKeep(`mc-remove-${dish.id}`)}
              onRemove={() => onRemove(dish)}
              variantAsk={
                asking?.kind === 'variant' && asking.dishId === dish.id ? asking.ask : null
              }
              addRefused={
                refused?.kind === 'addVariant' && refused.dishId === dish.id ? refused.why : null
              }
              variants={variants}
              choiceAsk={asking?.kind === 'choice' && asking.dishId === dish.id ? asking.ask : null}
              choiceRefused={
                refused?.kind === 'addChoice' && refused.dishId === dish.id ? refused.why : null
              }
              choices={choices}
            />
          ))}
        </ul>
      )}
      {manage ? (
        <div className="mc-settings">
          <fieldset className="mc-answer">
            <legend className="desk-label gs-label">{CW.howAnswer}</legend>
            <label className="mc-radio">
              <input
                type="radio"
                className="desk-radio"
                name={`mc-answer-${course.id}`}
                checked={course.answer === 'choose'}
                onChange={() => onAnswer('choose')}
              />
              {CW.choose}
            </label>
            <label className={sameOk ? 'mc-radio' : 'mc-radio is-off'}>
              <input
                type="radio"
                className="desk-radio"
                name={`mc-answer-${course.id}`}
                checked={course.answer === 'same'}
                aria-disabled={!sameOk || undefined}
                aria-describedby={sameOk ? undefined : `mc-same-${course.id}`}
                onChange={() => {
                  if (sameOk) onAnswer('same');
                }}
              />
              {CW.same}
            </label>
            {!sameOk && (
              <p id={`mc-same-${course.id}`} className="desk-help mc-same-note">
                {CW.sameNeedsOne}
              </p>
            )}
            {hint != null && (
              <p className="desk-help mc-same-note" role="status">
                {hint}
              </p>
            )}
          </fieldset>
          <div className="mc-skip">
            <span className="mc-skip-label" id={`mc-skip-${course.id}`}>
              {CW.skip}
            </span>
            <Switch
              on={course.skip}
              label={CW.skip}
              words={{ on: 'On', off: 'Off' }}
              {...(course.skip ? { told: `mc-skip-line-${course.id}` } : {})}
              onChange={onSkip}
            />
          </div>
          {course.skip && (
            <p id={`mc-skip-line-${course.id}`} className="desk-help">
              {CW.skipOn(course.name)}
            </p>
          )}
        </div>
      ) : (
        <ul className="mc-settings-read">
          <li>
            {course.answer === 'same' ? CW.same : CW.choose}
            {hint != null && <span className="mc-hint-read">{hint}</span>}
          </li>
          {course.skip && <li>{CW.skip}</li>}
        </ul>
      )}
      {(manage || picked) && (
        <div className="mn-course-foot">
          {manage && (
            <button
              id={`mc-add-dish-${course.id}`}
              type="button"
              className="mn-add-dish"
              onClick={onAddDish}
            >
              <Glyph name="plus" size={16} weight={2.4} />
              {CW.addDish}
            </button>
          )}
          <SeePicksLink course={course} />
        </div>
      )}
    </li>
  );
}

function DishRow({
  dish,
  course,
  manage,
  lang,
  lit,
  asking,
  refused,
  onEdit,
  onAskRemove,
  onKeep,
  onRemove,
  variantAsk,
  addRefused,
  variants,
  choiceAsk,
  choiceRefused,
  choices,
}: {
  dish: EvDish;
  course: EvCourse;
  manage: boolean;
  lang: Lang;
  lit: boolean;
  asking: boolean;
  refused: boolean;
  onEdit: () => void;
  onAskRemove: () => void;
  onKeep: () => void;
  onRemove: () => void;
  variantAsk: VariantAsk | null;
  addRefused: 'limit' | 'picked' | null;
  variants: VariantHandlers;
  choiceAsk: ChoiceAsk | null;
  choiceRefused: 'limit' | 'picked' | null;
  choices: ChoiceHandlers;
}) {
  const withVariants = hasVariants(dish);
  const withChoices = hasChoices(dish);
  const ways = variantsOf(dish).length;

  return (
    <li className={lit ? 'mn-dish mc-dish is-lit' : 'mn-dish mc-dish'}>
      <div className="mn-dish-top">
        <div className="mn-dish-words">
          <h3>{waysName(dish)}</h3>
          {dishHidden(dish) && <NotOffered variants={ways} />}
          {dish.desc !== '' && <p className="mn-quiet">{dish.desc}</p>}
          {!withVariants && <ContainsMark dish={dish} lang={lang} />}
          {!withVariants && dish.diets.length > 0 && (
            <ul className="lib-tags" aria-label={`${LW.suitableFor} · ${dish.name}`}>
              {dish.diets.map((diet) => (
                <li key={diet} className="lib-tag">
                  {dietName(diet, lang)}
                </li>
              ))}
            </ul>
          )}
          {withChoices && (
            <p className="mn-quiet">{withVariants ? CHW.plusVariantOptions : CHW.plusOptions}</p>
          )}
          <DishPicks id={dish.id} />
        </div>
        {manage && (
          <div className="lib-acts" role="group" aria-label={CW.actionsFor(dish.name)}>
            <AddVariantButton
              id={`mc-addv-${dish.id}`}
              dish={dish.name}
              onClick={() => variants.onAdd(dish)}
            />
            <AddChoiceButton
              id={`mc-addch-${dish.id}`}
              dish={dish.name}
              onClick={() => choices.onAdd(dish)}
            />
            <HintButton
              id={`mc-edit-${dish.id}`}
              label={CW.editAria(dish.name)}
              hint={CW.editHint}
              className="lib-act"
              onClick={onEdit}
            >
              <ActionGlyph icon="edit" />
            </HintButton>
            <HintButton
              id={`mc-remove-${dish.id}`}
              label={CW.removeAria(dish.name)}
              hint={CW.removeHint}
              className="lib-act"
              onClick={onAskRemove}
            >
              <ActionGlyph icon="remove" />
            </HintButton>
          </div>
        )}
      </div>
      {addRefused != null && (
        <RowLine
          id={`mc-vrow-${dish.id}`}
          words={[addRefused === 'limit' ? VW.limit : VW.dishPicked]}
        />
      )}
      {choiceRefused != null && (
        <RowLine
          id={`mc-chrow-${dish.id}`}
          words={[choiceRefused === 'limit' ? CHW.choicesLimit : CHW.dishPicked]}
        />
      )}
      {withVariants && withChoices && <p className="ch-head">{CHW.variantsHead}</p>}
      {withVariants && (
        <VariantInsets
          dish={dish}
          where="event"
          ids="mc"
          manage={manage}
          budget={variants.budget}
          lang={lang}
          asking={variantAsk}
          lit={variants.lit}
          onEdit={(variant) => variants.onEdit(dish, variant)}
          onRemove={(variant) => variants.onRemove(dish, variant)}
          onKeep={variants.onKeep}
          onConfirmRemove={(variant) => variants.onConfirmRemove(dish, variant)}
          onConfirmFold={(variant) => variants.onConfirmFold(dish, variant)}
        />
      )}
      {withChoices && (
        <ChoiceInsets
          dish={dish}
          manage={manage}
          lang={lang}
          asking={choiceAsk}
          lit={choices.lit}
          onEdit={(choice) => choices.onEdit(dish, choice)}
          onRemove={(choice) => choices.onRemove(dish, choice)}
          onKeep={choices.onKeep}
          onConfirmRemove={(choice) => choices.onConfirmRemove(dish, choice)}
        />
      )}
      {refused && (
        <p className="mc-refused" role="status">
          <span className="mc-ring is-warn" aria-hidden="true">
            !
          </span>
          {CW.dishPicked}
        </p>
      )}
      {asking && (
        <div className="mn-ask">
          <p id={`mc-ask-${dish.id}`} tabIndex={-1}>
            {CW.removeAsk(dish.name, course.name, dish.libraryId != null)}
          </p>
          <div className="mn-ask-acts">
            <button type="button" className="desk-text" onClick={onKeep}>
              {CW.keepIt}
            </button>
            <Pill label={CW.removeDish} onClick={onRemove} />
          </div>
        </div>
      )}
    </li>
  );
}
