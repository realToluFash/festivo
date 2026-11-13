import { type ReactNode, useEffect, useRef, useState } from 'react';
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
  type Asking,
  type Course,
  type Dish,
  type FixedItem,
  type Item,
  type ItemErrors,
  type MenuStart,
  type Offer,
  type Panel,
  MAX_ITEMS,
  MAX_OWN,
  MENU_EVENT,
  MW,
  asSingleDish,
  canAdd,
  checkItems,
  checkOwn,
  foldLine,
  hasErrors,
  isDraftItem,
  itemName,
  menuStart,
  moved,
  movedLine,
  mw,
  offered,
  removeChoiceLine,
  removedLine,
  shownName,
  withoutChoice,
} from './menuServed.ts';
import { useSwitcherStart } from './switcher.ts';
import './guests.css';
import './menu.css';

/** The event's Menu at a desk (board MenuServing, page e32): sc-3902's course cards and docked panel, with sc-34230's Items on every course's dishes and Served with this course. */
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
  own: FixedItem[];
}

interface DishForm {
  name: string;
  desc: string;
  items: Item[];
}

interface Form {
  course: CourseForm;
  dish: DishForm | null;
  pressed: boolean;
  addRefused: boolean;
  failed: boolean;
}

function formOf(panel: Panel, courses: readonly Course[], first: MenuStart | null): Form {
  const course = courses.find((one) => one.id === panel.courseId) as Course;
  const dish = panel.kind === 'dish' ? course.dishes.find((one) => one.id === panel.dishId) : null;

  return {
    course: {
      name: course.name,
      servedAt: course.servedAt ?? '',
      own: first?.own ?? course.ownItems.slice(),
    },
    dish:
      dish == null
        ? null
        : { name: dish.name, desc: dish.desc, items: first?.items ?? dish.items.slice() },
    pressed: false,
    addRefused: false,
    failed: false,
  };
}

const NO_ERRORS: ItemErrors = { list: null, byKey: {} };

function mapDish(
  courses: readonly Course[],
  dishId: string,
  change: (dish: Dish) => Dish,
): Course[] {
  return courses.map((one) =>
    one.dishes.some((d) => d.id === dishId)
      ? { ...one, dishes: one.dishes.map((d) => (d.id === dishId ? change(d) : d)) }
      : one,
  );
}

function findDish(courses: readonly Course[], dishId: string): Dish | undefined {
  return courses.flatMap((one) => one.dishes).find((one) => one.id === dishId);
}

