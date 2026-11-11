import type { CardStepAction } from '@soirely/domain';
import { type ReactNode, type RefObject, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import {
  type CardPhoto,
  type CardStep,
  type PhaseMark,
  type Shown,
  cardStep,
  cardTags,
  dayTiles,
  rowLine,
} from '../eventsList.ts';
import type { Mesh } from '../mesh.ts';
import { Glyph } from './Glyph.tsx';
import { CardStep as StepButton } from './SettingsParts.tsx';
import './desk.css';
import './SettingsParts.css';
import './eventsDesk.css';
import './EventsList.css';

/** The photo that shows: a saved cover until it fails to load, then none. */
function usePhoto(photo: CardPhoto | null): [CardPhoto | null, () => void] {
  const first = photo == null || photo === 'standIn' ? null : (photo.sizes[0]?.url ?? null);
  const [failed, setFailed] = useState<string | null>(null);

  return [first != null && failed === first ? null : photo, () => setFailed(first)];
}

/** The organiser's photo over the whole box, decorative: the event's name is beside it. */
function Photo({
  photo,
  sizes,
  onFail,
}: {
  photo: Exclude<CardPhoto, 'standIn'>;
  sizes: string;
  onFail: () => void;
}) {
  const image = useRef<HTMLImageElement>(null);
  const position = photo.position;

  // Through the CSSOM: the CSP has no 'unsafe-inline', which governs a style attribute too.
  useLayoutEffect(() => {
    if (image.current != null) image.current.style.objectPosition = `50% ${position}%`;
  }, [position]);

  return (
    <img
      ref={image}
      className="ev-photo"
      src={photo.sizes[0]?.url}
      srcSet={
        photo.sizes.length > 1
          ? photo.sizes.map(({ width, url }) => `${url} ${width}w`).join(', ')
          : undefined
      }
      sizes={photo.sizes.length > 1 ? sizes : undefined}
      alt=""
      draggable={false}
      onError={onFail}
    />
  );
}

/** The event's cover at a size, or its colour from meshFor while it has no photo. */
export function EventThumb({
  event,
  size,
}: {
  event: { mesh: Mesh; photo: CardPhoto | null };
  size: 28 | 40 | 48;
}) {
  const [photo, failed] = usePhoto(event.photo);

  if (photo == null)
    return (
      <span className={`ev-thumb is-${size} today-cover is-${event.mesh}`} aria-hidden="true" />
    );

  return (
    <span className={`ev-thumb is-${size} is-photo`} aria-hidden="true">
      {photo === 'standIn' ? (
        <Glyph name="photo" size={Math.round(size / 2)} weight={1.8} />
      ) : (
        <Photo photo={photo} sizes={`${size}px`} onFail={failed} />
      )}
    </span>
  );
}

function GlassMark({ mark }: { mark: PhaseMark }) {
  switch (mark) {
    case 'paused':
      return (
        <span className="ev-glass-mark is-paused" aria-hidden="true">
          <span />
          <span />
        </span>
      );
    case 'finished':
      return <Glyph name="tick" size={14} weight={2.8} />;
    case 'calledOff':
      return <Glyph name="clear" size={14} weight={2.8} />;
    default:
      return <span className={`ev-glass-mark is-${mark}`} aria-hidden="true" />;
  }
}

const PIECES = [1, 2, 3, 4, 5, 6];

export type ButtonStep = Extract<CardStep, { kind: 'button' }>;

/** The cover card: the phase and how soon on its glass, the name, its days and place, a tile per day, and its one step, offered only to a role that can take it (sc-30413). */
export function EventCard({
  event,
  now,
  locale,
  level,
  to,
  guests = null,
  nextUp = null,
  takes,
  onStep,
  nameRef,
  stepRef,
  held = false,
  sending = null,
}: {
  event: Shown;
  now: Date;
  locale: string;
  level: 1 | 2;
  /** Where its name leads on a list; an event's own page names it without a link. */
  to?: string;
  /** Its guests in the tiles' measure, on Events (sc-3786). */
  guests?: string | null;
  /** In place of a Next up step: the reader's own milestone, with its action. */
  nextUp?: ReactNode;
  takes: (action: CardStepAction) => boolean;
  onStep: (step: ButtonStep) => void;
  nameRef?: RefObject<HTMLHeadingElement | null>;
  stepRef?: RefObject<HTMLButtonElement | null>;
  held?: boolean;
  sending?: string | null;
}) {
  const { t } = useTranslation();
  const [photo, failed] = usePhoto(event.photo);
  const tags = cardTags(event, now, t);
  const tiles = dayTiles(event, now, locale);
  const step = cardStep(event, now, locale, t);
  const Name = level === 1 ? 'h1' : 'h2';

  return (
    <section
      className={`ev-card today-cover ${photo == null ? `is-${event.mesh}` : 'is-photo'}`}
      aria-label={level === 2 ? event.name : undefined}
    >
      {photo != null && photo !== 'standIn' && (
        <Photo photo={photo} sizes="(min-width: 1280px) 938px, 100vw" onFail={failed} />
      )}
      <span className="ev-scrim" aria-hidden="true" />
      {photo === 'standIn' ? (
        <span className="ev-card-photo" aria-hidden="true">
          <Glyph name="photo" size={64} weight={1.6} />
        </span>
      ) : (
        photo == null &&
        PIECES.map((piece) => (
          <span key={piece} className={`desk-piece p${piece}`} aria-hidden="true" />
        ))
      )}
      <div className="ev-card-inner">
        <ul className="desk-glass-tags">
          {tags.map((tag) => (
            <li key={tag.word} className="desk-glass">
              {tag.mark != null && <GlassMark mark={tag.mark} />}
              {tag.word}
            </li>
          ))}
        </ul>
        <Name ref={nameRef} className="ev-card-name" tabIndex={level === 1 ? -1 : undefined}>
          {to == null ? (
            event.name
          ) : (
            <Link className="ev-card-link" to={to}>
              {event.name}
            </Link>
          )}
        </Name>
        <p className="desk-on-card">{rowLine(event, now, locale, t, event.calledOff)}</p>
        {guests != null && <p className="desk-on-card">{guests}</p>}
        {tiles.length > 0 && (
          <ul className="ev-tiles" aria-label={t('events.itsDays')}>
            {tiles.map((tile) =>
              tile.kind === 'gap' ? (
                <li key={tile.key} className="ev-tile is-gap">
                  <span className="ev-tile-day" aria-hidden="true">
                    {tile.more}
                  </span>
                  <span className="desk-unseen">
                    {t('events.moreDays', { count: tile.hidden })}
                  </span>
                </li>
              ) : (
                <li key={tile.key} className={tile.today ? 'ev-tile is-today' : 'ev-tile'}>
                  <span className="ev-tile-top">
                    {tile.today ? t('events.today') : tile.weekday}
                  </span>
                  <span className="ev-tile-day">{tile.day}</span>
                </li>
              ),
            )}
          </ul>
        )}
        <div className="ev-card-foot">
          {held ? null : step.kind === 'next' ? (
            (nextUp ?? (
              <>
                <p className="ev-card-next">{step.title}</p>
                <p className="desk-on-card">{step.line}</p>
              </>
            ))
          ) : (
            <>
              <p className="desk-on-card">{step.line}</p>
              {takes(step.action) && (
                <StepButton
                  ref={stepRef}
                  label={sending ?? step.label}
                  busy={sending != null}
                  onClick={() => onStep(step)}
                />
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
