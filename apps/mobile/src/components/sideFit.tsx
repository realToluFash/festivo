import { useContext, useSyncExternalStore } from 'react';

import { type SideFit, type SideRoom, sideStart, sideTextSize } from '../layout/sidebarSize.ts';
import { SIDE_WIDTHS, sideReadings } from '../layout/sideWidths.ts';
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
  useSyncExternalStore(SIDE_WIDTHS.subscribe, SIDE_WIDTHS.version);
  const { pieces, read } = sideReadings(SIDE_WIDTHS, text, start, weight, fit);
  const size = sideTextSize(room, scale, read, fit, cap);
  const keep = (piece: string, width: number) => SIDE_WIDTHS.keep(start, weight, piece, width);

  return {
    size,
    measure: (
      <>
        <MeasuredWords
          words={pieces}
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
