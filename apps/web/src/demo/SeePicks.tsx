import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import type { Tell } from '../components/SettingsParts.tsx';
import { useDialogKeys } from '../dialogFocus.ts';
import { DemoBell } from './DemoBell.tsx';
import { type Variant, hasVariants, isForEveryone, variantsOf } from './dishVariants.ts';
import { ChildrenTag } from './DishVariants.tsx';
import { EventsShell } from './EventParts.tsx';
import { EventSidebar } from './EventSidebar.tsx';
import type { SampleEvent } from './events.ts';
import { KeptArea, KeptHere } from './KeptOffline.tsx';
import { clockOfKitchen } from './kitchen.ts';
import { allergenList } from './mealStep.ts';
import type { DishAllergen } from './menuLibrary.ts';
import { type EvCourse, type EvDish, CW, coursesAt } from './menuCourses.ts';
import { keptInbox, waitingLine } from './messages.ts';
import {
  type CourseFigures,
  type DishPick,
  type Opened,
  type Person,
  type PicksStart,
  type PicksWorld,
  type Row,
  HOST,
  SW,
  UPDATED_AT,
  chooseFor,
  codesOf,
  containsOf,
  courseFigures,
  firstName,
  giveVariant,
  goesBackTo,
  hasVariant,
  header,
  needsHost,
  numberIn,
  openFor,
  pickName,
  ruledOut,
  shownCourses,
  whoHasnt,
} from './seePicks.ts';
import { clockWords } from './tabKept.ts';
import './guests.css';
import './menu.css';
import './menuCourses.css';
import './seePicks.css';

const CONFIRMED_AT = '18 Nov, 19:44';

/** sc-3909's See picks, behind See picks on the event's Menu: the header, Needs the host, a card per course, Who hasn't picked, and the host choosing for a guest. */
export function PicksAt({ event, first }: { event: SampleEvent; first: PicksStart }) {
  return (
    <KeptArea eventId={event.id} area="menu" at={clockWords(clockOfKitchen(), event.timeZone)}>
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
        {(tell) => (
          <div className="desk-page ev-page gs mn pk">
            <div className="ev-wide mn-page">
              <KeptHere />
              <Crumbs event={event} tell={tell} />
              <Picks first={first} />
            </div>
          </div>
        )}
      </EventsShell>
    </KeptArea>
  );
}

function Crumbs({ event, tell }: { event: SampleEvent; tell: Tell }) {
  return (
    <div className="ev-crumb-row">
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
          <li className="ev-crumb-part">
            <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
            <Link className="ev-crumb-name" to={coursesAt('menuPicks')}>
              {CW.title}
            </Link>
          </li>
          <li className="ev-crumb-part" aria-current="page">
            <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
            <span className="ev-crumb-name">{SW.title}</span>
          </li>
        </ol>
      </nav>
      <DemoBell tell={tell} />
    </div>
  );
}

interface Said {
  line: string;
  overridden: string | null;
}

