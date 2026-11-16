import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import { Switch } from '../components/GeneralParts.tsx';
import { HintButton } from '../components/HintButton.tsx';
import type { Tell } from '../components/SettingsParts.tsx';
import { DemoBell } from './DemoBell.tsx';
import { DemoOffline } from './DemoOffline.tsx';
import { EventsShell } from './EventParts.tsx';
import { EventSidebar } from './EventSidebar.tsx';
import { type SampleEvent } from './events.ts';
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
  moveCourse,
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

  return (
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
          />
        </div>
      )}
    >
      {(tell) => (
        <div className="desk-page ev-page gs mn mc">
          <div className="ev-wide mn-page">
            <Crumbs
              event={event}
              tell={tell}
              navOpen={navOpen}
              onNav={() => setNavOpen((now) => !now)}
            />
            <Body first={first} lang={lang} budget={budget} tell={tell} />
          </div>
        </div>
      )}
    </EventsShell>
  );
}

function Crumbs({
  event,
  tell,
  navOpen,
  onNav,
}: {
  event: SampleEvent;
  tell: Tell;
  navOpen: boolean;
  onNav: () => void;
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
}: {
  first: CoursesStart;
  lang: Lang;
  budget: boolean;
  tell: Tell;
}) {
  const [retried, setRetried] = useState(false);
  if (first.system === 'noAccess')
    return (
      <Refusal title={CW.noAccessTitle} body={CW.noAccessBody} action={null} onAction={() => {}} />
    );
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

  return <Courses first={first} lang={lang} budget={budget} />;
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
    };

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
  const dish = first.courses
    .flatMap((one) => one.dishes)
    .find((one) => one.id === o.dishId) as EvDish;

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

/** A state that opens pressed puts focus where a press would: the first field refused, or the limit line. */
function firstFocus(open: Open | null): string | null {
  if (open == null || !open.pressed) return null;
  if (open.kind === 'addDish' || open.kind === 'editDish')
    return firstProblem(checkDish(open.form, 'en', false));

  return firstCourseProblem(checkCourse(open.form)) ?? (open.full ? 'mc-form-full' : null);
}

function Courses({ first, lang, budget }: { first: CoursesStart; lang: Lang; budget: boolean }) {
  const [courses, setCourses] = useState(first.courses);
  const [open, setOpen] = useState<Open | null>(() => openOf(first, lang));
  const [asking, setAsking] = useState(first.asking);
  const [refused, setRefused] = useState(first.refused);
  const [said, setSaid] = useState<Told | null>(
    first.said === '' ? null : { words: first.said, more: first.saidMore ?? null },
  );
  const [dragging, setDragging] = useState<string | null>(null);
  const failing = useRef(first.failing);
  const focusAfter = useRef<string | null>(firstFocus(open));
  const manage = first.manage;
  const lines = headerLines(courses);
  const openCourse =
    open == null || open.courseId == null
      ? null
      : (courses.find((one) => one.id === open.courseId) ?? null);

  useEffect(() => {
    if (focusAfter.current == null) return;
    document.getElementById(focusAfter.current)?.focus();
    focusAfter.current = null;
  });

  function settle() {
    setRefused(null);
    setAsking(null);
  }

  function failsNow(): 'none' | 'network' | 'forbidden' {
    const now = failing.current;
    failing.current = 'none';

    return now;
  }

  function tellDone(words: string, more: string | null = null) {
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
    const libDish = SAMPLE_LIBRARY.find((one) => one.id === libraryId);
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
    const problem = firstProblem(checkDish(open.form, lang, false));
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
    const contains = open.form.none ? 'none' : open.form.allergens.slice();
    const next: EvDish = {
      ...dish,
      name: open.form.name.trim(),
      desc: open.form.desc.trim(),
      contains,
      diets: open.form.diets.slice(),
    };
    changeCourse(openCourse.id, (one) => ({
      ...one,
      dishes: one.dishes.map((d) => (d.id === dish.id ? next : d)),
    }));
    setOpen(null);
    tellDone(CW.saved(next.name), addedAllergenLine(dish, dish.contains, contains, lang));
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
          {CW.lock}
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
        {open != null && (
          <aside className="mn-panel mc-panel" aria-labelledby="mc-panel-title">
            <button type="button" className="desk-text mc-back" onClick={() => close(closeBack())}>
              <Glyph name="back" size={16} weight={2.4} />
              {CW.backToMenu}
            </button>
            <div className="mn-panel-top">
              <div className="mn-panel-names">
                {openCourse != null && <p className="mn-eyebrow">{openCourse.name}</p>}
                <h2 id="mc-panel-title" tabIndex={-1}>
                  {panelTitle(open)}
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
                  library={SAMPLE_LIBRARY}
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
                  errors={open.pressed ? checkDish(open.form, lang, false) : null}
                  onPatch={(next) => setOpen({ ...open, form: { ...open.form, ...next } })}
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
                      else saveDish();
                    }}
                  >
                    {saveLabel(open)}
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

function panelTitle(open: Open): string {
  if (open.kind === 'addCourse') return CW.addCourse;
  if (open.kind === 'editCourse') return CW.editCourse;
  if (open.kind === 'addDish') return CW.addDish;

  return CW.editDish;
}

function saveLabel(open: Open): string {
  if (open.kind === 'addCourse') return CW.addCourse;
  if (open.kind === 'addDish') return CW.addDish;

  return CW.saveChanges;
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
}) {
  const ready = isReady(course);
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
            {ready ? CW.readyTag : CW.emptyTag}
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
          <li>{course.answer === 'same' ? CW.same : CW.choose}</li>
          {course.skip && <li>{CW.skip}</li>}
        </ul>
      )}
      {manage && (
        <div className="mn-course-foot">
          <button
            id={`mc-add-dish-${course.id}`}
            type="button"
            className="mn-add-dish"
            onClick={onAddDish}
          >
            <Glyph name="plus" size={16} weight={2.4} />
            {CW.addDish}
          </button>
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
}) {
  return (
    <li className={lit ? 'mn-dish mc-dish is-lit' : 'mn-dish mc-dish'}>
      <div className="mn-dish-top">
        <div className="mn-dish-words">
          <h3>{dish.name}</h3>
          {dish.desc !== '' && <p className="mn-quiet">{dish.desc}</p>}
          <ContainsMark dish={dish} lang={lang} />
          {dish.diets.length > 0 && (
            <ul className="lib-tags" aria-label={`${LW.suitableFor} · ${dish.name}`}>
              {dish.diets.map((diet) => (
                <li key={diet} className="lib-tag">
                  {dietName(diet, lang)}
                </li>
              ))}
            </ul>
          )}
        </div>
        {manage && (
          <div className="lib-acts" role="group" aria-label={CW.actionsFor(dish.name)}>
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
