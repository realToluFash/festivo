import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router';

import { Glyph, type GlyphName } from '../components/Glyph.tsx';
import type { Tell } from '../components/SettingsParts.tsx';
import { DemoBell } from './DemoBell.tsx';
import { EventsShell } from './EventParts.tsx';
import { EventSidebar } from './EventSidebar.tsx';
import { type SampleEvent, sampleEvent } from './events.ts';
import { Pill } from './GuestsParts.tsx';
import { clockOfKitchen, kitchenAt } from './kitchen.ts';
import { keptInbox, waitingLine } from './messages.ts';
import {
  type Course,
  type Dish,
  type FixedPart,
  type HowServed,
  type MenuStart,
  type Panel,
  type Part,
  type PartErrors,
  type Table,
  HOW_SERVED,
  MAX_OWN,
  MAX_PARTS,
  MENU_EVENT,
  MW,
  canAdd,
  checkOwn,
  checkParts,
  hasErrors,
  isDraftPart,
  keptHidden,
  menuStart,
  moved,
  movedLine,
  mw,
  offeredChoices,
  partName,
  platedTables,
  removeChoiceLine,
  removedLine,
  shownName,
  tableLabel,
  usesParts,
  usesPlatedAt,
  withoutChoice,
} from './menuServed.ts';
import { useSwitcherStart } from './switcher.ts';
import './guests.css';
import './menu.css';

/** The event's Menu at a desk (board MenuServing, page e32): sc-3902's course cards and docked panel, with sc-34230's How it's served, Parts, Served with this course and Plated at. */
export function MenuPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const raw = params.get('state');
  useSwitcherStart();

  return <MenuAt key={`${id ?? ''}|${raw ?? ''}`} id={id} raw={raw} />;
}

function MenuAt({ id, raw }: { id: string | undefined; raw: string | null }) {
  const [event] = useState(() => sampleEvent(id));
  const [first] = useState(() => menuStart(raw));

  if (event == null) return <Navigate to="/demo/events" replace />;
  if (event.id !== MENU_EVENT)
    return <Navigate to={`/demo/events/${event.id}?area=menu`} replace />;

  return (
    <EventsShell
      renderSide={(tell, covered) => (
        <EventSidebar
          event={event}
          area="menu"
          now={clockOfKitchen()}
          tell={tell}
          inert={covered}
          waiting={waitingLine(keptInbox())}
        />
      )}
    >
      {(tell) => <Menu first={first} event={event} tell={tell} />}
    </EventsShell>
  );
}

let made = 0;
function newKey(): string {
  made += 1;
  return `n${made}`;
}

interface CourseForm {
  name: string;
  servedAt: string;
  how: HowServed;
  own: FixedPart[];
  platedAt: string[];
}

interface DishForm {
  name: string;
  desc: string;
  parts: Part[];
}

interface Form {
  course: CourseForm;
  dish: DishForm | null;
  pressed: boolean;
  addRefused: boolean;
  failed: boolean;
}

function courseForm(course: Course): CourseForm {
  return {
    name: course.name,
    servedAt: course.servedAt ?? '',
    how: course.howServed,
    own: course.ownParts.slice(),
    platedAt: course.platedAt.slice(),
  };
}

function formOf(panel: Panel, courses: readonly Course[], first: MenuStart | null): Form {
  const course = courses.find((one) => one.id === panel.courseId) as Course;
  const dish = panel.kind === 'dish' ? course.dishes.find((one) => one.id === panel.dishId) : null;
  const base = courseForm(course);

  return {
    course: {
      ...base,
      how: first?.how ?? base.how,
      own: first?.own ?? base.own,
    },
    dish:
      dish == null
        ? null
        : { name: dish.name, desc: dish.desc, parts: first?.parts ?? dish.parts.slice() },
    pressed: false,
    addRefused: false,
    failed: false,
  };
}

const NO_ERRORS: PartErrors = { list: null, byKey: {} };

