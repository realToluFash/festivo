import { type KeyboardEvent, useEffect, useRef, useState } from 'react';

import { LANGUAGES, nextItem } from './rules.ts';

/** The WAI-ARIA menu button. Choosing renames the button only: the demo's words stay English. */
export function LanguageMenu() {
  const [chosen, setChosen] = useState(0);
  const current = LANGUAGES[chosen] ?? LANGUAGES[0];
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;

    items.current[chosen]?.focus();

    const outside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menu.current?.contains(target) || button.current?.contains(target)) return;

      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener('mousedown', outside);

    return () => document.removeEventListener('mousedown', outside);
  }, [open, chosen]);

  function close(): void {
    setOpen(false);
    button.current?.focus();
  }

  function onButtonKey(event: KeyboardEvent<HTMLButtonElement>): void {
    if (event.key !== 'ArrowDown') return;

    event.preventDefault();
    setOpen(true);
  }

  function onMenuKey(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      items.current[nextItem(index, event.key, LANGUAGES.length)]?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  }

  return (
    <div className="demo-language">
      <button
        ref={button}
        className="demo-language-button"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? 'demo-language-menu' : undefined}
        aria-label={`Language: ${current.name}`}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={onButtonKey}
      >
        <GlobeMark />
        <span>{current.name}</span>
        <ChevronMark />
      </button>

      {open && (
        <div ref={menu} className="demo-language-menu">
          <div className="demo-language-heading">
            <span className="demo-language-title" id="demo-language-title">
              Language
            </span>
            <span className="demo-language-line">Your language follows you to every device.</span>
          </div>
          <div id="demo-language-menu" role="menu" aria-labelledby="demo-language-title">
            {LANGUAGES.map((language, index) => (
              <button
                key={language.code}
                ref={(item) => {
                  items.current[index] = item;
                }}
                className="demo-language-item"
                type="button"
                role="menuitemradio"
                aria-checked={index === chosen}
                lang={language.code}
                tabIndex={-1}
                onClick={() => {
                  setChosen(index);
                  close();
                }}
                onKeyDown={(event) => onMenuKey(event, index)}
              >
                <span className="demo-language-names">
                  <span>{language.name}</span>
                  {language.english != null && (
                    <span className="demo-language-english" lang="en">
                      {language.english}
                    </span>
                  )}
                </span>
                {index === chosen && <TickMark />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GlobeMark() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" className="demo-stroke">
      <circle cx="12" cy="12" r="9.5" />
      <path d="M2.5 12h19M12 2.5c2.6 2.6 3.9 5.8 3.9 9.5s-1.3 6.9-3.9 9.5c-2.6-2.6-3.9-5.8-3.9-9.5s1.3-6.9 3.9-9.5z" />
    </svg>
  );
}

function ChevronMark() {
  return (
    <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" className="demo-stroke">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function TickMark() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" className="demo-tick">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}
