import { LOCALES } from '@soirely/domain';
import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]';

const LANGUAGES = LOCALES.map(({ code, name, nativeName }) => ({
  code,
  name: nativeName,
  english: name === nativeName ? null : name,
}));

/** The item a menu's arrow keys land on, going round at either end. */
function nextItem(current: number, key: 'ArrowUp' | 'ArrowDown', count: number): number {
  return (current + (key === 'ArrowDown' ? 1 : -1) + count) % count;
}

/** The WAI-ARIA menu button, opening upward from the footer of a signed-out page. */
export function LanguageMenu({
  current: code,
  onChoose,
}: {
  current: string;
  onChoose: (code: string) => void;
}) {
  const { t } = useTranslation();
  const chosen = Math.max(
    0,
    LANGUAGES.findIndex((language) => language.code === code),
  );
  const current = LANGUAGES[chosen]?.name ?? '';
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
      if (target instanceof Element && target.closest(FOCUSABLE)) return;

      event.preventDefault();
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
    <div className="language-menu">
      <button
        ref={button}
        className="language-menu-button"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? 'language-menu-list' : undefined}
        aria-label={t('language.current', { language: current })}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={onButtonKey}
      >
        <GlobeMark />
        <span>{current}</span>
        <ChevronMark />
      </button>

      {open && (
        <div ref={menu} className="language-menu-popup">
          <div className="language-menu-heading">
            <span className="language-menu-title" id="language-menu-title">
              {t('language.label')}
            </span>
            <span className="language-menu-line">{t('language.follows')}</span>
          </div>
          <div id="language-menu-list" role="menu" aria-labelledby="language-menu-title">
            {LANGUAGES.map((language, index) => (
              <button
                key={language.code}
                ref={(item) => {
                  items.current[index] = item;
                }}
                className="language-menu-item"
                type="button"
                role="menuitemradio"
                aria-checked={index === chosen}
                lang={language.code}
                tabIndex={-1}
                onClick={() => {
                  close();
                  onChoose(language.code);
                }}
                onKeyDown={(event) => onMenuKey(event, index)}
              >
                <span className="language-menu-names">
                  <span>{language.name}</span>
                  {language.english != null && (
                    <span className="language-menu-english" lang="en">
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
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      className="language-menu-stroke"
    >
      <circle cx="12" cy="12" r="9.5" />
      <path d="M2.5 12h19M12 2.5c2.6 2.6 3.9 5.8 3.9 9.5s-1.3 6.9-3.9 9.5c-2.6-2.6-3.9-5.8-3.9-9.5s1.3-6.9 3.9-9.5z" />
    </svg>
  );
}

function ChevronMark() {
  return (
    <svg
      aria-hidden="true"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      className="language-menu-stroke"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function TickMark() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      className="language-menu-tick"
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}
