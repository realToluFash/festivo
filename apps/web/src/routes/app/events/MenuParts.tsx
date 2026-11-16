import {
  type Dish,
  type DishDiet,
  MENU_COURSE_NAME_MAXIMUM,
  type MenuAnswer,
  type MenuCourse,
  type MenuDish,
  VARIANTS_PER_DISH_MAXIMUM,
} from '@soirely/api-client';
import {
  type DishForm,
  type DishProblems,
  type MoneyLanguage,
  guestsPickTheWay,
  shownDishes,
} from '@soirely/domain';
import { useTranslation } from 'react-i18next';

import { Switch } from '../../../components/GeneralParts.tsx';
import { Glyph } from '../../../components/Glyph.tsx';
import { HintButton } from '../../../components/HintButton.tsx';
import { ActionGlyph, ContainsMark, DishFields, Wrong } from '../menu/DishParts.tsx';
import {
  AddVariantButton,
  NameDescFields,
  RowLine,
  type ShownVariant,
  type VariantAsk,
  VariantInsets,
} from '../menu/VariantParts.tsx';
import { shownVariants } from '../menu/variants.ts';
import { describedBy } from './eventFieldOrder.ts';
import {
  type CourseForm,
  type CourseProblems,
  canSame,
  courseLength,
  isReady,
  onCourse,
} from './menuArea.ts';

export interface VariantHandlers {
  prices: boolean;
  language: MoneyLanguage;
  ask: VariantAsk | null;
  addRefused: { dishId: string; outcome: 'limit' | 'picked' } | null;
  lit: string | null;
  onAdd: (dish: MenuDish) => void;
  onEdit: (dish: MenuDish, variant: ShownVariant) => void;
  onRemove: (dish: MenuDish, variant: ShownVariant) => void;
  onKeep: (variant: ShownVariant) => void;
  onConfirm: (dish: MenuDish, variant: ShownVariant) => void;
}

export interface Told {
  words: string;
  /** A second line under it, beside the amber ring: who picked a dish and has an allergen just added. */
  more?: string | null;
  tone?: 'done' | 'fail';
}

/** The page's one polite status line; focus moves here after a save, so a screen reader hears it once. */
export function Said({ said }: { said: Told | null }) {
  return (
    <div id="mc-said" className="mc-said" role="status" tabIndex={-1}>
      {said != null && (
        <>
          <p className={said.tone === 'fail' ? 'mc-said-line is-fail' : 'mc-said-line'}>
            <Glyph name={said.tone === 'fail' ? 'alert' : 'tick'} size={17} weight={2.6} />
            {said.words}
          </p>
          {said.more != null && (
            <p className="mc-said-more">
              <span className="mc-ring is-warn" aria-hidden="true">
                !
              </span>
              {said.more}
            </p>
          )}
        </>
      )}
    </div>
  );
}

