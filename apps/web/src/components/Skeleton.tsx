import { type ReactNode, useEffect, useState } from 'react';

/** Under a second a person's flow is not broken, and a loading state that flashes up and away is noise. */
export const SKELETON_AFTER_MS = 1000;

export type RowHeight = 56 | 64 | 76;

export type CardShape = { lines?: number; fields?: number; options?: number; cover?: boolean };

type Shape =
  | { shape: 'rows'; rowHeight: RowHeight; picture?: boolean; rows?: number }
  | { shape: 'cards'; cards: readonly CardShape[]; titled?: boolean }
  | { shape: 'line' };

/**
 * What stands where content is on its way: nothing for a second, then the
 * content's shape in inset blocks under the screen's loading words.
 *
 * `inCard` draws inside a card that is already there, under its heading.
 */
export function Skeleton({
  words,
  inCard = false,
  ...shape
}: Shape & { words: string; inCard?: boolean }) {
  const shown = useShownAfter(SKELETON_AFTER_MS);

  return (
    <div className={shown ? 'skeleton skeleton-shown' : 'skeleton'} aria-busy="true">
      <p className="skeleton-words" role="status" aria-live="polite">
        {shown ? words : ''}
      </p>
      <div className="skeleton-blocks" aria-hidden="true">
        {shape.shape === 'rows' && <Rows {...shape} framed={!inCard} />}
        {shape.shape === 'cards' &&
          shape.cards.map((card, index) => (
            <Card
              key={index}
              card={card}
              titled={index === 0 && shape.titled === true}
              framed={!inCard}
            />
          ))}
        {shape.shape === 'line' && <span className="skeleton-bar skeleton-bar-count" />}
      </div>
    </div>
  );
}

function Rows({
  rowHeight,
  picture = false,
  rows,
  framed,
}: {
  rowHeight: RowHeight;
  picture?: boolean;
  rows?: number;
  framed: boolean;
}) {
  return (
    <div className={framed ? 'skeleton-card skeleton-rows' : 'skeleton-rows'}>
      {Array.from({ length: rows ?? fillingRows(rowHeight) }, (_, index) => (
        <div key={index} className={`skeleton-row skeleton-row-${rowHeight}`}>
          {picture && <span className="skeleton-tile" />}
          <span className="skeleton-row-bars">
            <span className="skeleton-bar skeleton-bar-first" />
            <span className="skeleton-bar skeleton-bar-second" />
          </span>
        </div>
      ))}
    </div>
  );
}

function Card({ card, titled, framed }: { card: CardShape; titled: boolean; framed: boolean }) {
  const { lines = 2, fields = 0, options = 0, cover = false } = card;

  return (
    <div className={framed ? 'skeleton-card skeleton-cardful' : 'skeleton-cardful'}>
      {cover && <span className="skeleton-cover" />}
      <span
        className={titled ? 'skeleton-bar skeleton-bar-title' : 'skeleton-bar skeleton-bar-heading'}
      />
      {Array.from({ length: lines }, (_, index) => (
        <span key={`line-${index}`} className="skeleton-bar skeleton-bar-line" />
      ))}
      {Array.from({ length: fields }, (_, index) => (
        <span key={`field-${index}`} className="skeleton-field" />
      ))}
      {Array.from({ length: options }, (_, index) => (
        <span key={`option-${index}`} className="skeleton-option" />
      ))}
    </div>
  );
}

/** As many rows as fill the window, never the real count, so the skeleton never scrolls. */
function fillingRows(rowHeight: RowHeight): number {
  return Math.min(10, Math.max(3, Math.floor((window.innerHeight - 260) / rowHeight)));
}

export function useShownAfter(ms: number): boolean {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setShown(true), ms);

    return () => window.clearTimeout(id);
  }, [ms]);

  return shown;
}

/** Holds what a load brought, so it fades in where its skeleton stood without changing the layout around it. */
export function Arrived({ children }: { children: ReactNode }) {
  return <div className="arrived">{children}</div>;
}