function Menu({ first, event, tell }: { first: MenuStart; event: SampleEvent; tell: Tell }) {
  const [courses, setCourses] = useState(first.courses);
  const [panel, setPanel] = useState<Panel | null>(first.panel);
  const [form, setForm] = useState<Form | null>(() =>
    first.panel == null ? null : formOf(first.panel, first.courses, first),
  );
  const [asking, setAsking] = useState<Asking | null>(first.asking ?? null);
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

  const dishErrors =
    form?.pressed === true && form.dish != null && dish != null
      ? checkItems(form.dish.items, dish)
      : NO_ERRORS;
  const ownErrors =
    form?.pressed === true && panel?.kind === 'course' ? checkOwn(form.course.own) : NO_ERRORS;
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
    if (first.pressAdd === 'item') addItem();
    if (first.pressAdd === 'own') addOwn();
    if (first.moveFirst != null && form.dish != null) {
      const at = form.dish.items.findIndex((one) => one.key === first.moveFirst?.key);
      if (at >= 0) moveItem(at, first.moveFirst.by);
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

  function setItems(items: Item[]) {
    setForm((now) =>
      now?.dish == null ? now : { ...now, addRefused: false, dish: { ...now.dish, items } },
    );
  }

  function addItem() {
    if (form?.dish == null) return;
    if (!canAdd(form.dish.items, MAX_ITEMS)) {
      patch({ addRefused: true });
      return;
    }
    const key = newKey();
    setItems([...form.dish.items, { key, kind: 'fixed', name: '' }]);
    focusAfter.current = `mn-item-${key}`;
  }

  function addOffer(offer: Offer) {
    if (form?.dish == null) return;
    if (!canAdd(form.dish.items, MAX_ITEMS)) {
      patch({ addRefused: true });
      return;
    }
    const key = newKey();
    const item: Item =
      offer.kind === 'variant'
        ? { key, kind: 'variant' }
        : { key, kind: 'choice', choiceId: offer.choice.id };
    setItems([...form.dish.items, item]);
    focusAfter.current = form.dish.items.length === 0 ? `mn-x-${key}` : `mn-up-${key}`;
  }

  function removeItem(key: string) {
    if (form?.dish == null) return;
    const items = form.dish.items;
    const next = items[items.findIndex((one) => one.key === key) + 1];
    setItems(items.filter((one) => one.key !== key));
    focusAfter.current = next == null ? 'mn-add-item' : `mn-x-${next.key}`;
  }

  function removeOwn(key: string) {
    if (form == null) return;
    const own = form.course.own;
    const next = own[own.findIndex((one) => one.key === key) + 1];
    patch({ addRefused: false });
    patchCourse({ own: own.filter((one) => one.key !== key) });
    focusAfter.current = next == null ? 'mn-add-own' : `mn-x-${next.key}`;
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

  function moveItem(at: number, by: -1 | 1) {
    if (form?.dish == null || dish == null) return;
    const next = moved(form.dish.items, at, by);
    if (next == null) return;
    const item = form.dish.items[at] as Item;
    setItems(next);
    setMoveSaid(movedLine(itemName(item, dish), at + by, next.length));
  }

  function moveOwn(at: number, by: -1 | 1) {
    if (form == null) return;
    const next = moved(form.course.own, at, by);
    if (next == null) return;
    const item = form.course.own[at] as FixedItem;
    patchCourse({ own: next });
    setMoveSaid(movedLine(item.name, at + by, next.length));
  }

  function save() {
    if (form == null || panel == null || course == null) return;
    const ownCheck = panel.kind === 'course' ? checkOwn(form.course.own) : NO_ERRORS;
    const itemsCheck =
      form.dish != null && dish != null ? checkItems(form.dish.items, dish) : NO_ERRORS;
    const blankName =
      panel.kind === 'dish' ? form.dish?.name.trim() === '' : form.course.name.trim() === '';

    if (blankName || hasErrors(ownCheck) || hasErrors(itemsCheck)) {
      setForm({ ...form, pressed: true, failed: false });
      focusAfter.current = firstWrong(blankName, itemsCheck, ownCheck, form);
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

  function changeOpenDish(dishId: string, change: (dish: Dish) => Dish) {
    if (panel?.kind !== 'dish' || panel.dishId !== dishId) return;
    const target = findDish(courses, dishId);
    if (target == null) return;
    setForm((now) =>
      now?.dish == null
        ? now
        : {
            ...now,
            dish: {
              ...now.dish,
              items: change({ ...target, items: now.dish.items }).items.slice(),
            },
          },
    );
  }

  function removeChoice(dishId: string, choiceId: string) {
    const target = findDish(courses, dishId);
    const choice = target?.choices.find((one) => one.id === choiceId);
    if (target == null || choice == null) return;

    setCourses(mapDish(courses, dishId, (d) => withoutChoice(d, choiceId)));
    changeOpenDish(dishId, (d) => withoutChoice(d, choiceId));
    setAsking(null);
    setSaid(removedLine(target, choice));
  }

  function removeVariant(dishId: string, name: string) {
    setAsking({ dishId, kind: 'variant', name });
    focusAfter.current = `mn-ask-v-${dishId}`;
  }

  function makeSingle(dishId: string) {
    const target = findDish(courses, dishId);
    if (target == null) return;

    setCourses(mapDish(courses, dishId, asSingleDish));
    changeOpenDish(dishId, asSingleDish);
    setAsking(null);
    setSaid(mw(MW.folded, { dish: target.name }));
    focusAfter.current = `mn-edit-${dishId}`;
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
                manage={manage}
                editing={panel}
                asking={asking}
                onEdit={(next) => open(next)}
                onAsk={(dishId, choiceId) => {
                  setAsking({ dishId, kind: 'choice', choiceId });
                  focusAfter.current = `mn-ask-${choiceId}`;
                }}
                onKeep={(back) => {
                  setAsking(null);
                  focusAfter.current = back;
                }}
                onRemove={removeChoice}
                onRemoveVariant={removeVariant}
                onMakeSingle={makeSingle}
                onAddDish={() => tell('Add dish is sc-3902’s, drawn on the Menu board.')}
              />
            ))}
          </div>
          {panel != null && form != null && course != null && (
            <aside className="mn-panel" aria-labelledby="mn-panel-title">
              <div className="mn-panel-top">
                <div className="mn-panel-names">
                  <p className="mn-eyebrow">{course.name}</p>
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
                    nameError={nameError}
                    ownErrors={ownErrors}
                    moveSaid={moveSaid}
                    onCourse={patchCourse}
                    onAddOwn={addOwn}
                    onMoveOwn={moveOwn}
                    onRemoveOwn={removeOwn}
                  />
                ) : (
                  dish != null &&
                  form.dish != null && (
                    <DishFields
                      dishForm={form.dish}
                      dish={dish}
                      nameError={nameError}
                      errors={dishErrors}
                      addRefused={form.addRefused}
                      moveSaid={moveSaid}
                      onDish={(next) =>
                        setForm((now) =>
                          now?.dish == null ? now : { ...now, dish: { ...now.dish, ...next } },
                        )
                      }
                      onAdd={addItem}
                      onAddOffer={addOffer}
                      onMove={moveItem}
                      onRemove={removeItem}
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
  items: ItemErrors,
  own: ItemErrors,
  form: Form,
): string | null {
  if (blankName) return 'mn-name';
  const dishKey = form.dish?.items.find((one) => items.byKey[one.key] != null)?.key;
  if (dishKey != null) {
    const item = form.dish?.items.find((one) => one.key === dishKey);
    return item?.kind === 'fixed' ? `mn-item-${dishKey}` : `mn-up-${dishKey}`;
  }
  if (items.list != null) return 'mn-add-item';
  const ownKey = form.course.own.find((one) => own.byKey[one.key] != null)?.key;
  return ownKey == null ? null : `mn-own-${ownKey}`;
}

function applied(course: Course, panel: Panel, form: Form): Course {
  if (panel.kind === 'course') {
    return {
      ...course,
      name: form.course.name.trim(),
      servedAt: form.course.servedAt.trim() === '' ? null : form.course.servedAt.trim(),
      ownItems: form.course.own.map((one) => ({ ...one, name: one.name.trim() })),
    };
  }

  const draft = form.dish;
  if (draft == null) return course;
  const items = draft.items.map((one) =>
    one.kind === 'fixed' ? { ...one, name: one.name.trim() } : one,
  );

  return {
    ...course,
    dishes: course.dishes.map((one) =>
      one.id === panel.dishId ? { ...one, name: draft.name.trim(), desc: draft.desc, items } : one,
    ),
  };
}

function CourseCard({
  course,
  index,
  manage,
  editing,
  asking,
  onEdit,
  onAsk,
  onKeep,
  onRemove,
  onRemoveVariant,
  onMakeSingle,
  onAddDish,
}: {
  course: Course;
  index: number;
  manage: boolean;
  editing: Panel | null;
  asking: Asking | null;
  onEdit: (panel: Panel) => void;
  onAsk: (dishId: string, choiceId: string) => void;
  onKeep: (back: string) => void;
  onRemove: (dishId: string, choiceId: string) => void;
  onRemoveVariant: (dishId: string, name: string) => void;
  onMakeSingle: (dishId: string) => void;
  onAddDish: () => void;
}) {
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
          {course.servedAt != null && (
            <p className="mn-course-line">{mw(MW.servedAt, { time: course.servedAt })}</p>
          )}
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
      {course.ownItems.length > 0 && (
        <dl className="mn-course-facts">
          <div>
            <dt>{MW.own}</dt>
            <dd>{course.ownItems.map((one) => one.name).join(' · ')}</dd>
          </div>
        </dl>
      )}
      <ul className="mn-dishes">
        {course.dishes.map((dish) => (
          <DishRow
            key={dish.id}
            dish={dish}
            manage={manage}
            lit={editing?.kind === 'dish' && editing.dishId === dish.id}
            asking={asking?.dishId === dish.id ? asking : null}
            onEdit={() => onEdit({ kind: 'dish', courseId: course.id, dishId: dish.id })}
            onAsk={(choiceId) => onAsk(dish.id, choiceId)}
            onKeep={onKeep}
            onRemove={(choiceId) => onRemove(dish.id, choiceId)}
            onRemoveVariant={(name) => onRemoveVariant(dish.id, name)}
            onMakeSingle={() => onMakeSingle(dish.id)}
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

const variantKey = (dishId: string, name: string): string =>
  `mn-rmv-${dishId}-${name.toLowerCase().replace(/\W+/gu, '-')}`;

function DishRow({
  dish,
  manage,
  lit,
  asking,
  onEdit,
  onAsk,
  onKeep,
  onRemove,
  onRemoveVariant,
  onMakeSingle,
}: {
  dish: Dish;
  manage: boolean;
  lit: boolean;
  asking: Asking | null;
  onEdit: () => void;
  onAsk: (choiceId: string) => void;
  onKeep: (back: string) => void;
  onRemove: (choiceId: string) => void;
  onRemoveVariant: (name: string) => void;
  onMakeSingle: () => void;
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
          {dish.variants.length > 0 && !manage && (
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
      {dish.variants.length > 0 && manage && (
        <div className="mn-variants-box">
          <p className="mn-items-head">{MW.variants}</p>
          <ul className="mn-variants" aria-label={`${MW.variants} · ${dish.name}`}>
            {dish.variants.map((name) => (
              <li key={name} className="mn-variant">
                <span>{name}</span>
                <IconButton
                  id={variantKey(dish.id, name)}
                  glyph="clear"
                  label={mw(MW.removeVariantAria, { name })}
                  hint={MW.remove}
                  onClick={() => onRemoveVariant(name)}
                />
              </li>
            ))}
          </ul>
          {asking?.kind === 'variant' && (
            <div className="mn-ask">
              <p id={`mn-ask-v-${dish.id}`} tabIndex={-1}>
                {foldLine(dish)}
              </p>
              <div className="mn-ask-acts">
                <button
                  type="button"
                  className="desk-text"
                  onClick={() => onKeep(variantKey(dish.id, asking.name))}
                >
                  {MW.keepVariants}
                </button>
                <Pill label={MW.makeSingle} onClick={onMakeSingle} />
              </div>
            </div>
          )}
        </div>
      )}
      {dish.items.length > 0 && <ItemsLine dish={dish} />}
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
                {asking?.kind === 'choice' && asking.choiceId === choice.id && (
                  <div className="mn-ask">
                    <p id={`mn-ask-${choice.id}`} tabIndex={-1}>
                      {removeChoiceLine(dish, choice, index)}
                    </p>
                    <div className="mn-ask-acts">
                      <button
                        type="button"
                        className="desk-text"
                        onClick={() => onKeep(`mn-rm-${choice.id}`)}
                      >
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

function ItemsLine({ dish }: { dish: Dish }) {
  return (
    <div className="mn-items-line">
      <p className="mn-items-head">{MW.items}</p>
      <ol className="mn-item-chips">
        {dish.items.map((item) => (
          <li
            key={item.key}
            className={[
              'mn-item-chip',
              item.kind !== 'fixed' && 'is-choice',
              isDraftItem(item, dish) && 'is-draft',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {item.kind === 'choice' && <Glyph name="question" size={14} weight={2.2} />}
            {item.kind === 'variant' && <Glyph name="updown" size={14} weight={2.2} />}
            {itemName(item, dish)}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function IconButton({
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

export function Wrong({ id, children }: { id: string; children: ReactNode }) {
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
  nameError,
  ownErrors,
  moveSaid,
  onCourse,
  onAddOwn,
  onMoveOwn,
  onRemoveOwn,
}: {
  form: Form;
  nameError: string | null;
  ownErrors: ItemErrors;
  moveSaid: string;
  onCourse: (next: Partial<CourseForm>) => void;
  onAddOwn: () => void;
  onMoveOwn: (at: number, by: -1 | 1) => void;
  onRemoveOwn: (key: string) => void;
}) {
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
      <fieldset className="mn-items" aria-describedby="mn-own-help">
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
          <ol className="mn-item-rows">
            {form.course.own.map((item, at) => {
              const error = ownErrors.byKey[item.key];
              return (
                <li key={item.key} className="mn-item-row">
                  <span className="mn-item-n" aria-hidden="true">
                    {at + 1}
                  </span>
                  <div className="mn-item-main">
                    <label htmlFor={`mn-own-${item.key}`} className="desk-unseen">
                      {mw(MW.ownN, { n: at + 1 })}
                    </label>
                    <div className={error == null ? 'desk-box' : 'desk-box is-wrong'}>
                      <input
                        id={`mn-own-${item.key}`}
                        type="text"
                        value={item.name}
                        spellCheck={false}
                        autoComplete="off"
                        aria-invalid={error != null}
                        aria-describedby={error == null ? undefined : `mn-own-${item.key}-error`}
                        onChange={(change) =>
                          onCourse({
                            own: form.course.own.map((one) =>
                              one.key === item.key ? { ...one, name: change.target.value } : one,
                            ),
                          })
                        }
                      />
                    </div>
                    {error != null && <Wrong id={`mn-own-${item.key}-error`}>{error}</Wrong>}
                  </div>
                  <RowMoves
                    at={at}
                    of={form.course.own.length}
                    name={shownName(item.name)}
                    idKey={item.key}
                    onMove={onMoveOwn}
                    onRemove={() => onRemoveOwn(item.key)}
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
    <div className="mn-item-acts">
      <IconButton
        id={`mn-up-${idKey}`}
        glyph="chevup"
        label={mw(MW.moveUp, { name })}
        hint={MW.upHint}
        disabled={at === 0}
        onClick={() => onMove(at, -1)}
      />
      <IconButton
        id={`mn-down-${idKey}`}
        glyph="chevdown"
        label={mw(MW.moveDown, { name })}
        hint={MW.downHint}
        disabled={at === of - 1}
        onClick={() => onMove(at, 1)}
      />
      <IconButton
        id={`mn-x-${idKey}`}
        glyph="clear"
        label={mw(MW.removeItem, { name })}
        hint={MW.removeHint}
        onClick={onRemove}
      />
    </div>
  );
}

function FromDish({ item, dish }: { item: Item; dish: Dish }) {
  const draft = isDraftItem(item, dish);

  return (
    <p className={draft ? 'mn-choice-item is-draft' : 'mn-choice-item'}>
      <Glyph name={item.kind === 'variant' ? 'updown' : 'question'} size={16} weight={2.2} />
      <span className="mn-choice-item-name">{itemName(item, dish)}</span>
      {draft ? (
        <DraftTag />
      ) : (
        <span className="mn-tag">{item.kind === 'variant' ? MW.variantTag : MW.choiceTag}</span>
      )}
    </p>
  );
}

function DishFields({
  dishForm,
  dish,
  nameError,
  errors,
  addRefused,
  moveSaid,
  onDish,
  onAdd,
  onAddOffer,
  onMove,
  onRemove,
}: {
  dishForm: DishForm;
  dish: Dish;
  nameError: string | null;
  errors: ItemErrors;
  addRefused: boolean;
  moveSaid: string;
  onDish: (next: Partial<DishForm>) => void;
  onAdd: () => void;
  onAddOffer: (offer: Offer) => void;
  onMove: (at: number, by: -1 | 1) => void;
  onRemove: (key: string) => void;
}) {
  const offers = offered(dish, dishForm.items);
  const told = ['mn-items-help', errors.list == null ? null : 'mn-items-error']
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
        <p className="desk-help">{MW.containsStays}</p>
      </div>
      <fieldset className="mn-items" aria-describedby={told}>
        <legend className="desk-label gs-label">
          {MW.items}
          <Optional />
        </legend>
        <p id="mn-items-help" className="desk-help">
          {dish.variants.length > 0 ? `${MW.itemsHelp} ${MW.itemsVariants}` : MW.itemsHelp}
        </p>
        <p className="mn-moved" role="status">
          {moveSaid}
        </p>
        {dishForm.items.length > 0 && (
          <ol className="mn-item-rows">
            {dishForm.items.map((item, at) => {
              const error = errors.byKey[item.key];
              return (
                <li key={item.key} className="mn-item-row">
                  <span className="mn-item-n" aria-hidden="true">
                    {at + 1}
                  </span>
                  <div className="mn-item-main">
                    {item.kind === 'fixed' ? (
                      <>
                        <label htmlFor={`mn-item-${item.key}`} className="desk-unseen">
                          {mw(MW.itemN, { n: at + 1 })}
                        </label>
                        <div className={error == null ? 'desk-box' : 'desk-box is-wrong'}>
                          <input
                            id={`mn-item-${item.key}`}
                            type="text"
                            value={item.name}
                            spellCheck={false}
                            autoComplete="off"
                            aria-invalid={error != null}
                            aria-describedby={
                              error == null ? undefined : `mn-item-${item.key}-error`
                            }
                            onChange={(change) =>
                              onDish({
                                items: dishForm.items.map((one) =>
                                  one.key === item.key && one.kind === 'fixed'
                                    ? { ...one, name: change.target.value }
                                    : one,
                                ),
                              })
                            }
                          />
                        </div>
                      </>
                    ) : (
                      <FromDish item={item} dish={dish} />
                    )}
                    {error != null && <Wrong id={`mn-item-${item.key}-error`}>{error}</Wrong>}
                  </div>
                  <RowMoves
                    at={at}
                    of={dishForm.items.length}
                    name={shownName(itemName(item, dish))}
                    idKey={item.key}
                    onMove={onMove}
                    onRemove={() => onRemove(item.key)}
                  />
                </li>
              );
            })}
          </ol>
        )}
        {errors.list != null && <Wrong id="mn-items-error">{errors.list}</Wrong>}
        <div className="mn-add-row">
          <button
            id="mn-add-item"
            type="button"
            className="desk-text"
            aria-describedby={addRefused ? 'mn-add-item-error' : undefined}
            onClick={onAdd}
          >
            <Glyph name="plus" size={17} weight={2.3} />
            {MW.addItem}
          </button>
          {addRefused && <Wrong id="mn-add-item-error">{MW.tooMany}</Wrong>}
        </div>
        {offers.length > 0 && (
          <div className="mn-offer" role="group" aria-labelledby="mn-offer-head">
            <p id="mn-offer-head" className="mn-offer-head">
              {MW.addFrom}
            </p>
            <div className="mn-offer-list">
              {offers.map((offer) => (
                <button
                  key={offer.kind === 'variant' ? 'variant' : offer.choice.id}
                  type="button"
                  className="mn-offer-button"
                  onClick={() => onAddOffer(offer)}
                >
                  <Glyph name="plus" size={15} weight={2.4} />
                  {offer.kind === 'variant' ? offer.name : offer.choice.question}
                  <span className="mn-tag">
                    {offer.kind === 'variant' ? MW.variantTag : MW.choiceTag}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </fieldset>
    </>
  );
}
