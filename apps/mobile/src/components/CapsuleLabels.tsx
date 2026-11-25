import { type ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';

import { CAPSULE_LABEL, fittedLabelSize, pillGivesWay } from '../layout/capsuleFit.ts';
import { useMeasuredAt } from './Title.tsx';

export interface CapsuleLabels {
  /** The one size the capsule's labels are drawn at, undefined until the labels, the row and its end are measured, when the capsule is not drawn yet. */
  labelSize: number | undefined;
  /** The labels are under their own size, so the pill beside them is its tile. */
  givesWay: boolean;
  /** The labels drawn unseen at their own size, to be measured; it goes in the row. */
  measure: ReactNode;
}

/** The size an upright tablet's capsule draws `labels` at in a row `rowWidth` wide, its end `end` wide as laid out (sc-40401, sc-91290). */
export function useCapsuleLabels(
  labels: readonly string[],
  rowWidth: number,
  end: number | undefined,
): CapsuleLabels {
  const { fontScale } = useWindowDimensions();
  const { widths, measure } = useMeasuredAt(CAPSULE_LABEL * fontScale, labels);
  const labelSize = fittedLabelSize(fontScale, widths, rowWidth, end);

  return {
    labelSize,
    givesWay: labelSize != null && pillGivesWay(fontScale, labelSize),
    measure,
  };
}

/** How far past the default a capsule's label may grow so it is drawn at `labelSize`. */
export function capsuleLabelMultiplier(labelSize: number | undefined): number | undefined {
  return labelSize == null ? undefined : Math.max(1, labelSize / CAPSULE_LABEL);
}
