import { useId } from 'react';

import { useChosenScheme } from './chosenScheme.ts';
import { Glyph } from './Glyph.tsx';
import { type Art, OWN_SCHEME, SCHEMES, type SchemeKey, TILE_ART } from './personalisation.ts';
import './personalisation.css';

const ROOT2 = Math.SQRT2;

/** A scheme's ground, stretched to its box as CSS stretches a radial-gradient: each glow an ellipse through the farthest corner. */
export function Ground({ scheme, wash }: { scheme: SchemeKey; wash: boolean }) {
  const id = useId().replace(/[^\w-]/g, '');
  const { glows, base, band } = SCHEMES[scheme];
  const washed = wash ? band : null;

  return (
    <svg
      className="pers-ground"
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {glows.map((glow, index) => (
          <radialGradient
            key={index}
            id={`${id}-g${index}`}
            cx="0"
            cy="0"
            r="1"
            gradientTransform={`translate(${glow.x} ${glow.y}) scale(${ROOT2 * Math.max(glow.x, 1 - glow.x)} ${ROOT2 * Math.max(glow.y, 1 - glow.y)})`}
          >
            <stop offset="0" stopColor={glow.colour} />
            <stop offset={glow.reach} stopColor={glow.colour} stopOpacity="0" />
          </radialGradient>
        ))}
        {washed != null && (
          <linearGradient id={`${id}-w`}>
            <stop offset="0" stopColor={`rgb(${washed.rgb})`} stopOpacity={washed.from} />
            <stop offset="0.55" stopColor={`rgb(${washed.rgb})`} stopOpacity={washed.mid} />
            <stop offset="0.85" stopColor={`rgb(${washed.rgb})`} stopOpacity="0" />
          </linearGradient>
        )}
      </defs>
      <rect width="1" height="1" fill={base} />
      {glows
        .map((_, index) => index)
        .reverse()
        .map((index) => (
          <rect key={index} width="1" height="1" fill={`url(#${id}-g${index})`} />
        ))}
      {washed != null && <rect width="1" height="1" fill={`url(#${id}-w)`} />}
    </svg>
  );
}

/** The pieces at their own size, from the box's top right, as the boards place them. */
export function Pieces({ scheme, art }: { scheme: SchemeKey; art: Art }) {
  const colours = SCHEMES[scheme].pieces;

  return (
    <svg
      className="pers-pieces"
      width={art.width}
      height={art.height}
      viewBox={`0 0 ${art.width} ${art.height}`}
      aria-hidden="true"
      focusable="false"
    >
      {art.pieces.map(([x, y, shape, length, turn, colour], index) => {
        const left = x - Math.floor(length / 2);
        const tall =
          shape === 'half' ? Math.floor(length / 2) : Math.max(8, Math.round(length * 0.24));
        const spin = `rotate(${turn} ${left + length / 2} ${y + tall / 2})`;

        return shape === 'half' ? (
          <path
            key={index}
            d={`M${left} ${y + tall}a${length / 2} ${length / 2} 0 0 1 ${length} 0z`}
            fill={colours[colour]}
            transform={spin}
          />
        ) : (
          <rect
            key={index}
            x={left}
            y={y}
            width={length}
            height={tall}
            rx={tall / 2}
            fill={colours[colour]}
            transform={spin}
          />
        );
      })}
    </svg>
  );
}

/** The scheme's accent, two of its pieces and its page, each ringed so it holds on the Confetti. */
export function Dots({ scheme, size }: { scheme: SchemeKey; size: 20 | 24 }) {
  const { accent, pieces, page, dark, on } = SCHEMES[scheme];
  const step = size + 8;

  return (
    <svg
      className="pers-dots"
      width={4 + 4 * size + 3 * 8}
      height={size + 4}
      aria-hidden="true"
      focusable="false"
    >
      {[accent, pieces[0], pieces[2], page].map((colour, index) => (
        <g key={index}>
          <circle
            cx={2 + size / 2 + index * step}
            cy={2 + size / 2}
            r={size / 2 + 1}
            fill="none"
            stroke={dark ? on : '#FFFFFF'}
            strokeOpacity={dark ? 0.5 : 0.9}
            strokeWidth="2"
          />
          <circle cx={2 + size / 2 + index * step} cy={2 + size / 2} r={size / 2} fill={colour} />
        </g>
      ))}
    </svg>
  );
}

export function SchemeTile({ scheme }: { scheme: SchemeKey }) {
  return (
    <span
      className={SCHEMES[scheme].dark ? 'desk-tile pers-tile is-dark' : 'desk-tile pers-tile'}
      aria-hidden="true"
    >
      <Ground scheme={scheme} wash={false} />
      <Pieces scheme={scheme} art={TILE_ART} />
      <Glyph name="palette" size={18} weight={2.1} />
    </span>
  );
}

/** Personalisation's tile in the Settings list: a swatch of the person's own colours. */
export function PersonalTile() {
  return <SchemeTile scheme={useChosenScheme() ?? OWN_SCHEME} />;
}
