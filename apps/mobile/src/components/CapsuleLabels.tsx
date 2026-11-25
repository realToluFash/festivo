import { type ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';

import {
  CAPSULE_LABEL,
  capsuleLabelSize,
  capsuleRoom,
  pillGivesWay,
} from '../layout/capsuleFit.ts';
import { useMeasuredAt } from './Title.tsx';

export interface CapsuleLabels {
  /** The one size the capsule's labels are drawn at. */
  labelSize: number;
  /** The labels are under their own size, so the pill beside them is its tile. */
  givesWay: boolean;
  /** The labels drawn unseen at their own size, to be measured; it goes in the row. */
  measure: ReactNode;
}

/** The size an upright tablet's capsule draws `labels` at in a row `rowWidth` wide from the tile's edge to the bell's, its end `end` wide (sc-40401). */
export function useCapsuleLabels(
  labels: readonly string[],
  rowWidth: number,
  end = 0,
): CapsuleLabels {
  const { fontScale } = useWindowDimensions();
  const start = CAPSULE_LABEL * fontScale;
  const { widths, measure } = useMeasuredAt(start, labels);
  const total = widths.every((width) => width != null)
    ? widths.reduce<number>((sum, width) => sum + (width ?? 0), 0)
    : 0;
  const labelSize = capsuleLabelSize(
    fontScale,
    labels.length,
    total,
    rowWidth > 0 ? capsuleRoom(rowWidth, end) : 0,
  );

  return {
    labelSize,
    givesWay: pillGivesWay(fontScale, labelSize),
    measure,
  };
}

/** How far past the default a capsule's label may grow so it is drawn at `labelSize`. */
export function capsuleLabelMultiplier(labelSize: number | undefined): number | undefined {
  return labelSize == null ? undefined : Math.max(1, labelSize / CAPSULE_LABEL);
}
