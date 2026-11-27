import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import lockupUrl from '../brand/lockup.svg';
import { Glyph } from '../components/Glyph.tsx';
import { useMatches } from '../phoneWidth.ts';
import { LAYOUT_MEDIA, layoutOf, startOf, twoColumns, wordsFor } from './guest.ts';
import { Cover, Filled, Notice, PhaseNotice, TextAction } from './GuestParts.tsx';
import { Closed } from './Guest.tsx';
import { AllergyMark } from './GuestNeeds.tsx';
import { MealParty, PreviewBand } from './MealParty.tsx';
import { MENU_WITH_PREVIEW, isPartyState, partyStart } from './mealParty.ts';
import { DishScreen, Refused } from './MealParts.tsx';
import { Summary } from './MealSummary.tsx';
import { GUEST_PICKS } from './mealClose.ts';
import { PCW, closeOf, dayWords } from './picksClose.ts';
import {
  type MealAnswer,
  type MealCourse,
  type MealDish,
  type MealOption,
  type MealStart,
  type Screen,
  MW,
  PERSON,
  allergenList,
  containsLine,
  dishOf,
  isMealState,
  mealStart,
  nothingSafe,
  recordedOf,
  refusalOf,
  ruledOutBy,
  screensOf,
} from './mealStep.ts';
import { type Lang, LANGS } from './menuLibrary.ts';
import '../components/SettingsParts.css';
import './guest.css';
import './guestKitchen.css';
import './mealStep.css';

/** sc-3904's meal step on the guest's page (board MealStep, page e32): the way, then each choice, one question per screen, in the guest page's frames. */
export function MealStepPage() {
  const [params] = useSearchParams();
  const raw = params.get('state');
  const party = isPartyState(raw) ? raw : null;
  const state = isMealState(raw) ? raw : 'variant';
  const preview = party != null && (party === 'preview' || params.get('preview') === '1');
  const navigate = useNavigate();
  const from = params.get('from');
  const back = from?.startsWith('/demo/') === true ? from : MENU_WITH_PREVIEW;
  const closePreview = preview
    ? () => void navigate(`${back}${back.includes('?') ? '&' : '?'}told=preview`)
    : null;
  const format = params.get('format');
  const lang: Lang = LANGS.includes(format as Lang) ? (format as Lang) : 'en';
  const layout = layoutOf({
    small: useMatches(LAYOUT_MEDIA.small),
    phone: useMatches(LAYOUT_MEDIA.phone),
    wide: useMatches(LAYOUT_MEDIA.wide),
    desk: useMatches(LAYOUT_MEDIA.desk),
  });
  const summary = party == null ? (mealStart(state).summary ?? null) : null;
  const paused = summary?.paused === true;
  const visit = useMemo(() => startOf(paused ? 'paused' : null), [paused]);
  const words = useMemo(() => wordsFor('en'), []);
  const again = `/demo/guest/meal?state=${party ?? state}${preview ? '&preview=1' : ''}${lang === 'en' ? '' : `&format=${lang}`}`;

  return (
    <>
      <div className={`gp desk is-${layout}`} lang="en">
        <header className="gp-header">
          <img className="gp-lockup" src={lockupUrl} alt="Soirely" />
        </header>
        {closePreview != null && <PreviewBand onClose={closePreview} />}
        <main id="content" className={twoColumns(layout) ? 'gp-main is-two' : 'gp-main is-one'}>
          <div className="gp-columns">
            {paused && <PhaseNotice phase="paused" words={words} />}
            <Cover visit={visit} words={words} ended={false} />
            <div className="gp-under">
              {party != null ? (
                <MealParty
                  key={`${party}|${lang}|${preview}`}
                  first={partyStart(party)}
                  lang={lang}
                  preview={preview}
                  again={again}
                  onClosePreview={closePreview}
                />
              ) : summary != null ? (
                <>
                  {paused && <Closed visit={visit} words={words} onKitchen={() => undefined} />}
                  <Summary key={`${state}|${lang}`} first={summary} lang={lang} />
                </>
              ) : (
                <Flow key={`${state}|${lang}`} first={mealStart(state)} again={again} lang={lang} />
              )}
            </div>
          </div>
        </main>
      </div>
      <div className="demo-way-in gp-way-in">
        <Link className="link-button" to="/demo">
          Back to the demo
        </Link>
      </div>
    </>
  );
}

