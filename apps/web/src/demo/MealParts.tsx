import { Glyph } from '../components/Glyph.tsx';
import { type MealAnswer, type MealCourse, MW, cardLines, containsLine } from './mealStep.ts';
import type { Lang } from './menuLibrary.ts';

export type PickShape = 'kitchen' | 'skipped' | 'host' | 'changed';

export function PickMark({ shape, words }: { shape: PickShape; words: string | null }) {
  return (
    <p className="mx-pick pc-shape">
      <span className={`pc-ring is-${shape}`} aria-hidden="true">
        {shape === 'kitchen' ? (
          <ForkKnife />
        ) : shape === 'changed' ? (
          <Swap />
        ) : (
          <Glyph
            name={shape === 'skipped' ? 'minus' : 'message'}
            size={13}
            weight={shape === 'skipped' ? 2.6 : 2.4}
          />
        )}
      </span>
      <span>{words}</span>
    </p>
  );
}

/** sc-3913's Menu changed mark, the two arrows See picks draws. */
export function Swap() {
  return (
    <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true" focusable="false">
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

export function Refused({ words }: { words: string }) {
  return (
    <p id="ms-refused" className="desk-error ms-refused" role="alert">
      <Glyph name="alert" size={16} weight={2.2} />
      {words}
    </p>
  );
}

export function DishScreen({
  course,
  answer,
  lang,
  refusal,
  closeId,
  onPick,
}: {
  course: MealCourse;
  answer: MealAnswer;
  lang: Lang;
  refusal: string | null;
  closeId?: string | undefined;
  onPick: (id: string) => void;
}) {
  return (
    <fieldset
      className="ms-set"
      aria-describedby={
        [refusal != null && 'ms-refused', closeId].filter(Boolean).join(' ') || undefined
      }
    >
      <legend className="ms-legend">
        <h2 id="ms-h" className="gp-h2 gk-h2" tabIndex={-1}>
          {course.name}
        </h2>
        <span className="gk-text is-quiet">{MW.chooseDish}</span>
      </legend>
      {refusal != null && <Refused words={refusal} />}
      <div className={refusal == null ? 'ms-options' : 'ms-options is-wrong'}>
        {course.dishes.map((dish) => {
          const card = cardLines(dish, answer, lang);

          return (
            <label key={dish.id} className="ms-option">
              <input
                type="radio"
                className="desk-radio"
                name="ms-dish"
                checked={answer.dishId === dish.id}
                onChange={() => onPick(dish.id)}
              />
              <span className="ms-option-words">
                <span className="ms-option-name">{dish.name}</span>
                <span className="ms-quiet">{dish.desc}</span>
                {card != null ? (
                  <>
                    <span className="ms-contains">{card.contains}</span>
                    {card.sources.map((one) => (
                      <span key={one} className="ms-quiet">
                        {one}
                      </span>
                    ))}
                  </>
                ) : dish.ways.length >= 2 ? (
                  <span className="ms-quiet">{MW.pickWayNext}</span>
                ) : (
                  <span className="ms-contains">{containsLine(dish.contains, lang)}</span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
