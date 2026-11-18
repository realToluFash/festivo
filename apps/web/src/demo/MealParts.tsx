import { Glyph } from '../components/Glyph.tsx';
import { type MealAnswer, type MealCourse, MW, cardLines, containsLine } from './mealStep.ts';
import type { Lang } from './menuLibrary.ts';

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