function Flow({ first, again, lang }: { first: MealStart; again: string; lang: Lang }) {
  const [answer, setAnswer] = useState<MealAnswer>(first.answer);
  const [at, setAt] = useState(first.at);
  const [pressed, setPressed] = useState(first.pressed);
  const [host, setHost] = useState(false);
  const focus = useRef<string | null>(first.pressed ? 'first' : null);
  const { course, allergies } = first;
  const screens = screensOf(course, answer);
  const screen: Screen = screens[Math.min(at, screens.length - 1)] ?? { kind: 'done' };
  const dish = course.set ? (course.dishes[0] ?? null) : dishOf(course, answer.dishId);
  const safe = dish == null || !nothingSafe(dish, allergies);
  const refusal = pressed ? refusalOf(screen, course, answer, at === 0) : null;

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

  function go(next: number) {
    setPressed(false);
    setAt(next);
    focus.current = 'ms-h';
  }

  function finish(how: MealAnswer['way'], needsHost = false) {
    setAnswer((was) => ({ ...was, way: how }));
    setHost(needsHost);
    setPressed(false);
    setAt(screensOf(course, answer).length - 1);
    focus.current = 'ms-done';
  }

  function next() {
    if (answer.way === 'kitchen' || answer.way === 'skipped') {
      finish(answer.way);
      return;
    }
    if (!safe) {
      finish(null, true);
      return;
    }
    if (refusalOf(screen, course, answer, at === 0) != null) {
      setPressed(true);
      focus.current = 'first';
      return;
    }
    go(at + 1);
  }

  function choose(change: (was: MealAnswer) => MealAnswer) {
    setAnswer((was) => change(was));
    setPressed(false);
  }

  const head = (
    <div className="gk-head">
      <p className="gk-label ms-who">
        {[PERSON, course.name, MW.of(first.n, first.total)].join(' · ')}
      </p>
      {first.closes && (
        <p id="ms-close" className="gk-text is-quiet ms-close">
          <Glyph name="clock" size={15} weight={2.4} />
          {PCW.line(dayWords(closeOf('main', GUEST_PICKS).on, lang))}
        </p>
      )}
    </div>
  );

  if (screen.kind === 'done') {
    return (
      <section className="gk ms" aria-labelledby="ms-done">
        {head}
        <p id="ms-done" className="ms-done" tabIndex={-1} role="status">
          {recordedOf(course, answer, host)}
        </p>
        <Link className="gp-text is-ink" to={again} reloadDocument>
          <Glyph name="undo" size={16} weight={2.2} />
          <span>{MW.again}</span>
        </Link>
      </section>
    );
  }

  const firstOfSet = course.set && at === 0;

  return (
    <section className="gk ms" aria-labelledby="ms-h">
      {at > 0 && (
        <TextAction
          ink
          icon={<Glyph name="back" size={18} weight={2.2} />}
          onClick={() => go(at - 1)}
        >
          {MW.back}
        </TextAction>
      )}
      {head}
      {screen.kind === 'dish' ? (
        <DishScreen
          course={course}
          answer={answer}
          lang={lang}
          refusal={refusal}
          closeId={first.closes ? 'ms-close' : undefined}
          onPick={(id) => choose((was) => ({ ...was, dishId: id, way: 'chosen' }))}
        />
      ) : (
        <Question
          screen={screen}
          course={course}
          dish={dish as MealDish}
          answer={answer}
          allergies={allergies}
          lang={lang}
          firstOfSet={firstOfSet}
          closes={first.closes}
          safe={safe}
          refusal={refusal}
          onAnswer={choose}
        />
      )}
      <div className="gk-actions">
        <Filled onClick={next}>{MW.next}</Filled>
      </div>
    </section>
  );
}

