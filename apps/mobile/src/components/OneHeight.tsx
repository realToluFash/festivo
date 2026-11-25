import { type ReactNode, createContext, useContext, useMemo, useState } from 'react';
import {
  type LayoutChangeEvent,
  type StyleProp,
  View,
  type ViewStyle,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { reportHeight, tallestAt } from './oneHeight.ts';

interface Group {
  at: string;
  tallest: number | undefined;
  report: (event: LayoutChangeEvent) => void;
}

const OneHeightGroup = createContext<Group | null>(null);

/** Buttons that stand together, each as tall as the tallest one's own height: nothing fixed, nothing shrunk (sc-84920). */
export function OneHeight({
  style,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const outer = useContext(OneHeightGroup);
  const { fontScale, width } = useWindowDimensions();
  const { i18n } = useTranslation();
  const at = `${fontScale}|${width}|${i18n.language}`;
  const [tallest, setTallest] = useState({ at, height: 0 });
  const group = useMemo<Group>(
    () => ({
      at,
      tallest: tallestAt(tallest, at),
      report: (event) => {
        const { height } = event.nativeEvent.layout;
        setTallest((now) => reportHeight(now, at, height));
      },
    }),
    [tallest, at],
  );
  const inner = <View style={style}>{children}</View>;

  return outer == null ? (
    <OneHeightGroup.Provider value={group}>{inner}</OneHeightGroup.Provider>
  ) : (
    inner
  );
}

/** A button's part in the `OneHeight` around it; outside one, nothing. */
export function useOneHeight(): {
  key: string | undefined;
  style: ViewStyle | undefined;
  onLayout: ((event: LayoutChangeEvent) => void) | undefined;
} {
  const group = useContext(OneHeightGroup);

  return {
    // Held at the tallest, a button would never report a shorter height of its own, and onLayout fires only on a frame change,
    // so a new size, width or language remounts the button's own frame to report afresh, keeping the state of whatever holds it.
    key: group?.at,
    style: group?.tallest == null ? undefined : { minHeight: group.tallest },
    onLayout: group?.report,
  };
}
