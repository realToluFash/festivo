import type { MealCourse, MealDish } from '@soirely/api-client';
import { listFormat } from '@soirely/domain';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Glyph } from '../../components/Glyph.tsx';
import { currentLocale } from '../../i18n/index.ts';
import { offButton } from '../../offButton.ts';
import { Filled, Notice, TextAction, dayOf } from './GuestParts.tsx';
import {
  type Cleared,
  type Eater,
  type Plate,
  type Plates,
  type Refusal,
  type Ruled,
  type Step,
  dishRuled,
  fourteen,
  keyOf,
  markOf,
  nothingSafe,
  oneCloseDay,
  plateDish,
  against,
  changeFocus,
} from './meals.ts';
import '../../components/SettingsParts.css';
import './meals.css';

type Translate = ReturnType<typeof useTranslation>['t'];

const lower = (words: string) => words.toLocaleLowerCase(currentLocale());

function allergenList(codes: readonly string[], t: Translate): string {
  return new Intl.ListFormat(currentLocale(), { type: 'unit', style: 'short' }).format(
    fourteen(codes).map((code) => lower(t(`guestNeeds.allergen.${code}`))),
  );
}

function reasonOf(ruled: Ruled, eater: Eater, t: Translate): string | null {
  if (ruled == null) return null;
  const name = eater.name ?? '';
  if (ruled.kind === 'notStated')
    return eater.you ? t('guestMeal.notStatedYou') : t('guestMeal.notStatedName', { name });
  const list = allergenList(ruled.codes, t);

  return eater.you
    ? t('guestMeal.allergicYou', { list })
    : t('guestMeal.allergicName', { name, list });
}

function refusalWords(refusal: Refusal, course: MealCourse, eater: Eater, t: Translate) {
  if (refusal == null) return null;
  const name = lower(course.name);
  switch (refusal.kind) {
    case 'course':
      return eater.you
        ? t('guestMeal.chooseYou', { course: name })
        : t('guestMeal.chooseName', { course: name, name: eater.name ?? '' });
    case 'one':
      return t('guestMeal.chooseOne');
    case 'oneOrNone':
      return t('guestMeal.pickOrNone');
    case 'count':
      return t('guestMeal.wrongCount', { pick: refusal.pick, had: refusal.had });
  }
}

function AllergyMark() {
  const { t } = useTranslation();

  return (
    <span className="ms-allergy">
      <Glyph name="alert" size={13} weight={2.4} />
      {t('guestMeal.allergy')}
    </span>
  );
}

function ContainsLine({ allergens }: { allergens: readonly string[] | null }) {
  const { t } = useTranslation();
  const kind = allergens == null ? 'unstated' : allergens.length === 0 ? 'none' : 'contains';

  return (
    <span className="pc-contains">
      <span className={`pc-mark is-${kind}`} aria-hidden="true">
        {kind === 'contains' ? '!' : kind === 'none' ? '0' : '?'}
      </span>
      <span>
        {allergens == null
          ? t('menuLibrary.notStated')
          : allergens.length === 0
            ? t('menuLibrary.containsNone')
            : t('menuLibrary.contains', { names: allergenList(allergens, t) })}
      </span>
    </span>
  );
}

function Tags({ diets }: { diets: readonly string[] }) {
  const { t } = useTranslation();
  if (diets.length === 0) return null;

  return (
    <span className="pc-tags">
      <span className="pc-tags-label">{t('guestMeal.suitableFor')}</span>
      {diets.map((diet) => (
        <span key={diet} className="pc-tag">
          {t(`guestNeeds.dietName.${diet}`)}
        </span>
      ))}
    </span>
  );
}

function Option({
  name,
  type,
  group,
  checked,
  out,
  reason,
  onPick,
  children,
}: {
  name: string;
  type: 'radio' | 'checkbox';
  group: string;
  checked: boolean;
  out: boolean;
  reason: string | null;
  onPick: () => void;
  children?: ReactNode;
}) {
  return (
    <label className={out ? 'ms-option is-out' : 'ms-option'}>
      <input
        type={type}
        className={type === 'radio' ? 'desk-radio' : 'ms-box'}
        name={group}
        checked={checked}
        disabled={out}
        onChange={onPick}
      />
      <span className="ms-option-words">
        <span className="ms-option-name">{name}</span>
        {children}
        {reason != null && (
          <span className="ms-out-line">
            <AllergyMark />
            {reason}
          </span>
        )}
      </span>
    </label>
  );
}

