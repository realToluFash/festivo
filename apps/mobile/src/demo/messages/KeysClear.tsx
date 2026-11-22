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
  const own = useRef<ViewInstance>(null);
  const top = useRef<number | null>(keyboardTopNow(0));
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
    const shown = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (event) => {
      top.current = keyboardInWindow(event.endCoordinates.screenY, 0);
      measure();
    });
    const hidden = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      top.current = null;
      measure();
    });
    measure();

    return () => {
      shown.remove();
      hidden.remove();
    };
  }, [measure]);

  return (
    <View ref={own} onLayout={measure} style={[style, { paddingBottom: cover }]}>
      {children}
    </View>
  );
}
