import { useContext, useState } from 'react';

import {
  type SideFit,
  type SideRoom,
  lettersIn,
  sideStart,
  sideTextSize,
} from '../layout/sidebarSize.ts';
import { SIDE_WIDTHS } from '../layout/sideWidths.ts';
import { piecesIn, wordsIn, wrapOf } from '../layout/textSize.ts';
import type { WeightName } from '../theme/fonts.ts';
import { TitleCap } from './Text.tsx';
import { MeasuredWords } from './Title.tsx';

/** A text's size in iPad landscape's sidebar at `scale`, from its words measured hidden at the size it starts from (sc-68441), as any sidebar last measured them (sc-90463). */
export function useSideFit(
  text: string,
  room: SideRoom,
  scale: number,
  weight: WeightName,
  fit: SideFit = 'label',
) {
  const cap = useContext(TitleCap);
  const start = sideStart(room, scale, cap);
  const words = wordsIn([text]);
  const pieces = fit === 'lines' ? piecesIn([text]) : [];
  const [, setReadings] = useState(0);
  const width = (piece: string) => SIDE_WIDTHS.width(start, weight, piece);
  const whole = width(`\n${text}`);
  const widths: Record<string, number> = {};
  for (const piece of [...words, ...pieces]) {
    const read = width(piece);
    if (read != null) widths[piece] = read;
  }
  const known = whole != null && [...words, ...pieces].every((piece) => widths[piece] != null);
  const size = sideTextSize(
    room,
    scale,
    known
      ? {
          words: words.map((word) => ({ width: widths[word] ?? 0, letters: lettersIn(word) })),
          whole: { width: whole, letters: lettersIn(text) },
          ...(fit === 'lines' ? { wrap: wrapOf(text, widths, whole) } : {}),
        }
      : null,
    fit,
    cap,
  );
  const keep = (piece: string, read: number) => {
    if (SIDE_WIDTHS.keep(start, weight, piece, read)) setReadings((readings) => readings + 1);
  };

  return {
    size,
    measure: (
      <>
        <MeasuredWords
          words={[...words, ...pieces]}
          size={start}
          weight={weight}
          allowFontScaling={false}
          onWidth={keep}
        />
        <MeasuredWords
          words={[text]}
          size={start}
          weight={weight}
          allowFontScaling={false}
          onWidth={(_, width) => keep(`\n${text}`, width)}
        />
      </>
    ),
  };
}
