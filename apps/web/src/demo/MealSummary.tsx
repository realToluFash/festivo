import { useEffect, useRef, useState } from 'react';

import { Glyph } from '../components/Glyph.tsx';
import { Filled } from './GuestParts.tsx';
import {
  type CourseId,
  type Saved,
  type SummaryStart,
  GUEST_PICKS,
  MSW,
  SUMMARY_COURSES,
  courseOf,
  pickName,
  sendPicks,
  summaryClose,
} from './mealClose.ts';
import { DishScreen } from './MealParts.tsx';
import { MW, PERSON, containsLine } from './mealStep.ts';
import type { Lang } from './menuLibrary.ts';
import { PCW, dayWords } from './picksClose.ts';

type Told = { kind: 'saved' | 'other' | 'nothing' } | null;

/** sc-3905's meal step on coming back: a row per course, its close, Change while it is open, and the send refused per course. */
export function Summary({ first, lang }: { first: SummaryStart; lang: Lang }) {
  const [today, setToday] = useState(first.today);
  const [saved, setSaved] = useState<Saved>(first.saved);
  const [changed, setChanged] = useState<Partial<Saved>>(first.changed);
  const [refused, setRefused] = useState<CourseId[]>([]);
  const [told, setTold] = useState<Told>(null);
  const [screen, setScreen] = useState<CourseId | null>(first.screen);
  const focus = useRef<string | null>(null);
  const dates = { ...GUEST_PICKS, today };
  const closes = SUMMARY_COURSES.map((one) => summaryClose(one.id, dates));
  const allClosed = closes.every((one) => one.closed);

  useEffect(() => {
    if (focus.current == null) return;
    document.getElementById(focus.current)?.focus();
    focus.current = null;
  });

  function send() {
    if (Object.keys(changed).length === 0) {
      setTold({ kind: 'nothing' });
      return;
    }
    const on = first.sendOn ?? today;
    const result = sendPicks(saved, changed, dates, on);
    setToday(on);
    setSaved(result.saved);
    setChanged({});
    setRefused(result.refused);
    if (result.refused.length === 0) {
      setTold({ kind: 'saved' });
      focus.current = 'mx-told';
      return;
    }
    setTold(result.savedOther ? { kind: 'other' } : null);
    focus.current = `mx-refused-${result.refused[0] as CourseId}`;
  }

  function openCourse(id: CourseId) {
    setTold(null);
    setScreen(id);
    focus.current = 'ms-h';
  }

  function backFrom(id: CourseId) {
    const at = SUMMARY_COURSES.findIndex((one) => one.id === id);
    const after = SUMMARY_COURSES[at + 1];
    if (first.screen != null && after != null && screen === first.screen) {
      setScreen(after.id);
      focus.current = 'ms-h';
      return;
    }
    setScreen(null);
    focus.current = `mx-change-${id}`;
  }

  if (screen != null) {
    return (
      <CourseScreen
        id={screen}
        pick={changed[screen] !== undefined ? (changed[screen] ?? null) : saved[screen]}
        dates={dates}
        lang={lang}
        onPick={(dishId) => {
          setRefused((was) => was.filter((one) => one !== screen));
          setChanged((was) =>
            dishId === saved[screen]
              ? Object.fromEntries(Object.entries(was).filter(([key]) => key !== screen))
              : { ...was, [screen]: dishId },
          );
        }}
        onNext={() => backFrom(screen)}
      />
    );
  }

  return (
    <section className="gk ms mx" aria-labelledby="mx-h">
      <div className="gk-head">
        <p className="gk-label">{MSW.forName(PERSON)}</p>
        <h2 id="mx-h" className="gp-h2 gk-h2">
          {MSW.title}
        </h2>
      </div>
      <ul className="mx-rows">
        {SUMMARY_COURSES.map((one, index) => {
          const close = closes[index] as (typeof closes)[number];
          const pending = changed[one.id] !== undefined;
          const pick = pending ? (changed[one.id] ?? null) : saved[one.id];
          const day = dayWords(close.on, lang);

          return (
            <li key={one.id} className={close.closed ? 'mx-row is-closed' : 'mx-row'}>
              <div className="mx-words">
                <p className="mx-course">{one.course.name}</p>
                <p className="mx-pick">{pickName(one.id, pick) ?? MSW.notChosen}</p>
                {pending && <p className="mx-pending">{MSW.notSent}</p>}
                <p className="mx-close">
                  <Glyph name={close.closed ? 'lock' : 'clock'} size={15} weight={2.4} />
                  {close.closed ? PCW.lineClosed(day) : PCW.line(day)}
                </p>
                {refused.includes(one.id) && (
                  <p
                    id={`mx-refused-${one.id}`}
                    className="desk-error ms-refused"
                    role="alert"
                    tabIndex={-1}
                  >
                    <Glyph name="alert" size={16} weight={2.2} />
                    {MSW.refused(one.course.name, day)}
                  </p>
                )}
              </div>
              {!close.closed && (
                <button
                  id={`mx-change-${one.id}`}
                  type="button"
                  className="gp-text is-ink"
                  aria-label={MSW.changeAria(one.course.name, PERSON)}
                  onClick={() => openCourse(one.id)}
                >
                  <span>{MSW.change}</span>
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <div id="mx-told" className="mx-told" role="status" tabIndex={-1}>
        {told?.kind === 'saved' && <p>{MSW.saved}</p>}
        {told?.kind === 'other' && <p>{MSW.otherSaved}</p>}
        {told?.kind === 'nothing' && <p>{MSW.nothingToSend}</p>}
      </div>
      {allClosed ? (
        <p className="gk-text mx-ask">{MSW.askHosts}</p>
      ) : (
        <div className="gk-actions">
          <Filled onClick={send}>{MSW.send}</Filled>
        </div>
      )}
    </section>
  );
}

function CourseScreen({
  id,
  pick,
  dates,
  lang,
  onPick,
  onNext,
}: {
  id: CourseId;
  pick: string | null;
  dates: typeof GUEST_PICKS;
  lang: Lang;
  onPick: (dishId: string) => void;
  onNext: () => void;
}) {
  const { course } = courseOf(id);
  const close = summaryClose(id, dates);
  const day = dayWords(close.on, lang);
  const at = SUMMARY_COURSES.findIndex((one) => one.id === id);
  const dish = course.dishes.find((one) => one.id === pick) ?? null;

  return (
    <section className="gk ms" aria-labelledby="ms-h">
      <div className="gk-head">
        <p className="gk-label ms-who">
          {[PERSON, course.name, MW.of(at + 1, SUMMARY_COURSES.length)].join(' · ')}
        </p>
        <p id="ms-close" className="gk-text is-quiet ms-close">
          <Glyph name={close.closed ? 'lock' : 'clock'} size={15} weight={2.4} />
          {close.closed ? PCW.lineClosed(day) : PCW.line(day)}
        </p>
      </div>
      {close.closed ? (
        <>
          <h2 id="ms-h" className="gp-h2 gk-h2" tabIndex={-1}>
            {MSW.yourCourse(course.name)}
          </h2>
          {dish == null ? (
            <p className="gk-text">{MSW.notChosen}</p>
          ) : (
            <div className="ms-dish">
              <p className="ms-option-name">{dish.name}</p>
              <p className="ms-quiet">{dish.desc}</p>
              <p className="ms-contains">{containsLine(dish.contains, lang)}</p>
            </div>
          )}
        </>
      ) : (
        <DishScreen
          course={course}
          answer={{ dishId: pick, wayId: null, picks: {}, way: pick == null ? null : 'chosen' }}
          lang={lang}
          refusal={null}
          closeId="ms-close"
          onPick={onPick}
        />
      )}
      <div className="gk-actions">
        <Filled onClick={onNext}>{MW.next}</Filled>
      </div>
    </section>
  );
}