export function LimitLine({
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

function Refused({ words }: { words: string }) {
  return (
    <p className="mc-refused" role="status">
      <span className="mc-ring is-warn" aria-hidden="true">
        !
      </span>
      {words}
    </p>
  );
}

function AskFailed({ id, words }: { id: string; words: string | null }) {
  if (words == null) return null;

  return (
    <p id={`mc-ask-failed-${id}`} className="mn-failed" role="alert" tabIndex={-1}>
      <Glyph name="alert" size={16} weight={2.2} />
      {words}
    </p>
  );
}

function Tags({ dish }: { dish: { name: string; diets: readonly DishDiet[] } }) {
  const { t } = useTranslation();
  if (dish.diets.length === 0) return null;

  return (
    <ul className="lib-tags" aria-label={t('menuLibrary.tagsFor', { name: dish.name })}>
      {dish.diets.map((diet) => (
        <li key={diet} className="lib-tag">
          {t(`guestNeeds.dietName.${diet}`)}
        </li>
      ))}
    </ul>
  );
}

export function CourseCard({
  course,
  index,
  all,
  manage,
  lit,
  litDish,
  asking,
  askFailed,
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
}: {
  course: MenuCourse;
  index: number;
  all: number;
  manage: boolean;
  lit: boolean;
  litDish: string | null;
  asking: 'course' | string | null;
  askFailed: string | null;
  refused: 'course' | string | null;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDrop: () => void;
  onMove: (by: -1 | 1) => void;
  onEdit: () => void;
  onAskDelete: () => void;
  onDelete: () => void;
  onKeep: (back: string) => void;
  onAnswer: (answer: MenuAnswer) => void;
  onSkip: (skip: boolean) => void;
  onAddDish: () => void;
  onEditDish: (dish: MenuDish) => void;
  onAskRemove: (dish: MenuDish) => void;
  onRemove: (dish: MenuDish) => void;
  variants: VariantHandlers;
}) {
  const { t, i18n } = useTranslation();
  const ready = isReady(course);
  const pickTheWay =
    course.answer === 'same' && guestsPickTheWay(course.dishes)
      ? t('dishVariants.guestsPickTheWay', { dish: course.dishes[0]?.name ?? '' })
      : null;
  const sameOk = canSame(course);
  const name = course.name;
  const line =
    course.servedAt == null
      ? t('eventMenu.courseOf', { n: index + 1, count: all })
      : t('eventMenu.courseServed', { n: index + 1, count: all, time: course.servedAt });

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
            aria-label={t('eventMenu.dragAria', { name })}
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
          <p className="mn-eyebrow">{line}</p>
          <h2 id={`mc-c-${course.id}`}>{name}</h2>
          <p className={ready ? 'mc-state is-ready' : 'mc-state is-empty'}>
            <span className={ready ? 'mc-ring is-ready' : 'mc-ring is-empty'} aria-hidden="true">
              {ready && <Glyph name="tick" size={12} weight={3} />}
            </span>
            {ready ? t('eventMenu.readyTag') : t('eventMenu.emptyTag')}
          </p>
        </div>
        {manage && (
          <div
            className="lib-acts mc-acts"
            role="group"
            aria-label={t('eventMenu.actionsFor', { name })}
          >
            <HintButton
              id={`mc-up-${course.id}`}
              label={t('eventMenu.moveUp', { name })}
              hint={t('eventMenu.moveUpHint')}
              className="lib-act"
              disabled={index === 0}
              onClick={() => onMove(-1)}
            >
              <Glyph name="chevup" size={20} weight={2} />
            </HintButton>
            <HintButton
              id={`mc-down-${course.id}`}
              label={t('eventMenu.moveDown', { name })}
              hint={t('eventMenu.moveDownHint')}
              className="lib-act"
              disabled={index === all - 1}
              onClick={() => onMove(1)}
            >
              <Glyph name="chevdown" size={20} weight={2} />
            </HintButton>
            <HintButton
              id={`mc-edit-${course.id}`}
              label={t('eventMenu.editAria', { name })}
              hint={t('eventMenu.editHint')}
              className="lib-act"
              onClick={onEdit}
            >
              <ActionGlyph icon="edit" />
            </HintButton>
            <HintButton
              id={`mc-delete-${course.id}`}
              label={t('eventMenu.deleteAria', { name })}
              hint={t('eventMenu.deleteHint')}
              className="lib-act"
              onClick={onAskDelete}
            >
              <ActionGlyph icon="bin" />
            </HintButton>
          </div>
        )}
      </div>
      {refused === 'course' && <Refused words={t('eventMenu.coursePicked')} />}
      {asking === 'course' && (
        <div className="mn-ask">
          <p id={`mc-ask-${course.id}`} tabIndex={-1}>
            {course.dishes.length === 0
              ? t('eventMenu.deleteAskNone', { course: name })
              : t('eventMenu.deleteAsk', { course: name, count: course.dishes.length })}
          </p>
          <div className="mn-ask-acts">
            <button
              type="button"
              className="desk-text"
              onClick={() => onKeep(`mc-delete-${course.id}`)}
            >
              {t('eventMenu.keepIt')}
            </button>
            <button type="button" className="gs-pill is-secondary" onClick={onDelete}>
              {t('eventMenu.deleteCourse')}
            </button>
          </div>
          <AskFailed id={course.id} words={askFailed} />
        </div>
      )}
      {course.dishes.length === 0 ? (
        <p className="mc-no-dishes">{t('eventMenu.emptyCourse')}</p>
      ) : (
        <ul className="mn-dishes">
          {course.dishes.map((dish) => (
            <DishRow
              key={dish.id}
              dish={dish}
              course={course}
              manage={manage}
              lit={litDish === dish.id}
              asking={asking === dish.id}
              askFailed={askFailed}
              refused={refused === dish.id}
              onEdit={() => onEditDish(dish)}
              onAskRemove={() => onAskRemove(dish)}
              onKeep={() => onKeep(`mc-remove-${dish.id}`)}
              onRemove={() => onRemove(dish)}
              variants={variants}
            />
          ))}
        </ul>
      )}
      {manage ? (
        <div className="mc-settings">
          <fieldset className="mc-answer">
            <legend className="desk-label gs-label">{t('eventMenu.howAnswer')}</legend>
            <label className="mc-radio">
              <input
                type="radio"
                className="desk-radio"
                name={`mc-answer-${course.id}`}
                checked={course.answer === 'choose'}
                onChange={() => onAnswer('choose')}
              />
              {t('eventMenu.choose')}
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
              {t('eventMenu.same')}
            </label>
            {!sameOk && (
              <p id={`mc-same-${course.id}`} className="desk-help mc-same-note">
                {t('eventMenu.sameNeedsOne')}
              </p>
            )}
            {pickTheWay != null && <p className="desk-help mc-same-note">{pickTheWay}</p>}
          </fieldset>
          <div className="mc-skip">
            <span className="mc-skip-label" id={`mc-skip-${course.id}`}>
              {t('eventMenu.skip')}
            </span>
            <Switch
              on={course.skippable}
              label={t('eventMenu.skip')}
              words={{ on: t('eventMenu.on'), off: t('eventMenu.off') }}
              {...(course.skippable ? { told: `mc-skip-line-${course.id}` } : {})}
              onChange={onSkip}
            />
          </div>
          {course.skippable && (
            <p id={`mc-skip-line-${course.id}`} className="desk-help">
              {t('eventMenu.skipOn', { course: name.toLocaleLowerCase(i18n.language) })}
            </p>
          )}
        </div>
      ) : (
        <ul className="mc-settings-read">
          <li>{course.answer === 'same' ? t('eventMenu.same') : t('eventMenu.choose')}</li>
          {course.skippable && <li>{t('eventMenu.skip')}</li>}
          {pickTheWay != null && <li className="desk-help">{pickTheWay}</li>}
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
            {t('eventMenu.addDish')}
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
  lit,
  asking,
  askFailed,
  refused,
  onEdit,
  onAskRemove,
  onKeep,
  onRemove,
  variants,
}: {
  dish: MenuDish;
  course: MenuCourse;
  manage: boolean;
  lit: boolean;
  asking: boolean;
  askFailed: string | null;
  refused: boolean;
  onEdit: () => void;
  onAskRemove: () => void;
  onKeep: () => void;
  onRemove: () => void;
  variants: VariantHandlers;
}) {
  const { t } = useTranslation();
  const name = dish.name;
  const ways = dish.variants.length > 0;
  const addRefused = variants.addRefused?.dishId === dish.id ? variants.addRefused.outcome : null;

  return (
    <li className={lit ? 'mn-dish mc-dish is-lit' : 'mn-dish mc-dish'}>
      <div className="mn-dish-top">
        <div className="mn-dish-words">
          <h3>
            {ways ? t('dishVariants.ways', { dish: name, count: dish.variants.length }) : name}
          </h3>
          {dish.description != null && <p className="mn-quiet">{dish.description}</p>}
          {!ways && <ContainsMark dish={dish} />}
          {!ways && <Tags dish={dish} />}
        </div>
        {manage && (
          <div className="lib-acts" role="group" aria-label={t('eventMenu.actionsFor', { name })}>
            <AddVariantButton
              id={`mc-addv-${dish.id}`}
              dish={name}
              onClick={() => variants.onAdd(dish)}
            />
            <HintButton
              id={`mc-edit-${dish.id}`}
              label={t('eventMenu.editAria', { name })}
              hint={t('eventMenu.editHint')}
              className="lib-act"
              onClick={onEdit}
            >
              <ActionGlyph icon="edit" />
            </HintButton>
            <HintButton
              id={`mc-remove-${dish.id}`}
              label={t('eventMenu.removeAria', { name })}
              hint={t('eventMenu.removeHint')}
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
          words={[
            addRefused === 'limit'
              ? t('dishVariants.limit', { most: VARIANTS_PER_DISH_MAXIMUM })
              : t('dishVariants.dishPicked'),
          ]}
        />
      )}
      {ways && (
        <VariantInsets
          dish={name}
          variants={shownVariants(dish)}
          where="event"
          ids="mc"
          manage={manage}
          prices={variants.prices}
          language={variants.language}
          asking={variants.ask}
          lit={variants.lit}
          onEdit={(variant) => variants.onEdit(dish, variant)}
          onRemove={(variant) => variants.onRemove(dish, variant)}
          onKeep={variants.onKeep}
          onConfirm={(variant) => variants.onConfirm(dish, variant)}
        />
      )}
      {refused && <Refused words={t('eventMenu.dishPicked')} />}
      {asking && (
        <div className="mn-ask">
          <p id={`mc-ask-${dish.id}`} tabIndex={-1}>
            {t(
              dish.libraryDishId == null ? 'eventMenu.removeAskOnly' : 'eventMenu.removeAskLibrary',
              {
                dish: name,
                course: course.name,
              },
            )}
          </p>
          <div className="mn-ask-acts">
            <button type="button" className="desk-text" onClick={onKeep}>
              {t('eventMenu.keepIt')}
            </button>
            <button type="button" className="gs-pill is-secondary" onClick={onRemove}>
              {t('eventMenu.removeDish')}
            </button>
          </div>
          <AskFailed id={dish.id} words={askFailed} />
        </div>
      )}
    </li>
  );
}

export function CourseFields({
  form,
  adding,
  problems,
  zone,
  onPatch,
}: {
  form: CourseForm;
  adding: boolean;
  problems: CourseProblems | null;
  zone: string;
  onPatch: (next: Partial<CourseForm>) => void;
}) {
  const { t } = useTranslation();
  const length = courseLength(form.name);

  return (
    <>
      <div className="desk-field">
        <label htmlFor="mc-name" className="desk-label gs-label">
          {t('menuLibrary.name')}
        </label>
        <div className={problems?.name == null ? 'desk-box' : 'desk-box is-wrong'}>
          <input
            id="mc-name"
            type="text"
            value={form.name}
            autoComplete="off"
            aria-invalid={problems?.name != null}
            aria-describedby={describedBy(
              'mc-name-count',
              problems?.name == null ? null : 'mc-name-error',
            )}
            onChange={(event) => onPatch({ name: event.target.value })}
          />
        </div>
        <p
          id="mc-name-count"
          className={length > MENU_COURSE_NAME_MAXIMUM ? 'lib-counter is-over' : 'lib-counter'}
        >
          {t('menuLibrary.counter', { count: length, most: MENU_COURSE_NAME_MAXIMUM })}
        </p>
        {problems?.name != null && (
          <Wrong id="mc-name-error">
            {problems.name === 'blank'
              ? t('eventMenu.courseBlank')
              : t('eventMenu.courseLong', { most: MENU_COURSE_NAME_MAXIMUM })}
          </Wrong>
        )}
        <div className="mc-suggest" role="group" aria-label={t('eventMenu.suggestions')}>
          {(['starter', 'main', 'dessert'] as const).map((one) => (
            <button
              key={one}
              type="button"
              className="gs-pill is-secondary mc-suggestion"
              onClick={() => onPatch({ name: t(`eventMenu.${one}`) })}
            >
              {t(`eventMenu.${one}`)}
            </button>
          ))}
        </div>
      </div>
      <div className="desk-field">
        <label htmlFor="mc-served" className="desk-label gs-label">
          {t('eventMenu.servedAt')}
          <span className="gs-optional">{t('menuLibrary.optional')}</span>
        </label>
        <div
          className={problems?.servedAt == null ? 'desk-box mc-time' : 'desk-box mc-time is-wrong'}
        >
          <input
            id="mc-served"
            type="text"
            inputMode="numeric"
            value={form.servedAt}
            autoComplete="off"
            aria-invalid={problems?.servedAt != null}
            aria-describedby={describedBy(
              'mc-served-help',
              problems?.servedAt == null ? null : 'mc-served-error',
            )}
            onChange={(event) => onPatch({ servedAt: event.target.value })}
          />
        </div>
        <p id="mc-served-help" className="desk-help">
          {t('eventMenu.servedHelp', { zone })}
        </p>
        {problems?.servedAt != null && (
          <Wrong id="mc-served-error">{t('eventMenu.timeWrong')}</Wrong>
        )}
      </div>
      {adding && <p className="desk-help">{t('eventMenu.goesLast')}</p>}
    </>
  );
}

export function AddDishPanel({
  tab,
  query,
  added,
  form,
  onlyEvent,
  course,
  library,
  problems,
  prices,
  language,
  onTab,
  onFind,
  onAdd,
  onStartNew,
  onPatch,
  onOnlyEvent,
}: {
  tab: 'library' | 'new';
  query: string;
  added: string;
  form: DishForm;
  onlyEvent: boolean;
  course: MenuCourse;
  library: readonly Dish[];
  problems: DishProblems | null;
  prices: boolean;
  language: MoneyLanguage;
  onTab: (tab: 'library' | 'new') => void;
  onFind: (query: string) => void;
  onAdd: (dish: Dish) => void;
  onStartNew: (name: string) => void;
  onPatch: (next: Partial<DishForm>) => void;
  onOnlyEvent: (onlyEvent: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const shown = shownDishes(library, query, [], i18n.language);
  const looking = query.trim() !== '';

  return (
    <>
      <div className="lib-tabs mc-tabs" role="tablist" aria-label={t('eventMenu.dishTabs')}>
        {(['library', 'new'] as const).map((one) => (
          <button
            key={one}
            id={`mc-tab-${one}`}
            type="button"
            role="tab"
            aria-selected={tab === one}
            aria-controls="mc-tabpanel"
            className={tab === one ? 'lib-tab is-on' : 'lib-tab'}
            onClick={() => onTab(one)}
          >
            {one === 'library' ? t('eventMenu.fromLibrary') : t('eventMenu.newDish')}
          </button>
        ))}
      </div>
      <div id="mc-tabpanel" role="tabpanel" aria-labelledby={`mc-tab-${tab}`}>
        {tab === 'library' ? (
          <div className="mc-library">
            <div className="desk-field">
              <label htmlFor="mc-find" className="desk-label gs-label">
                {t('eventMenu.find')}
              </label>
              <div className="desk-box">
                <Glyph name="search" size={16} weight={2.4} />
                <input
                  id="mc-find"
                  type="search"
                  value={query}
                  autoComplete="off"
                  aria-describedby="mc-found"
                  onChange={(event) => onFind(event.target.value)}
                />
              </div>
              <p id="mc-found" className="desk-help" role="status">
                {looking
                  ? t('eventMenu.foundOf', { shown: shown.length, count: library.length })
                  : t('eventMenu.inLibrary', { count: library.length })}
              </p>
            </div>
            <p className="mc-added" role="status">
              {added !== '' && (
                <>
                  <Glyph name="tick" size={16} weight={2.6} />
                  {added}
                </>
              )}
            </p>
            {shown.length === 0 ? (
              <div className="mc-no-match">
                <p>{t('eventMenu.noMatch', { query: query.trim() })}</p>
                <button
                  type="button"
                  className="gs-pill is-secondary"
                  onClick={() => onStartNew(query.trim())}
                >
                  {t('eventMenu.startNew', { query: query.trim() })}
                </button>
              </div>
            ) : (
              <ul className="mc-picks">
                {shown.map((dish) => (
                  <li key={dish.id} className="mc-pick">
                    <div className="mc-pick-words">
                      <h3>{dish.name}</h3>
                      <ContainsMark dish={dish} />
                      <Tags dish={dish} />
                    </div>
                    {onCourse(course, dish.id) ? (
                      <p className="mc-on-course">
                        <Glyph name="tick" size={16} weight={2.6} />
                        {t('eventMenu.onCourse')}
                      </p>
                    ) : (
                      <button
                        type="button"
                        className="gs-pill is-secondary mc-pick-add"
                        aria-label={t('eventMenu.addAria', { name: dish.name })}
                        onClick={() => onAdd(dish)}
                      >
                        {t('eventMenu.add')}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <DishFields
            form={form}
            problems={problems}
            notStated={false}
            editing={null}
            prices={prices && !onlyEvent}
            language={language}
            onPatch={onPatch}
            beforePrice={
              <div className="desk-field mc-only">
                <label className="gs-tick lib-tick">
                  <input
                    id="mc-only"
                    type="checkbox"
                    className="gs-box"
                    checked={onlyEvent}
                    aria-describedby="mc-only-help"
                    onChange={() => onOnlyEvent(!onlyEvent)}
                  />
                  {t('eventMenu.onlyEvent')}
                </label>
                <p id="mc-only-help" className="desk-help">
                  {onlyEvent ? t('eventMenu.notLibrary') : t('eventMenu.alsoLibrary')}
                </p>
              </div>
            }
          />
        )}
      </div>
    </>
  );
}

export function EditDishFields({
  form,
  dish,
  problems,
  language,
  onPatch,
}: {
  form: DishForm;
  dish: MenuDish | null;
  problems: DishProblems | null;
  language: MoneyLanguage;
  onPatch: (next: Partial<DishForm>) => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      {dish != null && dish.variants.length > 0 ? (
        <NameDescFields form={form} problems={problems} onPatch={onPatch} />
      ) : (
        <DishFields
          form={form}
          problems={problems}
          notStated={dish?.allergens == null}
          editing={null}
          prices={false}
          language={language}
          onPatch={onPatch}
        />
      )}
      <p className="lib-own-copy">
        {dish?.libraryDishId == null ? t('eventMenu.eventOnly') : t('eventMenu.copyOnly')}
      </p>
    </>
  );
}
