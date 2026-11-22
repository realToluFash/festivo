import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import type { Allergen } from './guestKitchenWords.ts';
import { AllergyMark } from './GuestNeeds.tsx';
import { Filled, Notice, TextAction } from './GuestParts.tsx';
import { MSW } from './mealClose.ts';
import {
  type Allergies,
  type Answers,
  type ClearedPick,
  type CopyMade,
  type MealScreen,
  type CourseKey,
  type PartyAnswer,
  type PartyCourse,
  type PartyDish,
  type PartyPerson,
  type PartyStart,
  type RowKey,
  type Who,
  COURSES,
  PW,
  allergyList,
  clearRuledOut,
  copyAnswers,
  courseOf,
  dishOf,
  mapWho,
  markOf,
  markedOpen,
  nothingSafe,
  oneDate,
  partyOf,
  personOf,
  reasonOf,
  rowKey,
  ruledOut,
  sameAllergies,
  sameAnswer,
  screenAt,
  screensOf,
} from './mealParty.ts';
import { Refused } from './MealParts.tsx';
import { allergenList } from './mealStep.ts';
import { type DishAllergen, type Lang, allergenName, dietName } from './menuLibrary.ts';
import { PCW, closeOf, dayWords } from './picksClose.ts';
import './mealParty.css';

type From = 'flow' | 'check' | 'card' | 'copy';
type View =
  | { kind: 'kitchen'; from: From }
  | { kind: 'course'; at: number; from: From }
  | { kind: 'card' }
  | { kind: 'check' }
  | { kind: 'sent' };
type Told = 'marked' | 'nothing' | 'saved' | null;

const changeId = (key: RowKey | 'kitchen') => `pc-change-${key.replace('|', '-')}`;
const reasonId = (key: RowKey) => `pc-reason-${key.replace('|', '-')}`;

function unite(recorded: Allergies, added: Allergies): Allergies {
  return mapWho((who) => [
    ...recorded[who],
    ...added[who].filter((one) => !recorded[who].includes(one)),
  ]);
}

/** A pick that a later allergy rules out opens with nothing chosen; anything else opens as it was. */
function draftOf(
  answer: PartyAnswer | undefined,
  course: CourseKey,
  allergies: readonly Allergen[],
) {
  if (answer == null) return null;
  if (answer.kind !== 'chosen' || answer.by === 'host') return answer;
  const picked = dishOf(course, answer.dishId);

  return picked == null || ruledOut(picked, allergies) != null ? null : answer;
}