function Plain({
  group,
  checked,
  off = false,
  onPick,
  children,
}: {
  group: string;
  checked: boolean;
  off?: boolean;
  onPick: () => void;
  children: string;
}) {
  return (
    <label className={off ? 'ms-option is-plain is-out' : 'ms-option is-plain'}>
      <input
        type="radio"
        className="desk-radio"
        name={group}
        checked={checked}
        disabled={off}
        onChange={onPick}
      />
      <span className="ms-option-name">{children}</span>
    </label>
  );
}

function dishContains(dish: MealDish): readonly string[] | null {
  if (dish.variants.length === 1) return dish.variants[0]?.allergens ?? null;

  return dish.allergens;
}

/** One question of the meal step (sc-3907): a person, a course, and its dish, its way or one of its choices. */
export function MealScreen({
  eater,
  course,
  n,
  total,
  step,
  first,
  plate,
  allergies,
  other,
  cleared,
  refusal,
  timeZone,
  onPlate,
  onBack,
  onNext,
}: {
  eater: Eater;
  course: MealCourse;
  n: number;
  total: number;
  step: Step;
  first: boolean;
  plate: Plate | null;
  allergies: readonly string[];
  other: string | null;
  cleared: Cleared | null;
  refusal: Refusal;
  timeZone: string;
  onPlate: (plate: Plate) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const { t } = useTranslation();
  const who = eater.you ? t('guestMeal.forYou') : t('guestMeal.forName', { name: eater.name });
  const safe = !nothingSafe(course, allergies);
  const dish = plateDish(course, plate);
  const said = refusalWords(refusal, course, eater, t);
  const chosen = plate?.kind === 'chosen' ? plate : null;
  const base: Plate = chosen ?? {
    kind: 'chosen',
    dish: dish?.id ?? null,
    variant: null,
    options: {},
  };
  const choice = step.kind === 'choice' ? step.choice : null;

  const dishes =
    step.kind === 'dish'
      ? course.dishes.map((one) => ({
          id: one.id,
          name: one.name,
          desc: one.description,
          diets: one.diets,
          contains: dishContains(one),
          ways: one.variants.length >= 2,
          reason: reasonOf(dishRuled(one, allergies), eater, t),
          on: chosen?.dish === one.id,
          pick: () =>
            onPlate({
              kind: 'chosen',
              dish: one.id,
              variant: one.variants.length === 1 ? (one.variants[0]?.id ?? null) : null,
              options: {},
            }),
        }))
      : null;
  const ways =
    step.kind === 'way' && dish != null
      ? dish.variants.map((one) => ({
          id: one.id,
          name: one.name,
          diets: one.diets,
          contains: one.allergens,
          out: !safe || against(one.allergens, allergies) != null,
          reason: safe ? reasonOf(against(one.allergens, allergies), eater, t) : null,
          on: chosen?.variant === one.id,
          pick: () => onPlate({ ...base, variant: one.id }),
        }))
      : null;
  const many = choice != null && choice.pick > 1;
  const picked = choice == null ? [] : (chosen?.options[choice.id] ?? null);
  const options =
    choice != null
      ? choice.options.map((one) => ({
          id: one.id,
          name: one.name,
          contains: one.allergens,
          out: !safe || against(one.allergens, allergies) != null,
          reason: safe ? reasonOf(against(one.allergens, allergies), eater, t) : null,
          on: picked?.includes(one.id) === true,
          pick: () => {
            const had = picked ?? [];
            const next = many
              ? had.includes(one.id)
                ? had.filter((id) => id !== one.id)
                : [...had, one.id]
              : [one.id];
            onPlate({ ...base, options: { ...base.options, [choice.id]: next } });
          },
        }))
      : null;
  const anyOut =
    safe &&
    [...(dishes ?? []), ...(ways ?? []), ...(options ?? [])].some((one) => one.reason != null);
  const describedBy = [
    said != null && 'ms-refused',
    other != null && 'pc-other',
    cleared != null && 'pc-cleared',
    !safe && first && 'ms-unsafe',
    anyOut && 'ms-host',
    'ms-close',
  ]
    .filter(Boolean)
    .join(' ');
  const title =
    step.kind === 'dish'
      ? t('guestMeal.which', { course: lower(course.name) })
      : step.kind === 'way'
        ? t('guestMeal.wayQuestion', {
            dish: dish?.name ?? '',
            ways: listFormat(currentLocale(), { type: 'disjunction' }).format(
              (dish?.variants ?? []).map((one) => one.name),
            ),
          })
        : t('guestMeal.choiceQuestion', { dish: dish?.name ?? '', question: choice?.question });
  const name = eater.name ?? '';
  const closeDate = dayOf(course.picksClose.at, timeZone);

  return (
    <section className="gk ms" aria-labelledby="ms-h">
      <TextAction ink icon={<Glyph name="back" size={18} weight={2.2} />} onClick={onBack}>
        {t('guest.back')}
      </TextAction>
      <div className="gk-head">
        <p className="gk-label ms-who" aria-hidden="true">
          {t('guestMeal.progress', { who, course: course.name, n, total })}
        </p>
        <p id="ms-close" className="gk-text is-quiet ms-close">
          <Glyph name="clock" size={15} weight={2.4} />
          {t('guestMeal.picksClose', { date: closeDate })}
        </p>
      </div>
      {course.answer === 'same' && first && dish != null && (
        <div className="ms-dish">
          <p className="ms-option-name">{dish.name}</p>
          {dish.description != null && <p className="ms-quiet">{dish.description}</p>}
        </div>
      )}
      <fieldset className="ms-set" aria-describedby={describedBy}>
        <legend className="ms-legend">
          <h2 id="ms-h" className="gp-h2 gk-h2" tabIndex={-1} data-focus="mealHead">
            <span className="visually-hidden">
              {`${
                eater.you
                  ? t('guestMeal.legendYou', { course: course.name, n, total })
                  : t('guestMeal.legendName', { name, course: course.name, n, total })
              } `}
            </span>
            {title}
          </h2>
          {choice != null && (
            <span className="gk-text">{t('guestMeal.pickExactly', { count: choice.pick })}</span>
          )}
          {choice != null && (dish?.variants.length ?? 0) >= 2 && (
            <span className="gk-text is-quiet">{t('guestMeal.sameForEvery')}</span>
          )}
        </legend>
        {other != null && (
          <p id="pc-other" className="pc-inset">
            <AllergyMark />
            <span>
              {eater.you
                ? t('guestMeal.otherYou', { allergy: lower(other) })
                : t('guestMeal.otherName', { name, allergy: lower(other) })}
            </span>
          </p>
        )}
        {cleared != null && (
          <p id="pc-cleared" className="pc-inset">
            <AllergyMark />
            <span>
              {eater.you
                ? t('guestMeal.clearedYou', {
                    dish: cleared.dish,
                    list: allergenList(cleared.codes, t),
                  })
                : t('guestMeal.clearedName', {
                    name,
                    dish: cleared.dish,
                    list: allergenList(cleared.codes, t),
                  })}
            </span>
          </p>
        )}
        {!safe && first && (
          <Notice kind="broken" alert={false}>
            <span id="ms-unsafe">
              {eater.you ? t('guestMeal.nothingSafeYou') : t('guestMeal.nothingSafeName', { name })}
            </span>
          </Notice>
        )}
        {said != null && (
          <p id="ms-refused" className="desk-error ms-refused" role="alert">
            <Glyph name="alert" size={16} weight={2.2} />
            {said}
          </p>
        )}
        <div className={said == null ? 'ms-options' : 'ms-options is-wrong'}>
          {dishes?.map((one) => (
            <Option
              key={one.id}
              name={one.name}
              type="radio"
              group="ms-answer"
              checked={one.on}
              out={one.reason != null}
              reason={one.reason}
              onPick={one.pick}
            >
              {one.desc != null && <span className="ms-quiet">{one.desc}</span>}
              <Tags diets={one.diets} />
              {one.ways ? (
                <span className="ms-quiet">{t('guestMeal.pickWayNext')}</span>
              ) : (
                <ContainsLine allergens={one.contains} />
              )}
            </Option>
          ))}
          {ways?.map((one) => (
            <Option
              key={one.id}
              name={one.name}
              type="radio"
              group="ms-answer"
              checked={one.on}
              out={one.out}
              reason={one.reason}
              onPick={one.pick}
            >
              <Tags diets={one.diets} />
              <ContainsLine allergens={one.contains} />
            </Option>
          ))}
          {options?.map((one) => (
            <Option
              key={one.id}
              name={one.name}
              type={many ? 'checkbox' : 'radio'}
              group="ms-answer"
              checked={one.on}
              out={one.out}
              reason={one.reason}
              onPick={one.pick}
            >
              <ContainsLine allergens={one.contains} />
            </Option>
          ))}
          {choice != null && !choice.required && (
            <>
              <hr className="ms-rule" />
              <Plain
                group="ms-none"
                checked={picked != null && picked.length === 0 && chosen != null}
                off={!safe}
                onPick={() => onPlate({ ...base, options: { ...base.options, [choice.id]: [] } })}
              >
                {t('guestMeal.noneForMe')}
              </Plain>
            </>
          )}
          {first && (safe || course.skippable) && (
            <>
              <hr className="ms-rule" />
              {safe && (
                <Plain
                  group="ms-answer"
                  checked={plate?.kind === 'chefsChoice'}
                  onPick={() => onPlate({ ...blankOf('chefsChoice') })}
                >
                  {t('guestMeal.letKitchen')}
                </Plain>
              )}
              {course.skippable && (
                <Plain
                  group="ms-answer"
                  checked={plate?.kind === 'skipped'}
                  onPick={() => onPlate({ ...blankOf('skipped') })}
                >
                  {t('guestMeal.noCourse', { course: lower(course.name) })}
                </Plain>
              )}
            </>
          )}
        </div>
        {anyOut && (
          <p id="ms-host" className="gk-text is-quiet">
            {eater.you ? t('guestMeal.hostLineYou') : t('guestMeal.hostLineName', { name })}
          </p>
        )}
      </fieldset>
      <div className="gk-actions">
        <Filled busy={false} focus="mealNext" onClick={onNext}>
          {t('guestKitchen.next')}
        </Filled>
      </div>
    </section>
  );
}

const blankOf = (kind: 'chefsChoice' | 'skipped'): Plate => ({
  kind,
  dish: null,
  variant: null,
  options: {},
});

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

/** A dish with its way and choices under it ("Fish · Plantain"), or the shape for chef's choice, skipped and needs the host. */
function Pick({ plate, course }: { plate: Plate | undefined; course: MealCourse }) {
  const { t } = useTranslation();
  if (plate == null || plate.kind === 'defaulted')
    return <p className="mx-pick">{t('guestMeal.notChosen')}</p>;
  const dish = plateDish(course, plate);
  if (plate.kind === 'chosen' || (plate.kind === 'needsHost' && plate.dish != null)) {
    const way = dish?.variants.find((one) => one.id === plate.variant);
    const parts = [
      ...((dish?.variants.length ?? 0) >= 2 && way != null ? [way.name] : []),
      ...(dish?.choices ?? []).flatMap((choice) =>
        choice.options
          .filter((one) => (plate.options[choice.id] ?? []).includes(one.id))
          .map((one) => one.name),
      ),
    ];

    return (
      <>
        <p className="mx-pick">{dish?.name ?? t('guestMeal.notChosen')}</p>
        {parts.length > 0 && <p className="gk-text is-quiet">{parts.join(' · ')}</p>}
      </>
    );
  }
  const shape =
    plate.kind === 'chefsChoice'
      ? { ring: 'is-kitchen', mark: <ForkKnife />, words: t('guestMeal.kitchenChooses') }
      : plate.kind === 'skipped'
        ? {
            ring: 'is-skipped',
            mark: <Glyph name="minus" size={13} weight={2.6} />,
            words: t('guestMeal.skipped', { course: lower(course.name) }),
          }
        : {
            ring: 'is-host',
            mark: <Glyph name="message" size={13} weight={2.4} />,
            words: t('guestMeal.hostInTouch'),
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

/** Check your meal picks, inside Check and send, and Your meal picks on coming back: a card per person, a row per course. */
export function MealCards({
  eaters,
  courses,
  plates,
  allergies,
  timeZone,
  busy,
  head,
  hosts,
  pending,
  refused,
  onChange,
}: {
  eaters: readonly Eater[];
  courses: readonly MealCourse[];
  plates: Plates;
  allergies: (key: string) => readonly string[];
  timeZone: string;
  busy: boolean;
  head: 'check' | 'back' | null;
  hosts: string;
  pending: (key: string) => boolean;
  refused: ReadonlySet<string>;
  onChange: (key: string) => void;
}) {
  const { t } = useTranslation();
  const day = oneCloseDay(courses, (at) => dayOf(at, timeZone));
  const single = day != null;

  return (
    <div className="pc-meals">
      {head === 'check' && (
        <div className="pc-meals-head">
          <h3 className="pc-h3">{t('guestMeal.checkMeals')}</h3>
          <p className="gk-text">{t('guestMeal.hostsGet', { hosts })}</p>
          {single && <p className="gk-text is-quiet">{t('guestMeal.picksClose', { date: day })}</p>}
        </div>
      )}
      {eaters.map((eater) => (
        <section key={eater.key} className="pc-card" aria-labelledby={`pc-card-${eater.key}`}>
          <h3 id={`pc-card-${eater.key}`} className="pc-h3">
            {eater.you ? t('guestMeal.yourMeals') : t('guestMeal.theirMeals', { name: eater.name })}
          </h3>
          <ul className="mx-rows">
            {courses.map((course) => {
              const key = keyOf(eater.key, course.id);
              const shut = course.picksClose.closed || refused.has(course.id);
              const mark = reasonOf(markOf(course, plates[key], allergies(eater.key)), eater, t);
              const date = dayOf(course.picksClose.at, timeZone);

              return (
                <li key={key} className={shut ? 'mx-row pc-row is-closed' : 'mx-row pc-row'}>
                  <div className="mx-words">
                    <p className="mx-course">{course.name}</p>
                    <Pick plate={plates[key]} course={course} />
                    {pending(key) && !shut && (
                      <p className="mx-pending">{t('guestMeal.notSent')}</p>
                    )}
                    {refused.has(course.id) && (
                      <p
                        className="desk-error"
                        role="alert"
                        tabIndex={-1}
                        data-focus={`refused-${course.id}`}
                      >
                        <Glyph name="alert" size={15} weight={2.2} />
                        {t('guestMeal.refusedClosed', { course: course.name, date })}
                      </p>
                    )}
                    {!single && (
                      <p className="mx-close">
                        <Glyph name={shut ? 'lock' : 'clock'} size={15} weight={2.4} />
                        {shut
                          ? t('guestMeal.picksClosed', { date })
                          : t('guestMeal.picksClose', { date })}
                      </p>
                    )}
                    {mark != null && (
                      <p className="ms-out-line">
                        <AllergyMark />
                        <span id={`meal-reason-${key.replace('|', '-')}`}>{mark}</span>
                      </p>
                    )}
                    {mark != null && shut && (
                      <p className="gk-text">{t('guestMeal.hostInTouchLine')}</p>
                    )}
                  </div>
                  {!shut && (
                    <button
                      type="button"
                      className="gp-text is-ink"
                      data-focus={changeFocus(key)}
                      aria-label={
                        eater.you
                          ? t('guestMeal.changeYou', { course: lower(course.name) })
                          : t('guestMeal.changeName', {
                              course: lower(course.name),
                              name: eater.name,
                            })
                      }
                      aria-describedby={
                        mark == null ? undefined : `meal-reason-${key.replace('|', '-')}`
                      }
                      {...offButton(busy, { dim: false })}
                      onClick={() => onChange(key)}
                    >
                      <span>{t('guest.changeShort')}</span>
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** The refusal above Send when an open pick holds an allergen, counted. */
export function MarkedLine({ count }: { count: number }) {
  const { t } = useTranslation();

  return (
    <p className="desk-error ms-refused pc-marked" role="alert">
      <Glyph name="alert" size={16} weight={2.2} />
      {t('guestMeal.marked', { count })}
    </p>
  );
}

/** Your meal picks, on coming back (sc-3907): the saved picks, each open one changeable until its course closes, and Send my changes. */
export function MealsSaved({
  told,
  marked,
  busy,
  savedUntil,
  kitchen,
  closed,
  hosts,
  onSend,
  children,
}: {
  told: 'marked' | 'nothing' | 'saved' | 'failed' | null;
  marked: number;
  busy: boolean;
  /** The one day every course closes on, while all are open. */
  savedUntil: string | null;
  /** For the kitchen, above the picks, while answers are open. */
  kitchen: ReactNode;
  /** Every course closed: the rows are read-only and there is nothing to send. */
  closed: boolean;
  hosts: string;
  onSend: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <section className="gk ms pc-check" aria-labelledby="pc-h">
      <h2 id="pc-h" className="gp-h2 gk-h2" tabIndex={-1} data-focus="mealsSaved">
        {t('guestMeal.yourPicks')}
      </h2>
      {savedUntil != null && (
        <p className="pc-saved">
          <Glyph name="tick" size={16} weight={2.6} />
          <span>{t('guestMeal.savedUntil', { date: savedUntil })}</span>
        </p>
      )}
      {kitchen != null && <div className="gk-rows">{kitchen}</div>}
      {children}
      {told === 'marked' && marked > 0 && <MarkedLine count={marked} />}
      {told === 'failed' && <Notice kind="broken">{t('guestMeal.notSaved')}</Notice>}
      <div className="mx-told" role="status">
        {told === 'nothing' && <p>{t('guestMeal.nothingToSend')}</p>}
        {told === 'saved' && <p>{t('guestMeal.changesSaved')}</p>}
      </div>
      {closed ? (
        <p className="gk-text">{t('guestMeal.askHosts', { hosts })}</p>
      ) : (
        <div className="gk-actions">
          <Filled busy={busy} focus="mealsSend" onClick={onSend}>
            {t('guestMeal.sendChanges')}
          </Filled>
        </div>
      )}
    </section>
  );
}