function Picks({ first }: { first: PicksStart }) {
  const [begin] = useState(() => begun(first));
  const [world, setWorld] = useState<PicksWorld>(begin.world);
  const [opened, setOpened] = useState<Opened | null>(begin.opened);
  const [said, setSaid] = useState<Said | null>(begin.said);
  const opener = useRef<string | null>(null);
  const manage = first.access === 'manage';

  if (first.system === 'loading')
    return (
      <>
        <Top first={first} world={world} />
        <div className="lib-loading" aria-busy="true">
          <p className="lib-loading-words" role="status">
            {SW.loading}
          </p>
          {[0, 1, 2].map((one) => (
            <div key={one} className="lib-bone mc-bone" aria-hidden="true" />
          ))}
        </div>
      </>
    );

  if (world.people.length === 0)
    return (
      <>
        <Top first={first} world={world} />
        <div className="desk-card pk-empty">
          <h2>{SW.emptyTitle}</h2>
          <p className="mn-quiet">{SW.emptyBody}</p>
          <Link className="gs-pill is-primary pk-go" to="/demo/events/evt-wed-4/guests">
            {SW.toGuests}
          </Link>
        </div>
      </>
    );

  const open = (next: Opened, from: string) => {
    opener.current = from;
    setSaid(null);
    setOpened(next);
  };
  const close = () => {
    setOpened(null);
    const back = opener.current;
    requestAnimationFrame(() => {
      if (back != null) document.getElementById(back)?.focus();
    });
  };
  const host = needsHost(world);
  const waiting = whoHasnt(world);
  const all = header(world);

  return (
    <>
      <Top first={first} world={world} />
      {world.held > 0 && (
        <p className="pk-held">{SW.held(world.held, numberIn(world.people.length))}</p>
      )}
      {first.access === 'read' && <Lock words={SW.needsManage} />}
      {first.access === 'counts' && <Lock words={SW.needsRead} />}
      {all.answered === all.room && host.length === 0 && (
        <p className="pk-all-in">
          <Glyph name="tick" size={16} weight={2.6} />
          {SW.allIn}
        </p>
      )}
      <div className="pk-said" role="status">
        {said != null && (
          <>
            <p>{said.line}</p>
            {said.overridden != null && <p className="pk-said-override">{said.overridden}</p>}
          </>
        )}
      </div>
      {host.length > 0 && (
        <section className="desk-card pk-host" aria-labelledby="pk-host-title">
          <h2 id="pk-host-title" className="pk-card-title">
            <Triangle />
            {SW.needsHost}
          </h2>
          <p className="mn-quiet">{SW.needsHostBody}</p>
          {first.access === 'counts' ? (
            <ul className="pk-lines">
              {shownCourses(world)
                .map((course) => ({
                  course,
                  n: host.filter((one) => one.course.id === course.id).length,
                }))
                .filter((one) => one.n > 0)
                .map((one) => (
                  <li key={one.course.id}>{SW.hostCount(one.course.name, one.n)}</li>
                ))}
            </ul>
          ) : (
            <ul className="pk-people">
              {host.map((one) => (
                <li key={`${one.person.id}-${one.course.id}`} className="pk-person">
                  <div className="pk-person-words">
                    <strong>{one.person.name}</strong>
                    <span>
                      {one.reason.kind === 'nothing'
                        ? SW.nothingFor(one.course.name)
                        : SW.allergyFor(
                            one.course.name,
                            one.reason.dish,
                            allergenList(one.reason.allergens, 'en'),
                          )}
                    </span>
                  </div>
                  {manage && (
                    <ChooseForButton
                      id={`pk-host-${one.person.id}-${one.course.id}`}
                      person={one.person}
                      onOpen={(from) =>
                        open(
                          { kind: 'chooseFor', personId: one.person.id, courseId: one.course.id },
                          from,
                        )
                      }
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {shownCourses(world).map((course) => (
        <CourseCard
          key={course.id}
          figures={courseFigures(world, course)}
          manage={manage}
          onChooseWho={(row, from) =>
            open(
              {
                kind: 'chooseWho',
                courseId: course.id,
                dishId: row.dishId,
                variantId: row.id,
              },
              from,
            )
          }
        />
      ))}
      {first.access !== 'counts' && (
        <section className="desk-card pk-waiting" aria-labelledby="pk-waiting-title">
          <h2 id="pk-waiting-title" className="pk-card-title">
            {SW.whoHasnt}
          </h2>
          {waiting.length === 0 ? (
            <p className="mn-quiet">{SW.whoHasntNone}</p>
          ) : (
            waiting.map((group) => (
              <div key={group.party.id} className="pk-party">
                <h3>{SW.replied(group.party.replier, group.people.length)}</h3>
                <ul className="pk-people">
                  {group.people.map(({ person, courses }) => (
                    <li key={person.id} className="pk-person">
                      <div className="pk-person-words">
                        <strong>{person.name}</strong>
                        <span className="pk-state">
                          <DashedCircle />
                          {SW.notChosenOn(courses.map((one) => one.name).join(', '))}
                        </span>
                      </div>
                      {manage && (
                        <ChooseForButton
                          id={`pk-wait-${person.id}`}
                          person={person}
                          onOpen={(from) => open({ kind: 'chooseFor', personId: person.id }, from)}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>
      )}
      {first.demo && <DemoOnly world={world} onWorld={setWorld} />}
      {opened?.kind === 'chooseFor' && (
        <ChooseFor
          world={world}
          opened={opened}
          onSave={(courseId, personId, pick, line, overridden) => {
            setWorld((now) => chooseFor(now, courseId, personId, pick));
            setSaid({ line, overridden });
          }}
          onClose={close}
        />
      )}
      {opened?.kind === 'chooseWho' && (
        <ChooseWho
          world={world}
          opened={opened}
          onSave={(next, line, overridden) => {
            setWorld(next);
            setSaid({ line, overridden });
          }}
          onClose={close}
        />
      )}
    </>
  );
}

function Top({ first, world }: { first: PicksStart; world: PicksWorld }) {
  const all = header(world);

  return (
    <header className="gs-top pk-top">
      <div className="mn-head">
        <Link className="desk-text pk-back" to={coursesAt('menuPicks')}>
          <Glyph name="back" size={16} weight={2.4} />
          {SW.backToMenu}
        </Link>
        <h1 className="gs-title">{SW.title}</h1>
        {first.system !== 'loading' && world.people.length > 0 && (
          <p className="pk-header">
            {SW.header(numberIn(all.answered), numberIn(all.room), numberIn(all.percent))}
          </p>
        )}
        {first.system !== 'loading' && world.people.length > 0 && <Live system={first.system} />}
      </div>
    </header>
  );
}

function Live({ system }: { system: PicksStart['system'] }) {
  if (system === 'stale')
    return (
      <p className="pk-live is-stale" role="status">
        <Triangle />
        {SW.stale(UPDATED_AT)}
      </p>
    );

  return (
    <p className="pk-live">
      <span>{SW.live(UPDATED_AT)}</span>
      {system === 'refreshing' && (
        <span className="lib-refreshing" role="status">
          <Glyph name="refresh" size={15} weight={2.4} />
          {SW.refreshing}
        </span>
      )}
    </p>
  );
}

function Lock({ words }: { words: string }) {
  return (
    <p className="mn-lock">
      <Glyph name="lock" size={16} weight={2.2} />
      {words}
    </p>
  );
}

function ChooseForButton({
  id,
  person,
  onOpen,
}: {
  id: string;
  person: Person;
  onOpen: (from: string) => void;
}) {
  return (
    <button
      id={id}
      type="button"
      className="gs-pill is-secondary pk-act"
      aria-label={SW.chooseForAria(person.name)}
      onClick={() => onOpen(id)}
    >
      {SW.chooseFor}
    </button>
  );
}

function CourseCard({
  figures,
  manage,
  onChooseWho,
}: {
  figures: CourseFigures;
  manage: boolean;
  onChooseWho: (row: Row, from: string) => void;
}) {
  const { course } = figures;
  const titleId = `pk-course-${course.id}`;
  const options = figures.rows.some((row) => row.kind === 'option');
  const dish = course.dishes[0] as EvDish;

  return (
    <section className="desk-card pk-course" id={`pk-${course.id}`} aria-labelledby={titleId}>
      <div className="pk-course-head">
        <h2 id={titleId} className="pk-card-title">
          {course.name}
        </h2>
        <p className="pk-answered">
          {SW.answered(numberIn(figures.answered), numberIn(figures.room))}
        </p>
      </div>
      {figures.asksNothing && <p className="mn-quiet">{SW.asksNothing(dish.name)}</p>}
      <div className="pk-scroll">
        <table className="pk-table">
          <caption className="pk-hidden">{`${course.name} · ${SW.dish}`}</caption>
          <thead>
            <tr>
              <th scope="col">{SW.dish}</th>
              <th scope="col">{SW.chosen}</th>
              <th scope="col">{SW.defaulted}</th>
            </tr>
          </thead>
          <tbody>
            {figures.rows.map((row) => (
              <tr key={row.id} className={row.kind === 'dish' ? 'pk-dish' : 'pk-inner'}>
                <th scope="row">
                  <div className="pk-row-cell">
                    <span className="pk-row-name">
                      {row.kind === 'variant' && <span className="pk-prefix">{SW.variant}</span>}
                      {row.kind === 'option' && <span className="pk-prefix">{SW.side}</span>}
                      {row.name}
                      {row.variant?.for === 'children' && <ChildrenTag />}
                    </span>
                    {manage && row.variant != null && !isForEveryone(row.variant) && (
                      <button
                        id={`pk-who-${row.id}`}
                        type="button"
                        className="gs-pill is-secondary pk-act"
                        aria-label={SW.chooseWhoAria(row.name, dishName(course, row.dishId))}
                        onClick={() => onChooseWho(row, `pk-who-${row.id}`)}
                      >
                        {SW.chooseWho}
                      </button>
                    )}
                  </div>
                </th>
                <td>{numberIn(row.chosen)}</td>
                <td>{numberIn(row.defaulted)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {options && <p className="mn-quiet">{SW.perPick}</p>}
      <div className="pk-scroll">
        <table className="pk-table pk-states">
          <caption className="pk-hidden">{`${course.name} · ${SW.everyoneElse}`}</caption>
          <thead>
            <tr>
              <th scope="col">{SW.everyoneElse}</th>
              <th scope="col">{SW.people}</th>
            </tr>
          </thead>
          <tbody>
            <StateRow mark={<Star />} name={SW.kitchen} n={figures.kitchen} />
            <StateRow mark={<CircleMinus />} name={SW.skipped} n={figures.skipped} />
            <StateRow mark={<Triangle />} name={SW.hostState} n={figures.host} />
            <StateRow mark={<DashedCircle />} name={SW.none} n={figures.none} />
            {figures.changed > 0 && (
              <StateRow mark={<Swap />} name={SW.changed} n={figures.changed} />
            )}
          </tbody>
          <tfoot>
            <tr className="pk-room">
              <th scope="row">{SW.theRoom}</th>
              <td>{numberIn(figures.room)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {figures.changed > 0 && <p className="mn-quiet">{SW.menuChanged}</p>}
      {!course.skip && !figures.asksNothing && <p className="mn-quiet">{SW.noSkip}</p>}
    </section>
  );
}

function goesBack(course: EvCourse, person: Person): string {
  const back = goesBackTo(course, person);

  return back == null ? SW.goesBackNone : SW.goesBack(back);
}

const dishName = (course: EvCourse, dishId: string): string =>
  course.dishes.find((one) => one.id === dishId)?.name ?? '';

function StateRow({ mark, name, n }: { mark: ReactNode; name: string; n: number }) {
  return (
    <tr>
      <th scope="row">
        <span className="pk-state">
          {mark}
          {name}
        </span>
      </th>
      <td>{numberIn(n)}</td>
    </tr>
  );
}

interface Choice {
  dishId: string | 'kitchen' | null;
  variantId: string | null;
  optionIds: readonly string[];
}

const blankChoice: Choice = { dishId: null, variantId: null, optionIds: [] };

type ForOutcome =
  | { kind: 'error'; words: string; focus: string }
  | { kind: 'ask'; allergens: DishAllergen[] }
  | { kind: 'refused' }
  | {
      kind: 'saved';
      pick: DishPick | { kind: 'kitchen' };
      line: string;
      overridden: string | null;
    };

/** Save on Choose for them: what is missing, the override question, the 403, or the pick as the host's. */
function outcomeFor(
  person: Person,
  course: EvCourse,
  choice: Choice,
  confirmed: boolean,
  refuses: boolean,
): ForOutcome {
  const first = firstName(person.name);
  const dish = course.dishes.find((one) => one.id === choice.dishId) ?? null;
  if (choice.dishId == null)
    return { kind: 'error', words: SW.blank(course.name, first), focus: 'pk-for-dish' };
  if (dish != null && hasVariants(dish) && choice.variantId == null)
    return { kind: 'error', words: SW.blankWay(dish.name, first), focus: 'pk-for-way' };
  const unanswered = (dish?.choices ?? []).find(
    (one) => one.required && !one.options.some((option) => choice.optionIds.includes(option.id)),
  );
  if (unanswered != null)
    return {
      kind: 'error',
      words: SW.blankOption(unanswered.question, first),
      focus: 'pk-for-option',
    };
  const allergens =
    dish == null ? [] : ruledOut(person, containsOf(dish, choice.variantId, choice.optionIds));
  if (allergens.length > 0 && !confirmed) return { kind: 'ask', allergens };
  if (refuses) return { kind: 'refused' };
  const pick: DishPick | { kind: 'kitchen' } =
    dish == null
      ? { kind: 'kitchen' }
      : {
          kind: 'dish',
          dishId: dish.id,
          variantId: choice.variantId,
          optionIds: choice.optionIds,
          how: 'host',
          ...(allergens.length > 0 ? { override: { by: HOST, at: CONFIRMED_AT } } : {}),
        };
  const what = dish == null ? SW.kitchen : pickName(dish, pick);

  return {
    kind: 'saved',
    pick,
    line: SW.savedFor(course.name, first, what),
    overridden:
      allergens.length > 0 ? SW.savedOverride(first, what, allergenList(allergens, 'en')) : null,
  };
}

function coursesFor(world: PicksWorld, opened: ForOpened): EvCourse[] {
  const person = world.people.find((one) => one.id === opened.personId) as Person;
  const all = openFor(world, person);

  return opened.courseId == null ? all : all.filter((one) => one.id === opened.courseId);
}

const choiceOf = (opened: ForOpened): Choice =>
  opened.dishId == null
    ? blankChoice
    : {
        dishId: opened.dishId,
        variantId: opened.variantId ?? null,
        optionIds: opened.optionIds ?? [],
      };

type ForOpened = Extract<Opened, { kind: 'chooseFor' }>;
type WhoOpened = Extract<Opened, { kind: 'chooseWho' }>;

/** A state that opens with Save pressed: what it shows first. A save that goes through is already on the page, with its line. */
function begun(first: PicksStart): { world: PicksWorld; opened: Opened | null; said: Said | null } {
  const { world, opened } = first;
  if (opened?.press !== true) return { world, opened, said: null };
  if (opened.kind === 'chooseFor') {
    const person = world.people.find((one) => one.id === opened.personId) as Person;
    const course = coursesFor(world, opened)[0] as EvCourse;
    const out = outcomeFor(
      person,
      course,
      choiceOf(opened),
      opened.confirm === true,
      opened.refuses === true,
    );
    if (out.kind !== 'saved') return { world, opened, said: null };

    return {
      world: chooseFor(world, course.id, person.id, out.pick),
      opened: null,
      said: { line: out.line, overridden: out.overridden },
    };
  }
  const out = outcomeWho(world, opened, tickedOf(world, opened), opened.confirm === true);
  if (out.kind !== 'saved') return { world, opened, said: null };

  return { world: out.next, opened: null, said: { line: out.line, overridden: out.overridden } };
}

function ChooseFor({
  world,
  opened,
  onSave,
  onClose,
}: {
  world: PicksWorld;
  opened: ForOpened;
  onSave: (
    courseId: string,
    personId: string,
    pick: DishPick | { kind: 'kitchen' },
    line: string,
    overridden: string | null,
  ) => void;
  onClose: () => void;
}) {
  const person = world.people.find((one) => one.id === opened.personId) as Person;
  const [courses] = useState(() => coursesFor(world, opened));
  const [shown] = useState(() =>
    opened.press === true
      ? outcomeFor(
          person,
          courses[0] as EvCourse,
          choiceOf(opened),
          opened.confirm === true,
          opened.refuses === true,
        )
      : null,
  );
  const [at, setAt] = useState(0);
  const [choice, setChoice] = useState<Choice>(() => choiceOf(opened));
  const [error, setError] = useState<string | null>(shown?.kind === 'error' ? shown.words : null);
  const [asking, setAsking] = useState<DishAllergen[] | null>(
    shown?.kind === 'ask' ? shown.allergens : null,
  );
  const [refused, setRefused] = useState(shown?.kind === 'refused');
  const box = useRef<HTMLDivElement>(null);
  useDialogKeys(box, onClose, false);

  useEffect(() => {
    if (shown?.kind === 'error') document.getElementById(shown.focus)?.focus();
    else if (shown?.kind !== 'ask') box.current?.focus();
  }, [shown]);

  const course = courses[at] as EvCourse;
  const first = firstName(person.name);
  const dish = course.dishes.find((one) => one.id === choice.dishId) ?? null;

  const save = (confirmed: boolean) => {
    const out = outcomeFor(person, course, choice, confirmed, opened.refuses === true);
    if (out.kind === 'error') {
      setError(out.words);
      requestAnimationFrame(() => document.getElementById(out.focus)?.focus());
      return;
    }
    if (out.kind === 'ask') {
      setAsking(out.allergens);
      return;
    }
    setAsking(null);
    if (out.kind === 'refused') {
      setRefused(true);
      return;
    }
    onSave(course.id, person.id, out.pick, out.line, out.overridden);
    if (at + 1 < courses.length) {
      setAt(at + 1);
      setChoice(blankChoice);
      setError(null);
    } else onClose();
  };

  const pickDish = (dishId: string | 'kitchen') => {
    setChoice({ dishId, variantId: null, optionIds: [] });
    setError(null);
  };

  return (
    <>
      <div className="dialog-scrim" aria-hidden="true" />
      <div
        ref={box}
        className="dialog pk-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pk-for-title"
        tabIndex={-1}
      >
        <div className="dialog-heading">
          <h2 id="pk-for-title">{SW.choosing(person.name)}</h2>
          <p>{SW.courseOf(course.name, at + 1, courses.length)}</p>
        </div>
        {refused ? (
          <p className="pk-refused" role="alert">
            <Triangle />
            {SW.refused}
          </p>
        ) : (
          <div className="pk-form">
            <fieldset
              className="pk-field"
              aria-describedby={error != null ? 'pk-for-error' : undefined}
            >
              <legend>{course.name}</legend>
              <div className="pk-options">
                {course.dishes.map((one, index) => (
                  <DishOption
                    key={one.id}
                    id={index === 0 ? 'pk-for-dish' : `pk-for-${one.id}`}
                    name="pk-for-dish"
                    label={one.name}
                    checked={choice.dishId === one.id}
                    allergens={dishAllergens(one, person)}
                    first={first}
                    onPick={() => pickDish(one.id)}
                  />
                ))}
                <DishOption
                  id="pk-for-kitchen"
                  name="pk-for-dish"
                  label={SW.kitchenChoose}
                  checked={choice.dishId === 'kitchen'}
                  allergens={[]}
                  first={first}
                  onPick={() => pickDish('kitchen')}
                />
              </div>
            </fieldset>
            {dish != null && hasVariants(dish) && (
              <fieldset className="pk-field">
                <legend>{SW.whichWay(dish.name)}</legend>
                <div className="pk-options">
                  {variantsOf(dish).map((variant, index) => (
                    <DishOption
                      key={variant.id}
                      id={index === 0 ? 'pk-for-way' : `pk-for-${variant.id}`}
                      name="pk-for-way"
                      label={variant.name}
                      childrenOnly={!isForEveryone(variant)}
                      checked={choice.variantId === variant.id}
                      allergens={ruledOut(person, containsOf(dish, variant.id, []))}
                      first={first}
                      onPick={() => {
                        setChoice({ ...choice, variantId: variant.id });
                        setError(null);
                      }}
                    />
                  ))}
                </div>
              </fieldset>
            )}
            {dish != null &&
              (dish.choices ?? []).map((one) => (
                <fieldset key={one.id} className="pk-field">
                  <legend>{one.question}</legend>
                  <div className="pk-options">
                    {one.options.map((option, index) => (
                      <DishOption
                        key={option.id}
                        id={index === 0 ? 'pk-for-option' : `pk-for-${option.id}`}
                        name={`pk-for-${one.id}`}
                        label={option.name}
                        checked={choice.optionIds.includes(option.id)}
                        allergens={ruledOut(person, codesOf(option.contains))}
                        first={first}
                        onPick={() => {
                          setChoice({
                            ...choice,
                            optionIds: [
                              ...choice.optionIds.filter(
                                (id) => !one.options.some((other) => other.id === id),
                              ),
                              option.id,
                            ],
                          });
                          setError(null);
                        }}
                      />
                    ))}
                  </div>
                </fieldset>
              ))}
            {error != null && (
              <p id="pk-for-error" className="pk-error">
                <span className="pk-error-mark" aria-hidden="true">
                  !
                </span>
                {error}
              </p>
            )}
          </div>
        )}
        <div className="dialog-actions">
          {refused ? (
            <button type="button" className="gs-pill is-secondary" onClick={onClose}>
              {SW.close}
            </button>
          ) : (
            <>
              <button type="button" className="desk-text pk-text" onClick={onClose}>
                {SW.cancel}
              </button>
              <button type="button" className="gs-pill is-primary" onClick={() => save(false)}>
                {at + 1 < courses.length ? SW.saveNext : SW.save}
              </button>
            </>
          )}
        </div>
      </div>
      {asking != null && dish != null && (
        <Override
          title={SW.overrideTitle(first, allergenList(asking, 'en'))}
          body={SW.overrideBody(
            pickName(dish, { kind: 'dish', ...choice, dishId: dish.id, how: 'host' }),
            allergenList(asking, 'en'),
            first,
          )}
          keep={SW.chooseAnother}
          go={SW.pickAnyway}
          onKeep={() => {
            setAsking(null);
            requestAnimationFrame(() => document.getElementById('pk-for-dish')?.focus());
          }}
          onGo={() => save(true)}
        />
      )}
    </>
  );
}

/** A dish's own allergens, or, with variants, those every variant guests may pick shares. */
function dishAllergens(dish: EvDish, person: Person) {
  if (!hasVariants(dish)) return ruledOut(person, containsOf(dish, null, []));
  const each = variantsOf(dish)
    .filter(isForEveryone)
    .map((variant) => ruledOut(person, containsOf(dish, variant.id, [])));

  return each.every((one) => one.length > 0) ? [...new Set(each.flat())] : [];
}

function DishOption({
  id,
  name,
  label,
  checked,
  allergens,
  first,
  childrenOnly = false,
  onPick,
}: {
  id: string;
  name: string;
  label: string;
  checked: boolean;
  allergens: readonly DishAllergen[];
  first: string;
  childrenOnly?: boolean;
  onPick: () => void;
}) {
  const ruled = allergens.length > 0;

  return (
    <label className={checked ? 'pk-option is-checked' : 'pk-option'}>
      <input
        id={id}
        type="radio"
        name={name}
        checked={checked}
        aria-describedby={ruled ? `${id}-ruled` : undefined}
        onChange={onPick}
      />
      <span className="pk-option-words">
        <span className="pk-option-name">
          {label}
          {childrenOnly && <ChildrenTag />}
        </span>
        {ruled && (
          <span id={`${id}-ruled`} className="pk-allergy">
            <span className="pk-allergy-mark">
              <Triangle />
              {SW.allergyMark}
            </span>
            {SW.ruledOut(allergenList(allergens, 'en'), first)}
          </span>
        )}
      </span>
    </label>
  );
}

function Override({
  title,
  body,
  keep,
  go,
  onKeep,
  onGo,
}: {
  title: string;
  body: string;
  keep: string;
  go: string;
  onKeep: () => void;
  onGo: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const keepButton = useRef<HTMLButtonElement>(null);
  useDialogKeys(box, onKeep, false);
  useEffect(() => keepButton.current?.focus(), []);

  return (
    <>
      <div className="dialog-scrim pk-over-scrim" aria-hidden="true" />
      <div
        ref={box}
        className="dialog pk-over"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="pk-over-title"
        aria-describedby="pk-over-body"
      >
        <div className="dialog-heading">
          <h2 id="pk-over-title">{title}</h2>
          <p id="pk-over-body">{body}</p>
        </div>
        <div className="dialog-actions">
          <button ref={keepButton} type="button" className="gs-pill is-primary" onClick={onKeep}>
            {keep}
          </button>
          <button type="button" className="gs-pill is-secondary" onClick={onGo}>
            {go}
          </button>
        </div>
      </div>
    </>
  );
}

type WhoOutcome =
  | { kind: 'ask'; people: Person[] }
  | { kind: 'refused' }
  | { kind: 'saved'; next: PicksWorld; line: string; overridden: string | null };

function whoParts(world: PicksWorld, opened: WhoOpened) {
  const course = world.courses.find((one) => one.id === opened.courseId) as EvCourse;
  const dish = course.dishes.find((one) => one.id === opened.dishId) as EvDish;
  const variant = variantsOf(dish).find((one) => one.id === opened.variantId) as Variant;

  return { course, dish, variant, contains: containsOf(dish, variant.id, []) };
}

/** Who has the variant as the dialog opens, with the state's ticks and unticks applied. */
function tickedOf(world: PicksWorld, opened: WhoOpened): ReadonlySet<string> {
  const { course, variant } = whoParts(world, opened);
  const now = new Set(
    world.people.filter((one) => hasVariant(world, course, one, variant.id)).map((one) => one.id),
  );
  for (const id of opened.toggle ?? []) {
    if (now.has(id)) now.delete(id);
    else now.add(id);
  }

  return now;
}

/** Save on Choose who gets it: the override question for anyone newly ticked whom it rules out, the 403, or the menu as saved. */
function outcomeWho(
  world: PicksWorld,
  opened: WhoOpened,
  ticked: ReadonlySet<string>,
  confirmed: boolean,
): WhoOutcome {
  const { course, dish, variant, contains } = whoParts(world, opened);
  const ruled = world.people.filter(
    (one) =>
      ticked.has(one.id) &&
      !hasVariant(world, course, one, variant.id) &&
      ruledOut(one, contains).length > 0,
  );
  if (ruled.length > 0 && !confirmed) return { kind: 'ask', people: ruled };
  if (opened.refuses === true) return { kind: 'refused' };

  return {
    kind: 'saved',
    next: giveVariant(
      world,
      course,
      dish.id,
      variant.id,
      ticked,
      ruled.length > 0 ? { by: HOST, at: CONFIRMED_AT } : null,
    ),
    line: SW.whoSaved(variant.name, dish.name, ticked.size),
    overridden: ruled.length > 0 ? SW.whoOverride(ruled.map((one) => one.name).join(', ')) : null,
  };
}

function ChooseWho({
  world,
  opened,
  onSave,
  onClose,
}: {
  world: PicksWorld;
  opened: WhoOpened;
  onSave: (next: PicksWorld, line: string, overridden: string | null) => void;
  onClose: () => void;
}) {
  const { course, dish, variant, contains } = whoParts(world, opened);
  const had = (person: Person) => hasVariant(world, course, person, variant.id);
  const [ticked, setTicked] = useState<ReadonlySet<string>>(() => tickedOf(world, opened));
  const [shown] = useState(() =>
    opened.press === true
      ? outcomeWho(world, opened, tickedOf(world, opened), opened.confirm === true)
      : null,
  );
  const [asking, setAsking] = useState<Person[] | null>(
    shown?.kind === 'ask' ? shown.people : null,
  );
  const [refused, setRefused] = useState(shown?.kind === 'refused');
  const box = useRef<HTMLDivElement>(null);
  useDialogKeys(box, onClose, false);

  useEffect(() => {
    if (shown?.kind !== 'ask') box.current?.focus();
  }, [shown]);

  const save = (confirmed: boolean) => {
    const out = outcomeWho(world, opened, ticked, confirmed);
    if (out.kind === 'ask') {
      setAsking(out.people);
      return;
    }
    setAsking(null);
    if (out.kind === 'refused') {
      setRefused(true);
      return;
    }
    onSave(out.next, out.line, out.overridden);
    onClose();
  };

  const toggle = (id: string) =>
    setTicked((now) => {
      const next = new Set(now);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      <div className="dialog-scrim" aria-hidden="true" />
      <div
        ref={box}
        className="dialog pk-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pk-who-title"
        aria-describedby="pk-who-help"
        tabIndex={-1}
      >
        <div className="dialog-heading">
          <h2 id="pk-who-title">{SW.whoTitle(variant.name)}</h2>
          <p>{SW.whoSub(dish.name, course.name)}</p>
          <p id="pk-who-help">{SW.whoHelp}</p>
        </div>
        {refused ? (
          <p className="pk-refused" role="alert">
            <Triangle />
            {SW.refused}
          </p>
        ) : (
          <div className="pk-form pk-who-list">
            {world.parties.map((party) => {
              const members = world.people.filter((one) => one.party === party.id);

              return (
                <fieldset key={party.id} className="pk-field">
                  <legend>{SW.replied(party.replier, members.length)}</legend>
                  {members.map((person) => {
                    const ruled = ruledOut(person, contains);
                    const leaving = had(person) && !ticked.has(person.id);
                    const lineId = `pk-who-${person.id}-line`;

                    return (
                      <div key={person.id} className="pk-tick">
                        <label className="pk-tick-name">
                          <input
                            id={`pk-who-${person.id}`}
                            type="checkbox"
                            checked={ticked.has(person.id)}
                            aria-describedby={ruled.length > 0 || leaving ? lineId : undefined}
                            onChange={() => toggle(person.id)}
                          />
                          {person.name}
                        </label>
                        {(ruled.length > 0 || leaving) && (
                          <span id={lineId} className="pk-tick-lines">
                            {ruled.length > 0 && (
                              <span className="pk-allergy">
                                <span className="pk-allergy-mark">
                                  <Triangle />
                                  {SW.allergyMark}
                                </span>
                                {SW.ruledOutWho(allergenList(ruled, 'en'), firstName(person.name))}
                              </span>
                            )}
                            {leaving && (
                              <span className="pk-leaving">{goesBack(course, person)}</span>
                            )}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </fieldset>
              );
            })}
          </div>
        )}
        <div className="dialog-actions">
          {refused ? (
            <button type="button" className="gs-pill is-secondary" onClick={onClose}>
              {SW.close}
            </button>
          ) : (
            <>
              <button type="button" className="desk-text pk-text" onClick={onClose}>
                {SW.cancel}
              </button>
              <button type="button" className="gs-pill is-primary" onClick={() => save(false)}>
                {SW.save}
              </button>
            </>
          )}
        </div>
      </div>
      {asking != null && (
        <Override
          title={SW.overrideWhoTitle(
            asking.map((one) => firstName(one.name)).join(', '),
            variant.name,
          )}
          body={SW.overrideWhoBody(
            asking
              .map(
                (one) =>
                  `${variant.name} contains ${allergenList(ruledOut(one, contains), 'en')}, which ${firstName(one.name)} is allergic to.`,
              )
              .join(' '),
          )}
          keep={SW.leaveOut}
          go={SW.giveAnyway}
          onKeep={() => {
            setTicked((now) => {
              const next = new Set(now);
              for (const one of asking) next.delete(one.id);
              return next;
            });
            setAsking(null);
          }}
          onGo={() => save(true)}
        />
      )}
    </>
  );
}

/** The two AC lines on updates, worked by hand: a guest sends their picks, an allergy is saved or removed. */
function DemoOnly({ world, onWorld }: { world: PicksWorld; onWorld: (next: PicksWorld) => void }) {
  const next = whoHasnt(world).flatMap((one) => one.people)[0] ?? null;
  const ada = world.people.find((one) => one.id === 'ada-obi');
  const milk = ada?.allergies.includes('milk') ?? false;

  const send = () => {
    if (next == null) return;
    let now = world;
    for (const course of next.courses) {
      const safe = course.dishes.find((dish) => {
        const way = variantsOf(dish).find(
          (one) =>
            isForEveryone(one) && ruledOut(next.person, containsOf(dish, one.id, [])).length === 0,
        );
        return hasVariants(dish)
          ? way != null
          : ruledOut(next.person, containsOf(dish, null, [])).length === 0;
      });
      if (safe == null) continue;
      const way =
        variantsOf(safe).find(
          (one) =>
            isForEveryone(one) && ruledOut(next.person, containsOf(safe, one.id, [])).length === 0,
        ) ?? null;
      const option = (safe.choices ?? []).map((one) => one.options[0]?.id ?? '').filter(Boolean);
      now = chooseFor(now, course.id, next.person.id, {
        kind: 'dish',
        dishId: safe.id,
        variantId: way?.id ?? null,
        optionIds: option,
        how: 'guest',
      });
    }
    onWorld(now);
  };

  const allergy = () =>
    onWorld({
      ...world,
      people: world.people.map((one) =>
        one.id === 'ada-obi' ? { ...one, allergies: milk ? [] : (['milk'] as const) } : one,
      ),
    });

  return (
    <div className="pk-demo">
      <p className="pk-demo-label">{SW.demoOnly}</p>
      <div className="pk-demo-acts">
        <button
          type="button"
          className="gs-pill is-secondary"
          disabled={next == null}
          onClick={send}
        >
          {next == null ? SW.demoNobody : SW.demoSends(next.person.name)}
        </button>
        <button type="button" className="gs-pill is-secondary" onClick={allergy}>
          {SW.demoAllergy('Ada', 'milk', milk)}
        </button>
      </div>
    </div>
  );
}

function Triangle() {
  return (
    <svg className="pk-mark is-host" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <path
        d="M10 2.5 18.5 17h-17L10 2.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M10 8v4M10 14.5v.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function Star() {
  return (
    <svg className="pk-mark" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <path
        d="m10 2.5 2.3 4.9 5.2.6-3.9 3.6 1.1 5.2L10 14.2l-4.7 2.6 1.1-5.2L2.5 8l5.2-.6L10 2.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CircleMinus() {
  return (
    <svg className="pk-mark" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6.5 10h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function DashedCircle() {
  return (
    <svg className="pk-mark" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <circle
        cx="10"
        cy="10"
        r="7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeDasharray="3 2.6"
      />
    </svg>
  );
}

function Swap() {
  return (
    <svg className="pk-mark" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <path
        d="M4 7h11l-3-3M16 13H5l3 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
