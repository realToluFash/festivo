import {
  type KeyboardEvent,
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { Glyph } from '../components/Glyph.tsx';
import { type Token, MW, TOKENS, tokenWord } from './messages.ts';
import { PW } from './messagesPreviewWords.ts';
import './messagesPreview.css';

const LINES: Record<Token, string> = {
  greeting: PW.insertGreeting,
  event: PW.insertEvent,
  date: PW.insertDate,
  hosts: PW.insertHosts,
};

function itemsIn(menu: HTMLElement | null): HTMLElement[] {
  return [...(menu?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? [])];
}

/** Insert (sc-3960): a menu of the four tokens, each its word as the chip draws it and its line; a pick goes back into the field. */
export function InsertMenu({
  first,
  onFirst,
  onPick,
}: {
  first: boolean;
  onFirst: () => void;
  onPick: (token: Token) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(first);
  const into = useRef(first);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLUListElement>(null);
  const seen = useEffectEvent(onFirst);

  useEffect(() => {
    if (first) seen();
  }, [first]);

  useLayoutEffect(() => {
    if (!open || !into.current) return;
    into.current = false;
    itemsIn(menu.current)[0]?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const outside = (event: PointerEvent) => {
      const target = event.target as Node;

      if (!menu.current?.contains(target) && !button.current?.contains(target)) setOpen(false);
    };

    document.addEventListener('pointerdown', outside);

    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  function close(back: boolean): void {
    setOpen(false);
    if (back) button.current?.focus();
  }

  function keys(event: KeyboardEvent<HTMLElement>, at: number): void {
    const all = itemsIn(menu.current);

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;

        all[(at + step + all.length) % all.length]?.focus();
        return;
      }
      case 'Home':
      case 'End':
        event.preventDefault();
        (event.key === 'Home' ? all[0] : all.at(-1))?.focus();
        return;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        close(true);
        return;
      case 'Tab':
        close(false);
        return;
      default:
    }
  }

  return (
    <div className="mg-insert-at">
      <button
        ref={button}
        type="button"
        className="desk-text"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        data-focus="insert"
        onClick={() => {
          into.current = !open;
          setOpen(!open);
        }}
        onKeyDown={(event) => {
          if (open || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return;
          event.preventDefault();
          into.current = true;
          setOpen(true);
        }}
      >
        <Glyph name="braces" size={17} weight={2.2} />
        {MW.insert}
      </button>
      {open && (
        <ul
          ref={menu}
          id={`${id}-menu`}
          role="menu"
          aria-label={MW.insert}
          className="mg-pop mg-insert-list"
        >
          {TOKENS.map((token, at) => (
            <li key={token} role="none">
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                aria-label={tokenWord(token)}
                aria-describedby={`${id}-${token}`}
                className="mg-insert-row"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setOpen(false);
                  onPick(token);
                }}
                onKeyDown={(event) => keys(event, at)}
              >
                <span className="mg-token" aria-hidden="true">
                  {tokenWord(token)}
                </span>
                <span id={`${id}-${token}`} className="mg-insert-line">
                  {LINES[token]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
