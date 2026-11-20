import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';

/** The A4 sheet renders only while the browser prints, from the header's Print or the browser's own. */
export function usePrint(): { printing: boolean; print: () => void } {
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    const before = () => flushSync(() => setPrinting(true));
    const after = () => setPrinting(false);

    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);

    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);

  return {
    printing,
    print: () => {
      flushSync(() => setPrinting(true));
      window.print();
    },
  };
}
