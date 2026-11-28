import type { RefObject } from 'react';
import type { ViewInstance } from 'react-native';

import { type Anchor, anchorUnder } from '../components/Summary.tsx';

/** A button not mounted yet answers null, so openOnceSettled keeps trying rather than stalling. */
export function measuredUnder(trigger: RefObject<ViewInstance | null>) {
  return (then: (now: Anchor | null) => void) =>
    trigger.current == null ? then(null) : anchorUnder(trigger, then);
}
