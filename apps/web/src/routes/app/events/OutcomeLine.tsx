import { useContext, useEffect, useState } from 'react';

import { Arriving } from '../../../pageArrival.ts';

/** Where the page begins after Save changes; once the person has moved focus, it is announced instead (sc-11370). */
export function OutcomeLine({ words }: { words: string }) {
  const arriving = useContext(Arriving);
  const [taking] = useState(arriving);
  const [announced, setAnnounced] = useState('');

  useEffect(() => {
    if (taking) return;

    // Set after the region is in the page, so a screen reader hears the change rather than missing a region born full.
    const id = window.setTimeout(() => setAnnounced(words), 0);

    return () => window.clearTimeout(id);
  }, [taking, words]);

  return taking ? (
    <p className="event-page-outcome" tabIndex={-1} data-page-focus="">
      {words}
    </p>
  ) : (
    <p className={announced === '' ? 'visually-hidden' : 'event-page-outcome'} role="status">
      {announced}
    </p>
  );
}
