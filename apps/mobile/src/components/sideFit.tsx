import { useContext, useState } from 'react';

import {
  type SideFit,
  type SideRoom,
  lettersIn,
  sideStart,
  sideTextSize,
} from '../layout/sidebarSize.ts';
import { wordsIn } from '../layout/textSize.ts';
import type { WeightName } from '../theme/fonts.ts';
import { TitleCap } from './Text.tsx';
import { MeasuredWords } from './Title.tsx';

/** A text's size in iPad landscape's sidebar at `scale`, from its words measured hidden at the size it starts from (sc-68441). */
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
  const key = `${start}|${weight}|${text}`;
  const [measured, setMeasured] = useState<{ key: string; widths: Record<string, number> }>({
    key: '',
    widths: {},
  });
  const widths = measured.key === key ? measured.widths : {};
  const whole = widths[`\n${text}`];
  const known = whole != null && words.every((word) => widths[word] != null);
  const size = sideTextSize(
    room,
    scale,
    known
      ? {
          words: words.map((word) => ({ width: widths[word] ?? 0, letters: lettersIn(word) })),
          whole: { width: whole, letters: lettersIn(text) },
        }
      : null,
    fit,
    cap,
  );
  const keep = (name: string, width: number) =>
    setMeasured((now) => {
      const kept = now.key === key ? now.widths : {};

      return kept[name] === width ? now : { key, widths: { ...kept, [name]: width } };
    });

  return {
    size,
    measure: (
      <>
        <MeasuredWords
          words={words}
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
