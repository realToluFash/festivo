import { initials } from '@soirely/domain';

import { Text, type TextProps } from './Text.tsx';

/** A name's initials in a tile, never read: the name beside them already is (sc-10712). */
export function Initials({
  name,
  ...rest
}: Omit<TextProps, 'children' | 'accessible'> & { name: string }) {
  // iOS asks a Text for its items by `accessible` alone, so hiding the tile still lets it report itself on some opens.
  return (
    <Text {...rest} accessible={false}>
      {initials(name)}
    </Text>
  );
}
