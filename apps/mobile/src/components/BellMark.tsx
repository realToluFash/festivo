import Svg, { Path } from 'react-native-svg';

import { tokens } from '../theme/tokens.ts';

/** The one bell outline, as the web's `BellMark` draws it; `slashed` crosses it out. */
export function BellMark({ ink, slashed = false }: { ink: string; slashed?: boolean }) {
  return (
    <Svg
      width={tokens.sizeMark}
      height={tokens.sizeMark}
      viewBox="0 0 24 24"
      fill="none"
      stroke={ink}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
      <Path d="M10 20.5a2 2 0 0 0 4 0" />
      {slashed && <Path d="M4 4l16 16" />}
    </Svg>
  );
}