function Question({
  screen,
  course,
  dish,
  answer,
  allergies,
  lang,
  firstOfSet,
  closes,
  safe,
  refusal,
  onAnswer,
}: {
  screen: Exclude<Screen, { kind: 'dish' | 'done' }>;
  course: MealCourse;
  dish: MealDish;
  answer: MealAnswer;
  allergies: MealStart['allergies'];
  lang: Lang;
  firstOfSet: boolean;
  closes: boolean;
  safe: boolean;
  refusal: string | null;
  onAnswer: (change: (was: MealAnswer) => MealAnswer) => void;
}) {
  const choice =
    screen.kind === 'choice'
      ? (dish.choices.find((one) => one.id === screen.choiceId) ?? null)
      : null;
  const options: readonly MealOption[] = choice?.options ?? dish.ways;
  const many = choice != null && choice.pick > 1;
  const picked = choice == null ? null : answer.picks[choice.id];
  const isOn = (id: string) =>
    answer.way === 'chosen' &&
    (choice == null ? answer.wayId === id : Array.isArray(picked) && picked.includes(id));
  const way = dish.ways.find((one) => one.id === answer.wayId) ?? null;
  const ruled = options.map((one) => ruledOutBy(one.contains, allergies));
  const anyOut = safe && ruled.some((one) => one.length > 0);
  const title =
    choice == null ? MW.wayQuestion(dish.name, dish.ways) : MW.question(dish.name, choice.question);

  function pick(id: string) {
    onAnswer((was) => {
      if (choice == null) return { ...was, way: 'chosen', wayId: id };
      const had = was.picks[choice.id];
      const list = Array.isArray(had) ? had : [];
      const next = many
        ? list.includes(id)
          ? list.filter((one) => one !== id)
          : [...list, id]
        : [id];

      return { ...was, way: 'chosen', picks: { ...was.picks, [choice.id]: next } };
    });
  }

  return (
    <>
      {firstOfSet && (
        <div className="ms-dish">
          <p className="ms-option-name">{dish.name}</p>
          <p className="ms-quiet">{dish.desc}</p>
          <p className="ms-contains">{containsLine(dish.contains, lang)}</p>
          {!safe && ruledOutBy(dish.contains, allergies).length > 0 && (
            <p className="ms-out-line">
              <AllergyMark />
              {MW.allergicTo(PERSON, allergenList(ruledOutBy(dish.contains, allergies), lang))}
            </p>
          )}
        </div>
      )}
      <fieldset
        className="ms-set"
        aria-describedby={
          [
            refusal != null && 'ms-refused',
            !safe && 'ms-unsafe',
            anyOut && 'ms-host',
            closes && 'ms-close',
          ]
            .filter(Boolean)
            .join(' ') || undefined
        }
      >
        <legend className="ms-legend">
          <h2 id="ms-h" className="gp-h2 gk-h2" tabIndex={-1}>
            {title}
          </h2>
          {choice != null && <span className="gk-text">{MW.pickExactly(choice.pick)}</span>}
          {choice != null && dish.ways.length >= 2 && (
            <span className="gk-text is-quiet">
              {way == null ? MW.sameForEvery : MW.sameForEither(dish.name, way.name)}
            </span>
          )}
        </legend>
        {!safe && (
          <Notice kind="broken" alert={false} className="ms-unsafe">
            <span id="ms-unsafe">{MW.nothingSafe(PERSON)}</span>
          </Notice>
        )}
        {refusal != null && <Refused words={refusal} />}
        <div className={refusal == null ? 'ms-options' : 'ms-options is-wrong'}>
          {options.map((one, index) => {
            const out = !safe || (ruled[index]?.length ?? 0) > 0;

            return (
              <label key={one.id} className={out ? 'ms-option is-out' : 'ms-option'}>
                <input
                  type={many ? 'checkbox' : 'radio'}
                  className={many ? 'ms-box' : 'desk-radio'}
                  name={`ms-${screen.kind === 'choice' ? screen.choiceId : 'way'}`}
                  checked={isOn(one.id)}
                  disabled={out}
                  onChange={() => pick(one.id)}
                />
                <span className="ms-option-words">
                  <span className="ms-option-name">{one.name}</span>
                  <span className="ms-contains">{containsLine(one.contains, lang)}</span>
                  {safe && (ruled[index]?.length ?? 0) > 0 && (
                    <span className="ms-out-line">
                      <AllergyMark />
                      {MW.allergicTo(PERSON, allergenList(ruled[index] ?? [], lang))}
                    </span>
                  )}
                </span>
              </label>
            );
          })}
          {choice != null && !choice.required && (
            <>
              <hr className="ms-rule" />
              <label className={safe ? 'ms-option is-plain' : 'ms-option is-plain is-out'}>
                <input
                  type="radio"
                  className="desk-radio"
                  name={`ms-${choice.id}-none`}
                  checked={answer.way === 'chosen' && picked === 'none'}
                  disabled={!safe}
                  onChange={() =>
                    onAnswer((was) => ({
                      ...was,
                      way: 'chosen',
                      picks: { ...was.picks, [choice.id]: 'none' },
                    }))
                  }
                />
                <span className="ms-option-name">{MW.noneForMe}</span>
              </label>
            </>
          )}
          {firstOfSet && (
            <>
              <hr className="ms-rule" />
              {safe && (
                <label className="ms-option is-plain">
                  <input
                    type="radio"
                    className="desk-radio"
                    name="ms-course-way"
                    checked={answer.way === 'kitchen'}
                    onChange={() => onAnswer((was) => ({ ...was, way: 'kitchen' }))}
                  />
                  <span className="ms-option-name">{MW.letKitchen}</span>
                </label>
              )}
              {course.skip && (
                <label className="ms-option is-plain">
                  <input
                    type="radio"
                    className="desk-radio"
                    name="ms-course-way"
                    checked={answer.way === 'skipped'}
                    onChange={() => onAnswer((was) => ({ ...was, way: 'skipped' }))}
                  />
                  <span className="ms-option-name">{MW.noCourse(course.name)}</span>
                </label>
              )}
            </>
          )}
        </div>
        {anyOut && (
          <p id="ms-host" className="gk-text is-quiet">
            {MW.hostLine(PERSON)}
          </p>
        )}
      </fieldset>
    </>
  );
}
