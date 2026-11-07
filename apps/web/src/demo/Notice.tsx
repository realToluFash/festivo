import { type ReactNode, useEffect, useRef } from 'react';

import { Glyph } from './Glyph.tsx';

export type NoticeKind = 'done' | 'quiet' | 'attention' | 'broken';

/** main's notices, each a mark with its words. One that takes focus is read as it lands, so it is no live region. */
export function Notice({
  kind,
  lands = false,
  takesFocus = false,
  children,
}: {
  kind: NoticeKind;
  lands?: boolean;
  takesFocus?: boolean;
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (takesFocus) box.current?.focus();
  }, [takesFocus]);

  return (
    <div
      ref={box}
      className={`sw-notice is-${kind}${lands || takesFocus ? ' sw-lands' : ''}`}
      role={takesFocus ? undefined : kind === 'broken' || kind === 'attention' ? 'alert' : 'status'}
      tabIndex={lands || takesFocus ? -1 : undefined}
      data-lands={lands ? '' : undefined}
    >
      <span className="sw-notice-mark" aria-hidden="true">
        {kind === 'quiet' ? (
          <span className="sw-dash" />
        ) : kind === 'attention' ? (
          '!'
        ) : (
          <Glyph name={kind === 'done' ? 'tick' : 'clear'} size={15} weight={3} />
        )}
      </span>
      <p className="sw-notice-words">{children}</p>
    </div>
  );
}
