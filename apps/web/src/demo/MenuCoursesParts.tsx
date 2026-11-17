import { Glyph } from '../components/Glyph.tsx';
import {
  type CourseErrors,
  type CourseForm,
  type EvCourse,
  type EvDish,
  COURSE_NAME_MAX,
  CW,
  lengthOf,
  onCourse,
} from './menuCourses.ts';
import {
  type DishForm,
  type FormErrors,
  type Lang,
  type LibDish,
  LW,
  dietName,
  shownDishes,
} from './menuLibrary.ts';
import { ContainsMark, DishFields } from './MenuLibrary.tsx';
import { VW, hasVariants, waysName } from './dishVariants.ts';
import { NameDescFields } from './DishVariants.tsx';
import type { Open } from './MenuCourses.tsx';

export interface Told {
  words: string;
  /** A second line under it, beside the amber ring: the allergen line, or Guests choose again. */
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

function Wrong({ id, words }: { id: string; words: string }) {
  return (
    <p id={id} className="desk-error">
      <Glyph name="alert" size={15} weight={2.2} />
      {words}
    </p>
  );
}

const described = (...ids: (string | null | false)[]): string | undefined => {
  const joined = ids.filter(Boolean).join(' ');

  return joined === '' ? undefined : joined;
};

export function CourseFields({
  form,
  adding,
  errors,
  onPatch,
}: {
  form: CourseForm;
  adding: boolean;
  errors: CourseErrors | null;
  onPatch: (next: Partial<CourseForm>) => void;
}) {
  const length = lengthOf(form.name);

  return (
    <>
      <div className="desk-field">
        <label htmlFor="mc-name" className="desk-label gs-label">
          {CW.name}
        </label>
        <div className={errors?.name == null ? 'desk-box' : 'desk-box is-wrong'}>
          <input
            id="mc-name"
            type="text"
            value={form.name}
            autoComplete="off"
            aria-invalid={errors?.name != null}
            aria-describedby={described('mc-name-count', errors?.name != null && 'mc-name-error')}
            onChange={(event) => onPatch({ name: event.target.value })}
          />
        </div>
        <p
          id="mc-name-count"
          className={length > COURSE_NAME_MAX ? 'lib-counter is-over' : 'lib-counter'}
        >
          {CW.counter(length, COURSE_NAME_MAX)}
        </p>
        {errors?.name != null && <Wrong id="mc-name-error" words={errors.name} />}
        <div className="mc-suggest" role="group" aria-label={CW.suggestions}>
          {CW.suggested.map((one) => (
            <button
              key={one}
              type="button"
              className="gs-pill is-secondary mc-suggestion"
              onClick={() => onPatch({ name: one })}
            >
              {one}
            </button>
          ))}
        </div>
      </div>
      <div className="desk-field">
        <label htmlFor="mc-served" className="desk-label gs-label">
          {CW.servedAt}
          <span className="gs-optional">{CW.optional}</span>
        </label>
        <div
          className={errors?.servedAt == null ? 'desk-box mc-time' : 'desk-box mc-time is-wrong'}
        >
          <input
            id="mc-served"
            type="text"
            inputMode="numeric"
            value={form.servedAt}
            autoComplete="off"
            aria-invalid={errors?.servedAt != null}
            aria-describedby={described(
              'mc-served-help',
              errors?.servedAt != null && 'mc-served-error',
            )}
            onChange={(event) => onPatch({ servedAt: event.target.value })}
          />
        </div>
        <p id="mc-served-help" className="desk-help">
          {CW.servedHelp}
        </p>
        {errors?.servedAt != null && <Wrong id="mc-served-error" words={errors.servedAt} />}
      </div>
      {adding && <p className="desk-help">{CW.goesLast}</p>}
    </>
  );
}

type AddDishOpen = Extract<Open, { kind: 'addDish' }>;

export function AddDishPanel({
  open,
  course,
  lang,
  budget,
  library,
  loading,
  errors,
  onTab,
  onFind,
  onAdd,
  onStartNew,
  onPatch,
  onOnlyEvent,
}: {
  open: AddDishOpen;
  course: EvCourse;
  lang: Lang;
  budget: boolean;
  library: readonly LibDish[];
  loading: boolean;
  errors: FormErrors | null;
  onTab: (tab: 'library' | 'new') => void;
  onFind: (q: string) => void;
  onAdd: (libraryId: string) => void;
  onStartNew: (name: string) => void;
  onPatch: (next: Partial<DishForm>) => void;
  onOnlyEvent: (onlyEvent: boolean) => void;
}) {
  const shown = shownDishes(library, open.q, []);
  const looking = open.q.trim() !== '';

  return (
    <>
      <div className="lib-tabs mc-tabs" role="tablist" aria-label={CW.dishTabs}>
        {(['library', 'new'] as const).map((one) => (
          <button
            key={one}
            id={`mc-tab-${one}`}
            type="button"
            role="tab"
            aria-selected={open.tab === one}
            aria-controls="mc-tabpanel"
            className={open.tab === one ? 'lib-tab is-on' : 'lib-tab'}
            onClick={() => onTab(one)}
          >
            {one === 'library' ? CW.fromLibrary : CW.newDish}
          </button>
        ))}
      </div>
      <div id="mc-tabpanel" role="tabpanel" aria-labelledby={`mc-tab-${open.tab}`}>
        {open.tab === 'library' ? (
          <div className="mc-library">
            <div className="desk-field">
              <label htmlFor="mc-find" className="desk-label gs-label">
                {CW.find}
              </label>
              <div className="desk-box">
                <Glyph name="search" size={16} weight={2.4} />
                <input
                  id="mc-find"
                  type="search"
                  value={open.q}
                  autoComplete="off"
                  aria-describedby="mc-found"
                  onChange={(event) => onFind(event.target.value)}
                />
              </div>
              <p id="mc-found" className="desk-help" role="status">
                {loading
                  ? CW.libraryLoading
                  : looking
                    ? CW.foundOf(shown.length, library.length)
                    : CW.inLibrary(library.length)}
              </p>
            </div>
            <p className="mc-added" role="status">
              {open.added !== '' && (
                <>
                  <Glyph name="tick" size={16} weight={2.6} />
                  {open.added}
                </>
              )}
            </p>
            {loading ? (
              <div className="lib-loading" aria-busy="true">
                {[0, 1, 2].map((one) => (
                  <div key={one} className="lib-bone" aria-hidden="true" />
                ))}
              </div>
            ) : shown.length === 0 ? (
              <div className="mc-no-match">
                <p>{looking ? CW.noMatch(open.q.trim()) : CW.libraryEmpty}</p>
                <button
                  type="button"
                  className="gs-pill is-secondary"
                  onClick={() => onStartNew(open.q.trim())}
                >
                  {looking ? CW.startNew(open.q.trim()) : CW.startNewBlank}
                </button>
              </div>
            ) : (
              <ul className="mc-picks">
                {shown.map((dish) => (
                  <li key={dish.id} className="mc-pick">
                    <div className="mc-pick-words">
                      <h3>{waysName(dish)}</h3>
                      {hasVariants(dish) ? (
                        <p className="mn-quiet">{VW.eachOwn}</p>
                      ) : (
                        <ContainsMark dish={dish} lang={lang} />
                      )}
                      {!hasVariants(dish) && dish.diets.length > 0 && (
                        <ul className="lib-tags" aria-label={`${LW.suitableFor} · ${dish.name}`}>
                          {dish.diets.map((diet) => (
                            <li key={diet} className="lib-tag">
                              {dietName(diet, lang)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    {onCourse(course, dish.id) ? (
                      <p className="mc-on-course">
                        <Glyph name="tick" size={16} weight={2.6} />
                        {CW.onCourse}
                      </p>
                    ) : (
                      <button
                        type="button"
                        className="gs-pill is-secondary mc-pick-add"
                        aria-label={CW.addAria(dish.name)}
                        onClick={() => onAdd(dish.id)}
                      >
                        {CW.add}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <DishFields
            form={open.form}
            errors={errors}
            notStated={false}
            editing={false}
            budget={budget && !open.onlyEvent}
            lang={lang}
            onPatch={onPatch}
            beforePrice={
              <div className="desk-field mc-only">
                <label className="gs-tick lib-tick">
                  <input
                    id="mc-only"
                    type="checkbox"
                    className="gs-box"
                    checked={open.onlyEvent}
                    aria-describedby="mc-only-help"
                    onChange={() => onOnlyEvent(!open.onlyEvent)}
                  />
                  {CW.onlyEvent}
                </label>
                <p id="mc-only-help" className="desk-help">
                  {open.onlyEvent ? CW.notLibrary : CW.alsoLibrary}
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
  lang,
  errors,
  onPatch,
}: {
  form: DishForm;
  dish: EvDish | null;
  lang: Lang;
  errors: FormErrors | null;
  onPatch: (next: Partial<DishForm>) => void;
}) {
  if (dish != null && hasVariants(dish))
    return (
      <>
        <NameDescFields form={form} errors={errors} onPatch={onPatch} />
        <p className="lib-own-copy">{dish.libraryId == null ? CW.eventOnly : CW.copyOnly}</p>
      </>
    );

  return (
    <>
      <DishFields
        form={form}
        errors={errors}
        notStated={dish?.contains == null}
        editing={false}
        budget={false}
        lang={lang}
        onPatch={onPatch}
      />
      <p className="lib-own-copy">{dish?.libraryId == null ? CW.eventOnly : CW.copyOnly}</p>
    </>
  );
}
