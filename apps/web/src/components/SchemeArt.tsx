import { useId } from 'react';

import { type Art, TILE_ART, isLightGround } from '../schemeArt.ts';
import { useColourScheme } from '../colourScheme.ts';
import { type Scheme, confetti } from '../scheme.ts';
import { schemeTokens } from '../schemeTokens.ts';

const ROOT2 = Math.SQRT2;
const WASH_FROM = 0.5;
const WASH_MID = 0.3;

/** A scheme's ground, stretched to its box as CSS stretches a radial-gradient: each glow an ellipse through the farthest corner. */
export function Ground({ scheme, wash }: { scheme: Scheme; wash: boolean }) {
  const id = useId().replace(/[^\w-]/g, '');
  const { ground, wash: band } = confetti[scheme];
  const washed = wash ? band : null;

  return (
    <svg
      className="scheme-ground"
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {ground.glows.map((glow, index) => (
          <radialGradient
            key={index}
            id={`${id}-g${index}`}
            cx="0"
            cy="0"
            r="1"
            gradientTransform={`translate(${glow.x} ${glow.y}) scale(${ROOT2 * Math.max(glow.x, 1 - glow.x)} ${ROOT2 * Math.max(glow.y, 1 - glow.y)})`}
          >
            <stop offset="0" stopColor={glow.colour} />
            <stop offset={glow.fade} stopColor={glow.colour} stopOpacity="0" />
          </radialGradient>
        ))}
        {washed != null && (
          <linearGradient id={`${id}-w`}>
            <stop
              offset="0"
              stopColor={washed.band}
              stopOpacity={Math.min(1, WASH_FROM * washed.strength)}
            />
            <stop
              offset="0.55"
              stopColor={washed.band}
              stopOpacity={Math.min(1, WASH_MID * washed.strength)}
            />
            <stop offset="0.85" stopColor={washed.band} stopOpacity="0" />
          </linearGradient>
        )}
      </defs>
      <rect width="1" height="1" fill={ground.base} />
      {ground.glows
        .map((_, index) => index)
        .reverse()
        .map((index) => (
          <rect key={index} width="1" height="1" fill={`url(#${id}-g${index})`} />
        ))}
      {washed != null && <rect width="1" height="1" fill={`url(#${id}-w)`} />}
    </svg>
  );
}

/** The pieces at their own size, from the box's top right. */
export function Pieces({ scheme, art }: { scheme: Scheme; art: Art }) {
  const colours = confetti[scheme].pieces;

  return (
    <svg
      className="scheme-pieces"
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
export function Dots({ scheme, size }: { scheme: Scheme; size: 20 | 24 }) {
  const { pieces, on } = confetti[scheme];
  const tokens = schemeTokens(scheme);
  const light = isLightGround(scheme);
  const step = size + 8;
  const colours = [tokens.get('--colorAccent'), pieces[0], pieces[2], tokens.get('--colorPage')];

  return (
    <svg
      className="scheme-dots"
      width={4 + 4 * size + 3 * 8}
      height={size + 4}
      aria-hidden="true"
      focusable="false"
    >
      {colours.map((colour, index) => (
        <g key={index}>
          <circle
            cx={2 + size / 2 + index * step}
            cy={2 + size / 2}
            r={size / 2 + 1}
            fill="none"
            stroke={on}
            strokeOpacity={light ? 0.5 : 0.9}
            strokeWidth="2"
          />
          <circle cx={2 + size / 2 + index * step} cy={2 + size / 2} r={size / 2} fill={colour} />
        </g>
      ))}
    </svg>
  );
}

/** The palette mark on a scheme's tile: drawn here, since the product's icon set has none. */
function PaletteGlyph() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.1}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z" />
      <circle cx={13.5} cy={6.5} r={0.5} />
      <circle cx={17.5} cy={10.5} r={0.5} />
      <circle cx={6.5} cy={12.5} r={0.5} />
      <circle cx={8.5} cy={7.5} r={0.5} />
    </svg>
  );
}

export function SchemeTile({ scheme }: { scheme: Scheme }) {
  return (
    <span
      className={isLightGround(scheme) ? 'desk-tile scheme-tile is-light' : 'desk-tile scheme-tile'}
      aria-hidden="true"
    >
      <Ground scheme={scheme} wash={false} />
      <Pieces scheme={scheme} art={TILE_ART} />
      <PaletteGlyph />
    </span>
  );
}

/** Personalisation's tile in the Settings list: a swatch of the person's own colours. */
export function PersonalTile() {
  return <SchemeTile scheme={useColourScheme().shown} />;
}
