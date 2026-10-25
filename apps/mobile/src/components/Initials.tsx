import { initials } from '@soirely/domain';

import { Text, type TextProps } from './Text.tsx';

/** A name's initials in a tile, never read: the name beside them already is (sc-10712). */
export function Initials({
  name,
  ...rest
}: Omit<
  TextProps,
  'children' | 'accessible' | 'accessibilityElementsHidden' | 'importantForAccessibility'
> & { name: string }) {
  // iOS asks a Text for its items by `accessible` alone, and a tile mounted while its screen is open can escape the View's hiding, so the Text hides itself too.
  return (
    <Text {...rest} accessible={false} accessibilityElementsHidden importantForAccessibility="no">
      {initials(name)}
    </Text>
  );
}
