import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Platform,
  type StyleProp,
  View,
  type ViewInstance,
  type ViewStyle,
} from 'react-native';

import { keyboardTopNow } from '../../components/keyboardWatch.ts';
import { SETTLED_MS, useWindowOrigin } from '../../components/Screen.tsx';
import { keyboardInWindow, keysOver } from '../../kit/keyboard.ts';

// Not KeyboardAvoidingView: it reads its frame from its parent, and a conversation sits below the event's
// header and beside the list, so it padded for a fraction of the keys and the composer stayed under them (sc-31370).
export function KeysClear({
  style,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const origin = useWindowOrigin();
  const own = useRef<ViewInstance>(null);
  const top = useRef<number | null>(null);
  const [cover, setCover] = useState(0);
  const measure = useCallback(() => {
    const keys = top.current;
    if (keys == null) {
      setCover(0);
      return;
    }
    own.current?.measureInWindow((_x, y, _width, height) =>
      setCover(keysOver({ y, height }, keys)),
    );
  }, []);

  useEffect(() => {
    const ios = Platform.OS === 'ios';
    top.current = keyboardTopNow(origin);
    const shown = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (event) => {
      top.current = keyboardInWindow(event.endCoordinates.screenY, origin);
      measure();
    });
    const hidden = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      top.current = null;
      measure();
    });
    measure();
    const settled = setTimeout(measure, SETTLED_MS);

    return () => {
      clearTimeout(settled);
      shown.remove();
      hidden.remove();
    };
  }, [origin, measure]);

  return (
    <View ref={own} onLayout={measure} style={[style, { paddingBottom: cover }]}>
      {children}
    </View>
  );
}
