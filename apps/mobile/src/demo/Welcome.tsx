import type { ReactNode } from 'react';

import { PageFrame, WelcomeFrame as CoverFrame } from '../components/Welcome.tsx';

export { coverLine, useCoverStatusBar } from '../components/Welcome.tsx';

/** The app's cover frame, or without `cover` the brand on the page, as the join link draws it. */
export function WelcomeFrame({
  top,
  brand,
  choices,
  cover = false,
}: {
  top?: ReactNode;
  brand: ReactNode;
  choices: ReactNode;
  cover?: boolean;
}) {
  if (cover) return <CoverFrame top={top} brand={brand} choices={choices} />;

  return <PageFrame top={top} brand={brand} choices={choices} />;
}