/** sc-3907's meal step for each person coming, after the kitchen note, and Check and send's meal cards. */
export function MealParty({
  first,
  lang,
  preview,
  again,
  onClosePreview,
}: {
  first: PartyStart;
  lang: Lang;
  preview: boolean;
  again: string;
  onClosePreview: (() => void) | null;
}) {
  const SCREENS = screensOf(first.people);
  const PARTY = partyOf(first.people);
  const opening = first.view.kind === 'course' ? SCREENS[first.view.at] : undefined;
  const [answers, setAnswers] = useState<Answers>(first.answers);
  const [added, setAdded] = useState<Allergies>(first.added);
  const [saved, setSaved] = useState<Answers>(first.saved);
  const [savedAdded, setSavedAdded] = useState<Allergies>(first.savedAdded);
  const [view, setView] = useState<View>(
    first.view.kind === 'course'
      ? { kind: 'course', at: first.view.at, from: first.copy == null ? 'flow' : 'copy' }
      : first.view,
  );
  const [copy, setCopy] = useState<CopyMade | null>(first.copy ?? null);
  const [draft, setDraft] = useState<PartyAnswer | null>(
    opening == null
      ? null
      : draftOf(
          first.answers[rowKey(opening.who, opening.course)],
          opening.course,
          unite(first.recorded, first.added)[opening.who],
        ),
  );
  const [pressed, setPressed] = useState(first.pressed);
  const [cleared, setCleared] = useState(first.cleared);
  const [told, setTold] = useState<Told>(null);
  const focus = useRef<string | null>(
    first.pressed ? 'first' : first.view.kind === 'card' ? 'pc-for-h' : null,
  );
  const allergies = unite(first.recorded, added);

  useEffect(() => {
    if (focus.current == null) return;
    const want = focus.current;
    focus.current = null;
    const target =
      want === 'first'
        ? document.querySelector<HTMLElement>('.ms-options input:not(:disabled)')
        : document.getElementById(want);
    target?.focus();
  });

  function openCourse(at: number, from: From, given: Answers = answers) {
    const screen = SCREENS[at];
    if (screen == null) return;
    setDraft(
      draftOf(given[rowKey(screen.who, screen.course)], screen.course, allergies[screen.who]),
    );
    setPressed(false);
    setTold(null);
    setView({ kind: 'course', at, from });
    focus.current = 'ms-h';
  }

  function toCard(target: string) {
    setTold(null);
    setView({ kind: 'card' });
    focus.current = target;
  }

  function sameAs(from: Who, to: Who) {
    const result = copyAnswers(
      answers,
      from,
      to,
      allergies[to],
      (course) => closeOf(course, first.dates).closed,
    );
    setAnswers(result.answers);
    setCleared((was) =>
      Object.fromEntries(Object.entries(was).filter(([one]) => !one.startsWith(`${to}|`))),
    );
    setCopy({ who: to, from, asked: result.asked });
    const asked = result.asked[0];
    if (asked == null) {
      toCard('pc-for-h');
      return;
    }
    openCourse(screenAt(to, asked, SCREENS), 'copy', result.answers);
  }

  function toCheck(target: string) {
    setTold(null);
    setView({ kind: 'check' });
    focus.current = target;
  }

  function store(key: RowKey, answer: PartyAnswer | null): Answers {
    const next: Partial<Record<RowKey, PartyAnswer>> = { ...answers };
    if (answer == null) delete next[key];
    else next[key] = answer;
    setAnswers(next);

    return next;
  }

  if (view.kind === 'kitchen') {
    return (
      <KitchenStandIn
        people={first.people}
        added={added}
        onToggle={(who, code) =>
          setAdded((was) => ({
            ...was,
            [who]: was[who].includes(code)
              ? was[who].filter((one) => one !== code)
              : [...was[who], code],
          }))
        }
        onNext={() => {
          if (view.from === 'check') {
            toCheck(changeId('kitchen'));
            return;
          }
          const result = clearRuledOut(answers, allergies, SCREENS);
          setAnswers(result.answers);
          setCleared((was) => ({ ...was, ...result.cleared }));
          openCourse(0, 'flow', result.answers);
        }}
      />
    );
  }

  if (view.kind === 'course') {
    const screen = SCREENS[view.at] ?? SCREENS[0];
    if (screen == null) return null;
    const key = rowKey(screen.who, screen.course);
    const course = courseOf(screen.course);
    const person = personOf(screen.who);
    const safe = !nothingSafe(course, allergies[screen.who]);
    const earlier =
      view.from === 'flow' && screen.n === 1
        ? PARTY.slice(
            0,
            PARTY.findIndex((one) => one.key === screen.who),
          )
        : [];
    const asking = view.from === 'copy' && copy?.who === screen.who ? copy : null;

    return (
      <CourseScreen
        screen={screen}
        person={person}
        course={course}
        allergies={allergies[screen.who]}
        other={screen.n === 1 ? (first.other[screen.who] ?? null) : null}
        earlier={earlier}
        onSameAs={(from) => sameAs(from, screen.who)}
        asked={
          asking?.asked.includes(screen.course) === true
            ? PW.cantCopy(personOf(asking.from), course.name, person)
            : null
        }
        cleared={cleared[key] ?? null}
        draft={draft}
        refusal={pressed && draft == null && safe ? PW.chooseFor(course.name, person) : null}
        close={dayWords(closeOf(screen.course, first.dates).on, lang)}
        lang={lang}
        onDraft={(answer) => {
          setDraft(answer);
          setPressed(false);
        }}
        onBack={() => {
          if (view.from === 'check') {
            toCheck(changeId(key));
            return;
          }
          if (view.from === 'card') {
            toCard(changeId(key));
            return;
          }
          const kept = store(key, draft);
          if (view.at === 0) {
            setView({ kind: 'kitchen', from: 'flow' });
            focus.current = 'pk-h';
            return;
          }
          openCourse(view.at - 1, 'flow', kept);
        }}
        onNext={() => {
          const answer: PartyAnswer | null = draft ?? (safe ? null : { kind: 'host' });
          if (answer == null) {
            setPressed(true);
            focus.current = 'first';
            return;
          }
          const kept = store(key, answer);
          setCleared((was) =>
            Object.fromEntries(Object.entries(was).filter(([one]) => one !== key)),
          );
          if (view.from === 'check') toCheck(changeId(key));
          else if (view.from === 'card') toCard(changeId(key));
          else if (view.from === 'copy' && asking != null) {
            const after = asking.asked.find((one) => screenAt(screen.who, one, SCREENS) > view.at);
            if (after == null) toCard('pc-for-h');
            else openCourse(screenAt(screen.who, after, SCREENS), 'copy', kept);
          } else if (view.at === SCREENS.length - 1) toCheck('pc-h');
          else openCourse(view.at + 1, 'flow', kept);
        }}
      />
    );
  }

  if (view.kind === 'card' && copy != null) {
    const who = copy.who;
    const last = PARTY.at(-1)?.key === who;

    return (
      <CopiedCard
        person={personOf(who)}
        from={personOf(copy.from)}
        answers={answers}
        onChange={(course) => openCourse(screenAt(who, course, SCREENS), 'card')}
        onBack={() => openCourse(screenAt(who, COURSES[0]?.key ?? 'starter', SCREENS), 'flow')}
        onContinue={() => {
          if (last) {
            toCheck('pc-h');
            return;
          }
          const next = PARTY[PARTY.findIndex((one) => one.key === who) + 1];
          if (next != null)
            openCourse(screenAt(next.key, COURSES[0]?.key ?? 'starter', SCREENS), 'flow');
        }}
      />
    );
  }

  if (view.kind === 'sent') {
    return (
      <section className="gk ms" aria-labelledby="pc-sent">
        <p id="pc-sent" className="ms-done" role="status" tabIndex={-1}>
          {PW.sent}
        </p>
        <Link className="gp-text is-ink" to={again} reloadDocument>
          <Glyph name="undo" size={16} weight={2.2} />
          <span>{PW.again}</span>
        </Link>
      </section>
    );
  }

  const closed = (course: CourseKey) => closeOf(course, first.dates).closed;
  const marked = markedOpen(answers, allergies, closed, lang, SCREENS);
  const back = first.mode === 'back';
  const kitchenPending =
    back && PARTY.some((one) => !sameAllergies(added[one.key], savedAdded[one.key]));
  const pending = (key: RowKey) => back && !sameAnswer(answers[key], saved[key]);

  function send() {
    if (preview) {
      onClosePreview?.();
      return;
    }
    const firstMarked = marked[0];
    if (firstMarked != null) {
      setTold('marked');
      focus.current = changeId(firstMarked);
      return;
    }
    if (!back) {
      setView({ kind: 'sent' });
      focus.current = 'pc-sent';
      return;
    }
    const changed =
      kitchenPending || SCREENS.some(({ who, course }) => pending(rowKey(who, course)));
    if (!changed) {
      setTold('nothing');
      return;
    }
    setSaved(answers);
    setSavedAdded(added);
    setTold('saved');
  }

  return (
    <CheckAndSend
      party={PARTY}
      you={first.you}
      back={back}
      answers={answers}
      allergies={allergies}
      other={first.other}
      dates={first.dates}
      lang={lang}
      marked={marked}
      told={told}
      preview={preview}
      kitchenPending={kitchenPending}
      pending={pending}
      closed={closed}
      onBack={() => openCourse(SCREENS.length - 1, 'flow')}
      onKitchen={() => {
        setTold(null);
        setView({ kind: 'kitchen', from: 'check' });
        focus.current = 'pk-h';
      }}
      onChange={(key) => {
        const [who, course] = key.split('|') as [Who, CourseKey];
        openCourse(screenAt(who, course, SCREENS), 'check');
      }}
      onSend={send}
    />
  );
}

