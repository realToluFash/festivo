import { useContext, useState } from 'react';

import { LateStatus } from '../../../components/LateStatus.tsx';
import { Arriving } from '../../../pageArrival.ts';

/** Where the page begins after Save changes; once the person has moved focus, it is announced instead (sc-11370). */
export function OutcomeLine({ words }: { words: string }) {
  const arriving = useContext(Arriving);
  const [taking] = useState(arriving);

  return taking ? (
    <p className="event-page-outcome" tabIndex={-1} data-page-focus="">
      {words}
    </p>
  ) : (
    <LateStatus className="event-page-outcome" words={words} />
  );
}