function Menu({ first, event, tell }: { first: MenuStart; event: SampleEvent; tell: Tell }) {
  const [courses, setCourses] = useState(first.courses);
  const [panel, setPanel] = useState<Panel | null>(first.panel);
  const [form, setForm] = useState<Form | null>(() =>
    first.panel == null ? null : formOf(first.panel, first.courses, first),
  );
  const [asking, setAsking] = useState(first.asking ?? null);
  const [said, setSaid] = useState(first.told ?? '');
  const [moveSaid, setMoveSaid] = useState('');
  const focusAfter = useRef<string | null>(null);
  const started = useRef(false);
  const manage = first.manage;

  const course = panel == null ? null : (courses.find((one) => one.id === panel.courseId) ?? null);
  const dish =
    panel?.kind === 'dish' && course != null
      ? (course.dishes.find((one) => one.id === panel.dishId) ?? null)
      : null;
  const how = form?.course.how ?? course?.howServed ?? 'plated';

  const dishErrors =
    form?.pressed === true && form.dish != null && dish != null && usesParts(how)
      ? checkParts(form.dish.parts, dish)
      : NO_ERRORS;
  const ownErrors =
    form?.pressed === true && panel?.kind === 'course' && usesParts(how)
      ? checkOwn(form.course.own)
      : NO_ERRORS;
  const nameError =
    form?.pressed === true &&
    (panel?.kind === 'dish' ? form.dish?.name.trim() === '' : form.course.name.trim() === '')
      ? panel?.kind === 'dish'
        ? MW.dishName
        : MW.courseName
      : null;

  useEffect(() => {
    if (focusAfter.current == null) return;
    document.getElementById(focusAfter.current)?.focus();
    focusAfter.current = null;
  });

  useEffect(() => {
    if (started.current || form == null) return;
    started.current = true;
    if (first.pressSave === true) save();
    if (first.pressAdd === 'part') addPart();
    if (first.pressAdd === 'own') addOwn();
    if (first.moveFirst != null && form.dish != null) {
      const at = form.dish.parts.findIndex((one) => one.key === first.moveFirst?.key);
      if (at >= 0) movePart(at, first.moveFirst.by);
    }
  });

  function open(next: Panel) {
    setPanel(next);
    setForm(formOf(next, courses, null));
    setMoveSaid('');
    setSaid('');
    focusAfter.current = 'mn-panel-title';
  }

  function close() {
    const back =
      panel == null
        ? null
        : panel.kind === 'dish'
          ? `mn-edit-${panel.dishId}`
          : `mn-edit-${panel.courseId}`;
    setPanel(null);
    setForm(null);
    setMoveSaid('');
    focusAfter.current = back;
  }

  function patch(next: Partial<Form>) {
    setForm((now) => (now == null ? now : { ...now, ...next }));
  }

  function patchCourse(next: Partial<CourseForm>) {
    setForm((now) => (now == null ? now : { ...now, course: { ...now.course, ...next } }));
  }

  function setParts(parts: Part[]) {
    setForm((now) =>
      now?.dish == null ? now : { ...now, addRefused: false, dish: { ...now.dish, parts } },
    );
  }

  function addPart() {
    if (form?.dish == null) return;
    if (!canAdd(form.dish.parts, MAX_PARTS)) {
      patch({ addRefused: true });
      return;
    }
    const key = newKey();
    setParts([...form.dish.parts, { key, kind: 'fixed', name: '' }]);
    focusAfter.current = `mn-part-${key}`;
  }

  function addChoice(choiceId: string) {
    if (form?.dish == null) return;
    if (!canAdd(form.dish.parts, MAX_PARTS)) {
      patch({ addRefused: true });
      return;
    }
    setParts([...form.dish.parts, { key: newKey(), kind: 'choice', choiceId }]);
  }

  function addOwn() {
    if (form == null) return;
    if (!canAdd(form.course.own, MAX_OWN)) {
      patch({ addRefused: true });
      return;
    }
    const key = newKey();
    patch({ addRefused: false });
    patchCourse({ own: [...form.course.own, { key, kind: 'fixed', name: '' }] });
    focusAfter.current = `mn-own-${key}`;
  }

  function movePart(at: number, by: -1 | 1) {
    if (form?.dish == null || dish == null) return;
    const next = moved(form.dish.parts, at, by);
    if (next == null) return;
    const part = form.dish.parts[at] as Part;
    setParts(next);
    setMoveSaid(movedLine(partName(part, dish), at + by, next.length));
  }

  function moveOwn(at: number, by: -1 | 1) {
    if (form == null) return;
    const next = moved(form.course.own, at, by);
    if (next == null) return;
    const part = form.course.own[at] as FixedPart;
    patchCourse({ own: next });
    setMoveSaid(movedLine(part.name, at + by, next.length));
  }

  function save() {
    if (form == null || panel == null || course == null) return;
    const ownCheck =
      panel.kind === 'course' && usesParts(how) ? checkOwn(form.course.own) : NO_ERRORS;
    const partsCheck =
      form.dish != null && dish != null && usesParts(how)
        ? checkParts(form.dish.parts, dish)
        : NO_ERRORS;
    const blankName =
      panel.kind === 'dish' ? form.dish?.name.trim() === '' : form.course.name.trim() === '';

    if (blankName || hasErrors(ownCheck) || hasErrors(partsCheck)) {
      setForm({ ...form, pressed: true, failed: false });
      focusAfter.current = firstWrong(blankName, partsCheck, ownCheck, form);
      return;
    }

    if (first.refuses === true) {
      setForm({ ...form, pressed: true, failed: true });
      focusAfter.current = 'mn-failed';
      return;
    }

    const name = panel.kind === 'dish' ? (form.dish?.name ?? '') : form.course.name;
    setCourses(courses.map((one) => (one.id === course.id ? applied(one, panel, form) : one)));
    close();
    setSaid(mw(MW.saved, { name: name.trim() }));
  }

  function removeChoice(dishId: string, choiceId: string) {
    const holder = courses.find((one) => one.dishes.some((d) => d.id === dishId));
    const target = holder?.dishes.find((d) => d.id === dishId);
    const choice = target?.choices.find((one) => one.id === choiceId);
    if (holder == null || target == null || choice == null) return;

    setCourses(
      courses.map((one) =>
        one.id !== holder.id
          ? one
          : {
              ...one,
              dishes: one.dishes.map((d) => (d.id === dishId ? withoutChoice(d, choiceId) : d)),
            },
      ),
    );
    if (panel?.kind === 'dish' && panel.dishId === dishId) {
      setForm((now) =>
        now?.dish == null
          ? now
          : {
              ...now,
              dish: {
                ...now.dish,
                parts: withoutChoice({ ...target, parts: now.dish.parts }, choiceId).parts.slice(),
              },
            },
      );
    }
    setAsking(null);
    setSaid(removedLine(target, choice));
  }

  return (
    <div className="desk-page ev-page gs mn">
      <div className="ev-wide mn-page">
        <div className="ev-crumb-row">
          <nav className="ev-crumb" aria-label={MW.crumb}>
            <ol>
              <li className="ev-crumb-part">
                <Link to="/demo/events">{MW.events}</Link>
              </li>
              <li className="ev-crumb-part">
                <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
                <Link className="ev-crumb-name" to={`/demo/events/${event.id}`}>
                  {event.name}
                </Link>
              </li>
              <li className="ev-crumb-part" aria-current="page">
                <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
                <span className="ev-crumb-name">{MW.title}</span>
              </li>
            </ol>
          </nav>
          <DemoBell tell={tell} />
        </div>
        <header className="gs-top">
          <div className="mn-head">
            <h1 className="gs-title">{MW.title}</h1>
            <p className="mn-sub">{MW.sub}</p>
          </div>
          <Link className="desk-text" to={kitchenAt(event.id)}>
            {MW.kitchen}
            <Glyph name="chevron" size={16} weight={2.4} />
          </Link>
        </header>
        {!manage && (
          <p className="mn-lock">
            <Glyph name="lock" size={16} weight={2.2} />
            {MW.lock}
          </p>
        )}
        <p className="mn-said" role="status">
          {said !== '' && (
            <>
              <Glyph name="tick" size={17} weight={2.6} />
              {said}
            </>
          )}
        </p>
        <div className="mn-split">
          <div className="mn-list">
            {courses.map((one, index) => (
              <CourseCard
                key={one.id}
                course={one}
                index={index}
                tables={first.tables}
                manage={manage}
                editing={panel}
                asking={asking}
                onEdit={(next) => open(next)}
                onAsk={(dishId, choiceId) => {
                  setAsking({ dishId, choiceId });
                  focusAfter.current = `mn-ask-${choiceId}`;
                }}
                onKeep={(choiceId) => {
                  setAsking(null);
                  focusAfter.current = `mn-rm-${choiceId}`;
                }}
                onRemove={removeChoice}
                onAddDish={() => tell('Add dish is sc-3902’s, drawn on the Menu board.')}
              />
            ))}
          </div>
          {panel != null && form != null && course != null && (
            <aside className="mn-panel" aria-labelledby="mn-panel-title">
              <div className="mn-panel-top">
                <div className="mn-panel-names">
                  <p className="mn-eyebrow">
                    {dish == null ? `${course.name}` : `${course.name} · ${MW.ways[how]}`}
                  </p>
                  <h2 id="mn-panel-title" tabIndex={-1}>
                    {panel.kind === 'dish' ? MW.editDish : MW.editCourse}
                  </h2>
                </div>
                <button
                  type="button"
                  className="ev-round mn-close"
                  aria-label={MW.close}
                  onClick={close}
                >
                  <Glyph name="clear" size={16} weight={2.4} />
                </button>
              </div>
              <div className="mn-panel-body">
                {panel.kind === 'course' ? (
                  <CourseFields
                    form={form}
                    course={course}
                    tables={first.tables}
                    nameError={nameError}
                    ownErrors={ownErrors}
                    moveSaid={moveSaid}
                    onCourse={patchCourse}
                    onAddOwn={addOwn}
                    onMoveOwn={moveOwn}
                  />
                ) : (
                  dish != null &&
                  form.dish != null && (
                    <DishFields
                      dishForm={form.dish}
                      dish={dish}
                      how={how}
                      nameError={nameError}
                      errors={dishErrors}
                      addRefused={form.addRefused}
                      moveSaid={moveSaid}
                      onDish={(next) =>
                        setForm((now) =>
                          now?.dish == null ? now : { ...now, dish: { ...now.dish, ...next } },
                        )
                      }
                      onAdd={addPart}
                      onAddChoice={addChoice}
                      onMove={movePart}
                    />
                  )
                )}
              </div>
              <div className="mn-panel-foot">
                {form.failed && (
                  <p id="mn-failed" className="mn-failed" role="alert" tabIndex={-1}>
                    <Glyph name="alert" size={16} weight={2.2} />
                    {MW.forbidden}
                  </p>
                )}
                <div className="mn-panel-acts">
                  <button type="button" className="desk-text" onClick={close}>
                    {MW.cancel}
                  </button>
                  <Pill label={MW.save} primary onClick={save} />
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}

function firstWrong(
  blankName: boolean,
  parts: PartErrors,
  own: PartErrors,
  form: Form,
): string | null {
  if (blankName) return 'mn-name';
  const dishKey = form.dish?.parts.find((one) => parts.byKey[one.key] != null)?.key;
  if (dishKey != null) {
    const part = form.dish?.parts.find((one) => one.key === dishKey);
    return part?.kind === 'fixed' ? `mn-part-${dishKey}` : `mn-up-${dishKey}`;
  }
  if (parts.list != null) return 'mn-add-part';
  const ownKey = form.course.own.find((one) => own.byKey[one.key] != null)?.key;
  return ownKey == null ? null : `mn-own-${ownKey}`;
}

function applied(course: Course, panel: Panel, form: Form): Course {
  if (panel.kind === 'course') {
    const tidy = form.course.own.map((one) => ({ ...one, name: one.name.trim() }));
    return {
      ...course,
      name: form.course.name.trim(),
      servedAt: form.course.servedAt.trim() === '' ? null : form.course.servedAt.trim(),
      howServed: form.course.how,
      ownParts: tidy,
      platedAt: form.course.platedAt,
    };
  }

  const draft = form.dish;
  if (draft == null) return course;
  const parts = draft.parts.map((one) =>
    one.kind === 'fixed' ? { ...one, name: one.name.trim() } : one,
  );

  return {
    ...course,
    dishes: course.dishes.map((one) =>
      one.id === panel.dishId ? { ...one, name: draft.name.trim(), desc: draft.desc, parts } : one,
    ),
  };
}

function HowChip({ how }: { how: HowServed }) {
  return <span className={`mn-how is-${how}`}>{MW.ways[how]}</span>;
}

function CourseCard({
  course,
  index,
  tables,
  manage,
  editing,
  asking,
  onEdit,
  onAsk,
  onKeep,
  onRemove,
  onAddDish,
}: {
  course: Course;
  index: number;
  tables: readonly Table[];
  manage: boolean;
  editing: Panel | null;
  asking: { dishId: string; choiceId: string } | null;
  onEdit: (panel: Panel) => void;
  onAsk: (dishId: string, choiceId: string) => void;
  onKeep: (choiceId: string) => void;
  onRemove: (dishId: string, choiceId: string) => void;
  onAddDish: () => void;
}) {
  const parted = usesParts(course.howServed);
  const plated = platedTables(course, tables);
  const lit = editing?.kind === 'course' && editing.courseId === course.id;

  return (
    <article
      className={lit ? 'desk-card mn-course is-lit' : 'desk-card mn-course'}
      aria-labelledby={`mn-c-${course.id}`}
    >
      <div className="mn-course-top">
        <div className="mn-course-names">
          <p className="mn-eyebrow">{mw(MW.course, { n: index + 1 })}</p>
          <h2 id={`mn-c-${course.id}`}>{course.name}</h2>
          <p className="mn-course-line">
            {course.servedAt != null && <span>{mw(MW.servedAt, { time: course.servedAt })}</span>}
            <span className="mn-how-line">
              <span className="desk-unseen">{MW.how}: </span>
              <HowChip how={course.howServed} />
            </span>
          </p>
        </div>
        {manage && (
          <IconButton
            id={`mn-edit-${course.id}`}
            glyph="pen"
            label={mw(MW.editAria, { name: course.name })}
            hint={MW.editCourse}
            onClick={() => onEdit({ kind: 'course', courseId: course.id })}
          />
        )}
      </div>
      {(parted && course.ownParts.length > 0) || usesPlatedAt(course.howServed) ? (
        <dl className="mn-course-facts">
          {parted && course.ownParts.length > 0 && (
            <div>
              <dt>{MW.own}</dt>
              <dd>{course.ownParts.map((one) => one.name).join(' · ')}</dd>
            </div>
          )}
          {usesPlatedAt(course.howServed) && (
            <div>
              <dt>{MW.platedAt}</dt>
              <dd>
                {plated.length === 0 ? MW.noneChosen : plated.map((one) => one.name).join(' · ')}
              </dd>
            </div>
          )}
        </dl>
      ) : null}
      <ul className="mn-dishes">
        {course.dishes.map((dish) => (
          <DishRow
            key={dish.id}
            dish={dish}
            parted={parted}
            manage={manage}
            lit={editing?.kind === 'dish' && editing.dishId === dish.id}
            asking={asking?.dishId === dish.id ? asking.choiceId : null}
            onEdit={() => onEdit({ kind: 'dish', courseId: course.id, dishId: dish.id })}
            onAsk={(choiceId) => onAsk(dish.id, choiceId)}
            onKeep={onKeep}
            onRemove={(choiceId) => onRemove(dish.id, choiceId)}
          />
        ))}
      </ul>
      {manage && (
        <div className="mn-course-foot">
          <button type="button" className="mn-add-dish" onClick={onAddDish}>
            <Glyph name="plus" size={16} weight={2.4} />
            {MW.addDish}
          </button>
        </div>
      )}
    </article>
  );
}

function DishRow({
  dish,
  parted,
  manage,
  lit,
  asking,
  onEdit,
  onAsk,
  onKeep,
  onRemove,
}: {
  dish: Dish;
  parted: boolean;
  manage: boolean;
  lit: boolean;
  asking: string | null;
  onEdit: () => void;
  onAsk: (choiceId: string) => void;
  onKeep: (choiceId: string) => void;
  onRemove: (choiceId: string) => void;
}) {
  return (
    <li className={lit ? 'mn-dish is-lit' : 'mn-dish'}>
      <div className="mn-dish-top">
        <div className="mn-dish-words">
          <h3>{dish.name}</h3>
          {dish.desc !== '' && <p className="mn-quiet">{dish.desc}</p>}
          <p className="mn-contains">
            <span className="mn-contains-mark" aria-hidden="true">
              !
            </span>
            {`${MW.contains} ${dish.contains.join(', ')}`}
          </p>
          {dish.variants.length > 0 && (
            <p className="mn-quiet">{`${MW.variants}: ${dish.variants.join(' · ')}`}</p>
          )}
        </div>
        {manage && (
          <IconButton
            id={`mn-edit-${dish.id}`}
            glyph="pen"
            label={mw(MW.editAria, { name: dish.name })}
            hint={MW.editDish}
            onClick={onEdit}
          />
        )}
      </div>
      {parted && <PartsLine dish={dish} />}
      {dish.choices.length > 0 && (
        <ul className="mn-choices" aria-label={`${MW.choices} · ${dish.name}`}>
          {dish.choices.map((choice, index) => {
            const title =
              choice.question.trim() === ''
                ? mw(MW.choiceDraft, { k: index + 1 })
                : choice.question;
            return (
              <li
                key={choice.id}
                className={choice.question.trim() === '' ? 'mn-choice is-draft' : 'mn-choice'}
              >
                <div className="mn-choice-top">
                  <div className="mn-dish-words">
                    <h4>
                      {title}
                      {choice.question.trim() === '' && <DraftTag />}
                    </h4>
                    <p className="mn-quiet">{choice.options.join(' · ')}</p>
                  </div>
                  {manage && (
                    <IconButton
                      id={`mn-rm-${choice.id}`}
                      glyph="clear"
                      label={mw(MW.removeChoiceAria, { q: title })}
                      hint={MW.remove}
                      onClick={() => onAsk(choice.id)}
                    />
                  )}
                </div>
                {asking === choice.id && (
                  <div className="mn-ask">
                    <p id={`mn-ask-${choice.id}`} tabIndex={-1}>
                      {removeChoiceLine(dish, choice, index)}
                    </p>
                    <div className="mn-ask-acts">
                      <button type="button" className="desk-text" onClick={() => onKeep(choice.id)}>
                        {MW.keepIt}
                      </button>
                      <Pill label={MW.removeChoice} onClick={() => onRemove(choice.id)} />
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

function DraftTag() {
  return (
    <span className="mn-draft">
      <Glyph name="pen" size={12} weight={2.6} />
      {MW.draft}
    </span>
  );
}

function PartsLine({ dish }: { dish: Dish }) {
  if (dish.parts.length === 0) return <p className="mn-one-plate">{MW.onePlate}</p>;

  return (
    <div className="mn-parts-line">
      <p className="mn-parts-head">{dish.variants.length > 0 ? MW.partsOn : MW.parts}</p>
      <ol className="mn-part-chips">
        {dish.parts.map((part) => (
          <li
            key={part.key}
            className={[
              'mn-part-chip',
              part.kind === 'choice' && 'is-choice',
              isDraftPart(part, dish) && 'is-draft',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {part.kind === 'choice' && <Glyph name="question" size={14} weight={2.2} />}
            {partName(part, dish)}
          </li>
        ))}
      </ol>
    </div>
  );
}

function IconButton({
  id,
  glyph,
  label,
  hint,
  disabled = false,
  onClick,
}: {
  id: string;
  glyph: GlyphName;
  label: string;
  hint: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <span className="mn-icon">
      <button
        id={id}
        type="button"
        className="ev-round mn-icon-button"
        aria-label={label}
        aria-disabled={disabled || undefined}
        onClick={() => {
          if (!disabled) onClick();
        }}
      >
        <Glyph name={glyph} size={18} weight={2.3} />
      </button>
      <span className="mn-hint" aria-hidden="true">
        {hint}
      </span>
    </span>
  );
}

function Optional() {
  return <span className="gs-optional">{MW.optional}</span>;
}

function Wrong({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="desk-error">
      <Glyph name="alert" size={15} weight={2.2} />
      {children}
    </p>
  );
}

function TextField({
  id,
  label,
  value,
  error,
  help,
  optional = false,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error?: string | null;
  help?: string;
  optional?: boolean;
  onChange: (value: string) => void;
}) {
  const told = [help == null ? null : `${id}-help`, error == null ? null : `${id}-error`]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="desk-field">
      <label htmlFor={id} className="desk-label gs-label">
        {label}
        {optional && <Optional />}
      </label>
      <div className={error == null ? 'desk-box' : 'desk-box is-wrong'}>
        <input
          id={id}
          type="text"
          value={value}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={error != null}
          aria-describedby={told === '' ? undefined : told}
          onChange={(change) => onChange(change.target.value)}
        />
      </div>
      {help != null && (
        <p id={`${id}-help`} className="desk-help">
          {help}
        </p>
      )}
      {error != null && <Wrong id={`${id}-error`}>{error}</Wrong>}
    </div>
  );
}

function CourseFields({
  form,
  course,
  tables,
  nameError,
  ownErrors,
  moveSaid,
  onCourse,
  onAddOwn,
  onMoveOwn,
}: {
  form: Form;
  course: Course;
  tables: readonly Table[];
  nameError: string | null;
  ownErrors: PartErrors;
  moveSaid: string;
  onCourse: (next: Partial<CourseForm>) => void;
  onAddOwn: () => void;
  onMoveOwn: (at: number, by: -1 | 1) => void;
}) {
  const radios = useId();
  const how = form.course.how;
  const hidden = keptHidden({
    ...course,
    howServed: how,
    ownParts: form.course.own,
  });

  return (
    <>
      <TextField
        id="mn-name"
        label={MW.name}
        value={form.course.name}
        error={nameError}
        onChange={(name) => onCourse({ name })}
      />
      <TextField
        id="mn-served"
        label={MW.served24}
        value={form.course.servedAt}
        help={MW.servedHelp}
        optional
        onChange={(servedAt) => onCourse({ servedAt })}
      />
      <fieldset className="mn-how-set" aria-describedby={`${radios}-line`}>
        <legend className="desk-label gs-label">{MW.how}</legend>
        <div className="mn-radios">
          {HOW_SERVED.map((one) => (
            <label key={one} className={one === how ? 'mn-radio is-picked' : 'mn-radio'}>
              <input
                type="radio"
                className="desk-radio"
                name={radios}
                checked={one === how}
                onChange={() => onCourse({ how: one })}
              />
              {MW.ways[one]}
            </label>
          ))}
        </div>
        <p id={`${radios}-line`} className="mn-served-line">
          {MW.served[how]}
        </p>
      </fieldset>
      {hidden && (
        <p className="mn-kept">
          <Glyph name="info" size={16} weight={2.2} />
          {MW.kept}
        </p>
      )}
      {usesParts(how) && (
        <fieldset className="mn-parts" aria-describedby="mn-own-help">
          <legend className="desk-label gs-label">
            {MW.own}
            <Optional />
          </legend>
          <p id="mn-own-help" className="desk-help">
            {MW.ownHelp}
          </p>
          <p className="mn-moved" role="status">
            {moveSaid}
          </p>
          {form.course.own.length > 0 && (
            <ol className="mn-part-rows">
              {form.course.own.map((part, at) => {
                const error = ownErrors.byKey[part.key];
                return (
                  <li key={part.key} className="mn-part-row">
                    <span className="mn-part-n" aria-hidden="true">
                      {at + 1}
                    </span>
                    <div className="mn-part-main">
                      <label htmlFor={`mn-own-${part.key}`} className="desk-unseen">
                        {mw(MW.ownN, { n: at + 1 })}
                      </label>
                      <div className={error == null ? 'desk-box' : 'desk-box is-wrong'}>
                        <input
                          id={`mn-own-${part.key}`}
                          type="text"
                          value={part.name}
                          spellCheck={false}
                          autoComplete="off"
                          aria-invalid={error != null}
                          aria-describedby={error == null ? undefined : `mn-own-${part.key}-error`}
                          onChange={(change) =>
                            onCourse({
                              own: form.course.own.map((one) =>
                                one.key === part.key ? { ...one, name: change.target.value } : one,
                              ),
                            })
                          }
                        />
                      </div>
                      {error != null && <Wrong id={`mn-own-${part.key}-error`}>{error}</Wrong>}
                    </div>
                    <RowMoves
                      at={at}
                      of={form.course.own.length}
                      name={shownName(part.name)}
                      idKey={part.key}
                      onMove={onMoveOwn}
                      onRemove={() =>
                        onCourse({ own: form.course.own.filter((one) => one.key !== part.key) })
                      }
                    />
                  </li>
                );
              })}
            </ol>
          )}
          <div className="mn-add-row">
            <button
              id="mn-add-own"
              type="button"
              className="desk-text"
              aria-describedby={form.addRefused ? 'mn-add-own-error' : undefined}
              onClick={onAddOwn}
            >
              <Glyph name="plus" size={17} weight={2.3} />
              {MW.addOwn}
            </button>
            {form.addRefused && <Wrong id="mn-add-own-error">{MW.ownTooMany}</Wrong>}
          </div>
        </fieldset>
      )}
      {usesPlatedAt(how) && (
        <fieldset className="mn-parts" aria-describedby="mn-plated-help">
          <legend className="desk-label gs-label">
            {MW.platedAt}
            <Optional />
          </legend>
          {tables.length === 0 ? (
            <div id="mn-plated-help" className="mn-no-tables">
              <p className="mn-no-tables-name">{MW.noTables}</p>
              <p className="desk-help">{MW.noTablesLine}</p>
            </div>
          ) : (
            <>
              <p id="mn-plated-help" className="desk-help">
                {MW.platedAtHelp}
              </p>
              <ul className="mn-tables">
                {tables.map((table) => (
                  <li key={table.id}>
                    <label className="mn-table">
                      <input
                        type="checkbox"
                        className="gs-box"
                        checked={form.course.platedAt.includes(table.id)}
                        onChange={(change) =>
                          onCourse({
                            platedAt: change.target.checked
                              ? [...form.course.platedAt, table.id]
                              : form.course.platedAt.filter((one) => one !== table.id),
                          })
                        }
                      />
                      {tableLabel(table)}
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
        </fieldset>
      )}
    </>
  );
}

function RowMoves({
  at,
  of,
  name,
  idKey,
  onMove,
  onRemove,
}: {
  at: number;
  of: number;
  name: string;
  idKey: string;
  onMove: (at: number, by: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <div className="mn-part-acts">
      <IconButton
        id={`mn-up-${idKey}`}
        glyph="chevup"
        label={mw(MW.moveUp, { name })}
        hint="Move up"
        disabled={at === 0}
        onClick={() => onMove(at, -1)}
      />
      <IconButton
        id={`mn-down-${idKey}`}
        glyph="chevdown"
        label={mw(MW.moveDown, { name })}
        hint="Move down"
        disabled={at === of - 1}
        onClick={() => onMove(at, 1)}
      />
      <IconButton
        id={`mn-x-${idKey}`}
        glyph="clear"
        label={mw(MW.removePart, { name })}
        hint="Remove"
        onClick={onRemove}
      />
    </div>
  );
}

function DishFields({
  dishForm,
  dish,
  how,
  nameError,
  errors,
  addRefused,
  moveSaid,
  onDish,
  onAdd,
  onAddChoice,
  onMove,
}: {
  dishForm: DishForm;
  dish: Dish;
  how: HowServed;
  nameError: string | null;
  errors: PartErrors;
  addRefused: boolean;
  moveSaid: string;
  onDish: (next: Partial<DishForm>) => void;
  onAdd: () => void;
  onAddChoice: (choiceId: string) => void;
  onMove: (at: number, by: -1 | 1) => void;
}) {
  const offered = offeredChoices(dish, dishForm.parts);
  const told = ['mn-parts-help', errors.list == null ? null : 'mn-parts-error']
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <TextField
        id="mn-name"
        label={MW.name}
        value={dishForm.name}
        error={nameError}
        onChange={(name) => onDish({ name })}
      />
      <TextField
        id="mn-desc"
        label={MW.desc}
        value={dishForm.desc}
        optional
        onChange={(desc) => onDish({ desc })}
      />
      <div className="mn-contains-box">
        <p className="desk-label gs-label">{MW.contains}</p>
        <p className="mn-contains">
          <span className="mn-contains-mark" aria-hidden="true">
            !
          </span>
          {dish.contains.join(', ')}
        </p>
        {usesParts(how) && <p className="desk-help">{MW.containsStays}</p>}
      </div>
      {!usesParts(how) && dish.parts.length > 0 && (
        <p className="mn-kept">
          <Glyph name="info" size={16} weight={2.2} />
          {MW.kept}
        </p>
      )}
      {usesParts(how) && (
        <fieldset className="mn-parts" aria-describedby={told}>
          <legend className="desk-label gs-label">
            {MW.parts}
            <Optional />
          </legend>
          <p id="mn-parts-help" className="desk-help">
            {dish.variants.length > 0 ? `${MW.partsHelp} ${MW.partsVariants}` : MW.partsHelp}
          </p>
          <p className="mn-moved" role="status">
            {moveSaid}
          </p>
          {dishForm.parts.length === 0 ? (
            <p className="mn-one-plate">{MW.onePlate}</p>
          ) : (
            <ol className="mn-part-rows">
              {dishForm.parts.map((part, at) => {
                const error = errors.byKey[part.key];
                const name = partName(part, dish);
                return (
                  <li key={part.key} className="mn-part-row">
                    <span className="mn-part-n" aria-hidden="true">
                      {at + 1}
                    </span>
                    <div className="mn-part-main">
                      {part.kind === 'fixed' ? (
                        <>
                          <label htmlFor={`mn-part-${part.key}`} className="desk-unseen">
                            {mw(MW.partN, { n: at + 1 })}
                          </label>
                          <div className={error == null ? 'desk-box' : 'desk-box is-wrong'}>
                            <input
                              id={`mn-part-${part.key}`}
                              type="text"
                              value={part.name}
                              spellCheck={false}
                              autoComplete="off"
                              aria-invalid={error != null}
                              aria-describedby={
                                error == null ? undefined : `mn-part-${part.key}-error`
                              }
                              onChange={(change) =>
                                onDish({
                                  parts: dishForm.parts.map((one) =>
                                    one.key === part.key && one.kind === 'fixed'
                                      ? { ...one, name: change.target.value }
                                      : one,
                                  ),
                                })
                              }
                            />
                          </div>
                        </>
                      ) : (
                        <p
                          className={
                            isDraftPart(part, dish) ? 'mn-choice-part is-draft' : 'mn-choice-part'
                          }
                        >
                          <Glyph name="question" size={16} weight={2.2} />
                          <span className="mn-choice-part-name">{name}</span>
                          {isDraftPart(part, dish) ? (
                            <DraftTag />
                          ) : (
                            <span className="mn-tag">{MW.choiceTag}</span>
                          )}
                        </p>
                      )}
                      {error != null && <Wrong id={`mn-part-${part.key}-error`}>{error}</Wrong>}
                    </div>
                    <RowMoves
                      at={at}
                      of={dishForm.parts.length}
                      name={shownName(name)}
                      idKey={part.key}
                      onMove={onMove}
                      onRemove={() =>
                        onDish({ parts: dishForm.parts.filter((one) => one.key !== part.key) })
                      }
                    />
                  </li>
                );
              })}
            </ol>
          )}
          {errors.list != null && <Wrong id="mn-parts-error">{errors.list}</Wrong>}
          <div className="mn-add-row">
            <button
              id="mn-add-part"
              type="button"
              className="desk-text"
              aria-describedby={addRefused ? 'mn-add-part-error' : undefined}
              onClick={onAdd}
            >
              <Glyph name="plus" size={17} weight={2.3} />
              {MW.addPart}
            </button>
            {addRefused && <Wrong id="mn-add-part-error">{MW.tooMany}</Wrong>}
          </div>
          {offered.length > 0 && (
            <div className="mn-offer" role="group" aria-labelledby="mn-offer-head">
              <p id="mn-offer-head" className="mn-offer-head">
                {MW.addChoice}
              </p>
              <div className="mn-offer-list">
                {offered.map((choice) => (
                  <button
                    key={choice.id}
                    type="button"
                    className="mn-offer-button"
                    onClick={() => onAddChoice(choice.id)}
                  >
                    <Glyph name="plus" size={15} weight={2.4} />
                    {choice.question}
                  </button>
                ))}
              </div>
            </div>
          )}
        </fieldset>
      )}
    </>
  );
}