const KITCHEN_CHOICES: readonly { who: Who; code: DishAllergen }[] = [
  { who: 'chidi', code: 'milk' },
  { who: 'me', code: 'milk' },
];

function KitchenStandIn({
  people,
  added,
  onToggle,
  onNext,
}: {
  people: readonly Who[];
  added: Allergies;
  onToggle: (who: Who, code: DishAllergen) => void;
  onNext: () => void;
}) {
  return (
    <section className="gk ms" aria-labelledby="pk-h">
      <h2 id="pk-h" className="gp-h2 gk-h2" tabIndex={-1}>
        {PW.kitchenTitle}
      </h2>
      <div className="pc-standin">
        <p>{PW.kitchenStandIn}</p>
        <p className="pc-standin-label">{PW.kitchenDemo}</p>
        <div className="pc-standin-chips">
          {KITCHEN_CHOICES.filter(({ who }) => people.includes(who)).map(({ who, code }) => {
            const on = added[who].includes(code);

            return (
              <button
                key={`${who}-${code}`}
                type="button"
                className={on ? 'gk-chip is-allergy' : 'gk-chip'}
                aria-pressed={on}
                onClick={() => onToggle(who, code)}
              >
                <span>{PW.kitchenAllergy(personOf(who), allergenName(code, 'en'))}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="gk-actions">
        <Filled onClick={onNext}>{PW.next}</Filled>
      </div>
    </section>
  );
}

function ContainsLine({ dish, lang }: { dish: PartyDish; lang: Lang }) {
  const kind = dish.contains == null ? 'unstated' : dish.contains === 'none' ? 'none' : 'contains';

  return (
    <span className="pc-contains">
      <span className={`pc-mark is-${kind}`} aria-hidden="true">
        {kind === 'contains' ? '!' : kind === 'none' ? '0' : '?'}
      </span>
      <span>
        {dish.contains == null
          ? PW.notStated
          : dish.contains === 'none'
            ? PW.containsNone
            : PW.contains(allergenList(dish.contains, lang))}
      </span>
    </span>
  );
}

function CourseScreen({
  screen,
  person,
  course,
  allergies,
  other,
  earlier,
  onSameAs,
  asked,
  cleared,
  draft,
  refusal,
  close,
  lang,
  onDraft,
  onBack,
  onNext,
}: {
  screen: MealScreen;
  person: PartyPerson;
  course: PartyCourse;
  allergies: readonly Allergen[];
  other: string | null;
  earlier: readonly PartyPerson[];
  onSameAs: (from: Who) => void;
  asked: string | null;
  cleared: ClearedPick | null;
  draft: PartyAnswer | null;
  refusal: string | null;
  close: string;
  lang: Lang;
  onDraft: (answer: PartyAnswer) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const safe = !nothingSafe(course, allergies);
  const ruled = course.dishes.map((one) => ruledOut(one, allergies));
  const anyOut = safe && ruled.some((one) => one != null);
  const clearedDish = cleared == null ? null : dishOf(course.key, cleared.dishId);
  const describedBy = [
    asked != null && 'pc-asked',
    refusal != null && 'ms-refused',
    other != null && 'pc-other',
    clearedDish != null && 'pc-cleared',
    !safe && 'ms-unsafe',
    anyOut && 'ms-host',
    'ms-close',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section className="gk ms" aria-labelledby="ms-h">
      <TextAction ink icon={<Glyph name="back" size={18} weight={2.2} />} onClick={onBack}>
        {PW.back}
      </TextAction>
      <div className="gk-head">
        <p className="gk-label ms-who" aria-hidden="true">
          {[PW.forWho(person), course.name, PW.of(screen.n, screen.total)].join(' · ')}
        </p>
        <p id="ms-close" className="gk-text is-quiet ms-close">
          <Glyph name="clock" size={15} weight={2.4} />
          {PCW.line(close)}
        </p>
      </div>
      {earlier.length > 0 && (
        <div className="pc-same">
          {earlier.map((one) => (
            <button
              key={one.key}
              type="button"
              className="gp-outlined pc-same-button"
              aria-label={PW.sameAsName(one, person)}
              onClick={() => onSameAs(one.key)}
            >
              {PW.sameAs(one)}
            </button>
          ))}
        </div>
      )}
      <fieldset className="ms-set" aria-describedby={describedBy}>
        <legend className="ms-legend">
          <h2 id="ms-h" className="gp-h2 gk-h2" tabIndex={-1}>
            <span className="visually-hidden">
              {`${PW.forWhoLegend(person, course.name, screen.n, screen.total)} `}
            </span>
            {PW.which(course.name)}
          </h2>
        </legend>
        {asked != null && (
          <p id="pc-asked" className="pc-inset pc-asked">
            <span className="pc-info" aria-hidden="true">
              <Glyph name="info" size={14} weight={2.4} />
            </span>
            <span>{asked}</span>
          </p>
        )}
        {other != null && (
          <p id="pc-other" className="pc-inset">
            <AllergyMark />
            <span>{PW.other(person, other)}</span>
          </p>
        )}
        {clearedDish != null && cleared != null && (
          <p id="pc-cleared" className="pc-inset">
            <AllergyMark />
            <span>{PW.cleared(person, clearedDish.name, allergenList(cleared.codes, lang))}</span>
          </p>
        )}
        {!safe && (
          <Notice kind="broken" alert={false} className="ms-unsafe">
            <span id="ms-unsafe">{PW.nothingSafe(person)}</span>
          </Notice>
        )}
        {refusal != null && <Refused words={refusal} />}
        <div className={refusal == null ? 'ms-options' : 'ms-options is-wrong'}>
          {course.dishes.map((one, index) => {
            const reason = reasonOf(ruled[index] ?? null, person, lang);

            return (
              <label key={one.id} className={reason == null ? 'ms-option' : 'ms-option is-out'}>
                <input
                  type="radio"
                  className="desk-radio"
                  name="pc-answer"
                  checked={draft?.kind === 'chosen' && draft.dishId === one.id}
                  disabled={reason != null}
                  onChange={() => onDraft({ kind: 'chosen', dishId: one.id, by: 'guest' })}
                />
                <span className="ms-option-words">
                  <span className="ms-option-name">{one.name}</span>
                  <span className="ms-quiet">{one.desc}</span>
                  {one.diets.length > 0 && (
                    <span className="pc-tags">
                      <span className="pc-tags-label">{PW.suitableFor}</span>
                      {one.diets.map((diet) => (
                        <span key={diet} className="pc-tag">
                          {dietName(diet, lang)}
                        </span>
                      ))}
                    </span>
                  )}
                  <ContainsLine dish={one} lang={lang} />
                  {reason != null && (
                    <span className="ms-out-line">
                      <AllergyMark />
                      {reason}
                    </span>
                  )}
                </span>
              </label>
            );
          })}
          <hr className="ms-rule" />
          {safe && (
            <label className="ms-option is-plain">
              <input
                type="radio"
                className="desk-radio"
                name="pc-answer"
                checked={draft?.kind === 'kitchen'}
                onChange={() => onDraft({ kind: 'kitchen' })}
              />
              <span className="ms-option-name">{PW.letKitchen}</span>
            </label>
          )}
          {course.skip && (
            <label className="ms-option is-plain">
              <input
                type="radio"
                className="desk-radio"
                name="pc-answer"
                checked={draft?.kind === 'skipped'}
                onChange={() => onDraft({ kind: 'skipped' })}
              />
              <span className="ms-option-name">{PW.noCourse(course.name)}</span>
            </label>
          )}
        </div>
        {anyOut && (
          <p id="ms-host" className="gk-text is-quiet">
            {PW.hostLine(person)}
          </p>
        )}
      </fieldset>
      <div className="gk-actions">
        <Filled onClick={onNext}>{PW.next}</Filled>
      </div>
    </section>
  );
}

function ForkKnife() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <path
        d="M4 1.5v4.5a1.5 1.5 0 0 0 1.5 1.5v7M7 1.5v4.5a1.5 1.5 0 0 1-1.5 1.5M5.5 1.5v4M11.5 14.5V1.5c-1.7.8-2.5 2.6-2.5 5v2h2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Pick({ answer, course }: { answer: PartyAnswer | undefined; course: PartyCourse }) {
  if (answer == null) return <p className="mx-pick">{MSW.notChosen}</p>;
  if (answer.kind === 'chosen')
    return <p className="mx-pick">{dishOf(course.key, answer.dishId)?.name ?? MSW.notChosen}</p>;
  const shape =
    answer.kind === 'kitchen'
      ? { ring: 'is-kitchen', mark: <ForkKnife />, words: PW.kitchenChooses }
      : answer.kind === 'skipped'
        ? {
            ring: 'is-skipped',
            mark: <Glyph name="minus" size={13} weight={2.6} />,
            words: PW.skipped(course.name),
          }
        : {
            ring: 'is-host',
            mark: <Glyph name="message" size={13} weight={2.4} />,
            words: PW.hostInTouch,
          };

  return (
    <p className="mx-pick pc-shape">
      <span className={`pc-ring ${shape.ring}`} aria-hidden="true">
        {shape.mark}
      </span>
      <span>{shape.words}</span>
    </p>
  );
}

function CopiedCard({
  person,
  from,
  answers,
  onChange,
  onBack,
  onContinue,
}: {
  person: PartyPerson;
  from: PartyPerson;
  answers: Answers;
  onChange: (course: CourseKey) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <section className="gk ms pc-check" aria-labelledby="pc-for-h" aria-describedby="pc-copied">
      <h2 id="pc-for-h" className="gp-h2 gk-h2" tabIndex={-1}>
        {PW.forWho(person)}
      </h2>
      <p id="pc-copied" className="pc-saved">
        <Glyph name="copy" size={16} weight={2.2} />
        <span>{PW.copiedFrom(from)}</span>
      </p>
      <ul className="mx-rows">
        {COURSES.map((course) => {
          const key = rowKey(person.key, course.key);

          return (
            <li key={key} className="mx-row pc-row">
              <div className="mx-words">
                <p className="mx-course">{course.name}</p>
                <Pick answer={answers[key]} course={course} />
              </div>
              <button
                id={changeId(key)}
                type="button"
                className="gp-text is-ink"
                aria-label={PW.changeAria(course.name, person)}
                onClick={() => onChange(course.key)}
              >
                <span>{PW.change}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="pc-footer">
        <button type="button" className="gp-outlined" onClick={onBack}>
          {PW.back}
        </button>
        <Filled onClick={onContinue}>{PW.continue}</Filled>
      </div>
    </section>
  );
}

function CheckAndSend({
  party,
  you,
  back,
  answers,
  allergies,
  other,
  dates,
  lang,
  marked,
  told,
  preview,
  kitchenPending,
  pending,
  closed,
  onBack,
  onKitchen,
  onChange,
  onSend,
}: {
  party: readonly PartyPerson[];
  you: string;
  back: boolean;
  answers: Answers;
  allergies: Allergies;
  other: PartyStart['other'];
  dates: PartyStart['dates'];
  lang: Lang;
  marked: readonly RowKey[];
  told: Told;
  preview: boolean;
  kitchenPending: boolean;
  pending: (key: RowKey) => boolean;
  closed: (course: CourseKey) => boolean;
  onBack: () => void;
  onKitchen: () => void;
  onChange: (key: RowKey) => void;
  onSend: () => void;
}) {
  const single = oneDate(dates);
  const day = (course: CourseKey) => dayWords(closeOf(course, dates).on, lang);
  const said = party.filter((one) => allergies[one.key].length > 0 || other[one.key] != null);

  return (
    <section className="gk ms pc-check" aria-labelledby="pc-h">
      {!back && (
        <TextAction ink icon={<Glyph name="back" size={18} weight={2.2} />} onClick={onBack}>
          {PW.back}
        </TextAction>
      )}
      <h2 id="pc-h" className="gp-h2 gk-h2" tabIndex={-1}>
        {back ? PW.yourPicks : PW.check}
      </h2>
      {back && single && (
        <p className="pc-saved">
          <Glyph name="tick" size={16} weight={2.6} />
          <span>{PW.savedUntil(day('main'))}</span>
        </p>
      )}
      <div className="gk-rows">
        {!back && (
          <>
            <div className="gk-row">
              <div className="gk-row-words">
                <p className="gk-label">{PW.yourAnswer}</p>
                <p className="gk-value">{PW.coming}</p>
              </div>
            </div>
            <div className="gk-row">
              <div className="gk-row-words">
                <p className="gk-label">{PW.whoComing}</p>
                <p className="gk-value">
                  {PW.party(party.map((one) => (one.you ? you : one.name)))}
                </p>
              </div>
            </div>
          </>
        )}
        <div className="gk-row">
          <div className="gk-row-words">
            <p className="gk-label">{PW.kitchenRow}</p>
            {kitchenPending && <p className="mx-pending">{PW.notSent}</p>}
            {said.length === 0 && <p className="gk-value">{PW.kitchenNothing}</p>}
            {said.map((one) => (
              <div key={one.key} className="gk-person">
                <p className="gk-value">{PW.kitchenWho(one)}</p>
                {allergies[one.key].length > 0 && (
                  <p className="pc-said">
                    <AllergyMark />
                    <span>{PW.allergyIs(allergyList(allergies[one.key], lang))}</span>
                  </p>
                )}
                {other[one.key] != null && (
                  <p className="pc-said">
                    <AllergyMark />
                    <span>{PW.allergyIs((other[one.key] ?? '').toLocaleLowerCase('en'))}</span>
                  </p>
                )}
              </div>
            ))}
          </div>
          <button
            id={changeId('kitchen')}
            type="button"
            className="gp-text is-ink"
            aria-label={PW.changeKitchen}
            onClick={onKitchen}
          >
            <span>{PW.change}</span>
          </button>
        </div>
      </div>
      <div className="pc-meals">
        {!back && (
          <div className="pc-meals-head">
            <h3 className="pc-h3">{PW.checkMeals}</h3>
            <p className="gk-text">{PW.hostsGet}</p>
            {single && <p className="gk-text is-quiet">{PW.picksClose(day('main'))}</p>}
          </div>
        )}
        {party.map((person) => (
          <section key={person.key} className="pc-card" aria-labelledby={`pc-card-${person.key}`}>
            <h3 id={`pc-card-${person.key}`} className="pc-h3">
              {person.you ? PW.yourMeals : PW.theirMeals(person.name)}
            </h3>
            <ul className="mx-rows">
              {COURSES.map((course) => {
                const key = rowKey(person.key, course.key);
                const shut = closed(course.key);
                const mark = markOf(key, answers, allergies, lang);

                return (
                  <li key={key} className={shut ? 'mx-row pc-row is-closed' : 'mx-row pc-row'}>
                    <div className="mx-words">
                      <p className="mx-course">{course.name}</p>
                      <Pick answer={answers[key]} course={course} />
                      {pending(key) && <p className="mx-pending">{PW.notSent}</p>}
                      {!single && (
                        <p className="mx-close">
                          <Glyph name={shut ? 'lock' : 'clock'} size={15} weight={2.4} />
                          {shut ? PW.picksClosed(day(course.key)) : PW.picksClose(day(course.key))}
                        </p>
                      )}
                      {mark != null && (
                        <p className="ms-out-line">
                          <AllergyMark />
                          <span id={reasonId(key)}>{mark}</span>
                        </p>
                      )}
                      {mark != null && shut && <p className="gk-text">{PW.hostInTouchLine}</p>}
                    </div>
                    {!shut && (
                      <button
                        id={changeId(key)}
                        type="button"
                        className="gp-text is-ink"
                        aria-label={PW.changeAria(course.name, person)}
                        aria-describedby={mark == null ? undefined : reasonId(key)}
                        onClick={() => onChange(key)}
                      >
                        <span>{PW.change}</span>
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      {told === 'marked' && marked.length > 0 && (
        <p className="desk-error ms-refused pc-marked" role="alert">
          <Glyph name="alert" size={16} weight={2.2} />
          {PW.marked(marked.length)}
        </p>
      )}
      <div className="mx-told" role="status">
        {told === 'nothing' && <p>{PW.nothingToSend}</p>}
        {told === 'saved' && <p>{PW.changesSaved}</p>}
      </div>
      <div className="gk-actions">
        <Filled onClick={onSend}>
          {preview ? PW.closePreview : back ? PW.sendChanges : PW.send}
        </Filled>
      </div>
    </section>
  );
}

export function PreviewBand({ onClose }: { onClose: () => void }) {
  return (
    <div className="pc-preview" role="note">
      <Glyph name="eye" size={17} weight={2.2} />
      <span>{PW.preview}</span>
      <button type="button" className="gp-text is-ink pc-preview-close" onClick={onClose}>
        <span>{PW.closePreview}</span>
      </button>
    </div>
  );
}
