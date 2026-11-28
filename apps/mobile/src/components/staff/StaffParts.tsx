import type { StaffLink } from '@soirely/api-client';
import { StyleSheet, View } from 'react-native';

import { tokens } from '../../theme/tokens.ts';
import { ShapeMark } from '../StatusMark.tsx';

/** Each status a shape beside its word, as on the web: a dashed ring, a half ring, a ring, a filled tick; an amber ring with no number, a grey one after the erasure. */
export function LinkMark({ link, side = 16 }: { link: StaffLink; side?: number }) {
  if (link === 'no_mobile' || link === 'erased')
    return (
      <ShapeMark
        kind="notyet"
        side={side}
        ink={link === 'no_mobile' ? tokens.colorAttention : tokens.colorInkTertiary}
      />
    );
  if (link === 'none')
    return (
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.dashed, { width: side, height: side, borderRadius: side / 2 }]}
      />
    );
  const kind = link === 'opened' ? 'yes' : link === 'sent' ? 'notyet' : 'waiting';

  return <ShapeMark kind={kind} side={side} ink={tokens.colorAccent} />;
}

const styles = StyleSheet.create({
  dashed: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: tokens.colorInkSecondary,
  },
});
