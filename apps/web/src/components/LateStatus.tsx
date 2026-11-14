import { type ReactNode, useEffect, useRef, useState } from 'react';

/** In the page empty and filled a moment later: VoiceOver skips a status added with its words already inside. */
export function LateStatus({
  words,
  className,
  mark,
  onShown,
}: {
  words: string;
  className: string;
  mark?: ReactNode;
  onShown?: () => void;
}) {
  const [shown, setShown] = useState('');
  const shownCallback = useRef(onShown);

  useEffect(() => {
    shownCallback.current = onShown;
  });

  useEffect(() => {
    const id = window.setTimeout(() => setShown(words), 0);

    return () => window.clearTimeout(id);
  }, [words]);

  useEffect(() => {
    if (shown !== '') shownCallback.current?.();
  }, [shown]);

  return (
    <div className={shown === '' ? 'visually-hidden' : className} role="status">
      {shown !== '' && (
        <>
          {mark}
          <p>{shown}</p>
        </>
      )}
    </div>
  );
}
