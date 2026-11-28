import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

const EVEN_BUILD: Clipboard.GetImageOptions = { format: 'png', jpegQuality: 1 };
const ODD_BUILD: Clipboard.GetImageOptions = { format: 'png', jpegQuality: 0.99 };

/** expo-clipboard sets the control's target before its paste configuration; a later prop change rebuilds it with both in place. */
export function useRebuiltPaste() {
  const [build, setBuild] = useState(0);
  useEffect(() => {
    const again = () => setBuild((was) => was + 1);
    again();
    const resumed = AppState.addEventListener('change', (state) => {
      if (state === 'active') again();
    });
    const copied = Clipboard.addClipboardListener(again);
    return () => {
      resumed.remove();
      copied.remove();
    };
  }, []);

  return build % 2 === 0 ? EVEN_BUILD : ODD_BUILD;
}
