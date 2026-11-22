import { router } from 'expo-router';
import { type ReactNode, type RefObject, useCallback, useRef, useState } from 'react';
import type { ViewInstance } from 'react-native';

import { useLayout } from '../layout/useLayout.ts';
import { NotificationsFeed } from './NotificationsFeed.tsx';
import { type Anchor, anchorUnder, useAnchorFollowsTurn } from './SummaryOverlays.tsx';

/** What a bell opens (sc-83081): on a phone Notifications, its own screen; on a tablet the popover under the bell, its right edge in line with the bell's, and focus back on the bell as it closes. */
export function useBellOpens(onPhone: () => void = () => router.push('/notifications')): {
  ref: RefObject<ViewInstance | null>;
  open: () => void;
  popover: ReactNode;
} {
  const { kind } = useLayout();
  const ref = useRef<ViewInstance>(null);
  const [at, setAt] = useState<Anchor | null>(null);
  const [shown, setShown] = useState(false);
  const tablet = kind !== 'phone';
  const close = useCallback(() => setAt(null), []);

  useAnchorFollowsTurn(ref, at != null, setAt);

  return {
    ref,
    open: () => {
      if (!tablet) {
        onPhone();
        return;
      }
      anchorUnder(ref, (under) => {
        setShown(true);
        setAt(under);
      });
    },
    popover:
      tablet && shown ? (
        <NotificationsFeed
          where={{ kind: 'popover', open: at != null, at, opener: ref, onClose: close }}
        />
      ) : null,
  };
}
