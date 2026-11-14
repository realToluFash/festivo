import { LOCALES } from '@soirely/domain';
import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Glyph } from './Glyph.tsx';

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]';

const LANGUAGES = LOCALES.map(({ code, name, nativeName }) => ({
  code,
  name: nativeName,
  english: name === nativeName ? null : name,
}));

/** The item a menu key lands on, arrows going round at either end. */
function itemFor(key: string, current: number, count: number): number | null {
  if (key === 'ArrowDown') return (current + 1) % count;
  if (key === 'ArrowUp') return (current - 1 + count) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;

  return null;
}

type Look = 'footer' | 'guest';

const LOOKS: Record<
  Look,
  {
    wrap: string;
    button: string;
    popup: string;
    list: string;
    item: string;
    globe: ReactNode;
    chevron: ReactNode;
    tick: ReactNode;
  }
> = {
  footer: {
    wrap: 'language-menu',
    button: 'language-menu-button',
    popup: 'language-menu-popup',
    list: 'language-menu-list',
    item: 'language-menu-item',
    globe: <GlobeMark />,
    chevron: <ChevronMark />,
    tick: <TickMark />,
  },
  guest: {
    wrap: 'gp-lang-wrap',
    button: 'gp-lang',
    popup: 'gp-menu',
    list: 'gp-lang-menu',
    item: 'gp-menu-item',
    globe: <Glyph name="globe" size={18} weight={1.9} className="gp-lang-globe" />,
    chevron: <Glyph name="chevdown" size={14} weight={2.2} className="gp-lang-chev" />,
    tick: <Glyph name="tick" size={18} weight={2.6} />,
  },
};

/** The WAI-ARIA menu button: upward from a signed-out page's footer, or the guest page's header button. */
export function LanguageMenu({
  current: code,
  onChoose,
  look = 'footer',
}: {
  current: string;
  onChoose: (code: string) => void;
  look?: Look;
}) {
  const parts = LOOKS[look];
  const guest = look === 'guest';
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
    const to = itemFor(event.key, index, LANGUAGES.length);
    if (to != null) {
      event.preventDefault();
      items.current[to]?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  }

  return (
    <div className={parts.wrap}>
      <button
        ref={button}
        className={guest && open ? `${parts.button} is-open` : parts.button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? parts.list : undefined}
        aria-label={t('language.current', { language: current })}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={onButtonKey}
      >
        {parts.globe}
        <span>{current}</span>
        {parts.chevron}
      </button>

      {open && (
        <div ref={menu} className={parts.popup}>
          {guest ? (
            <p id={`${parts.list}-title`} className="gp-menu-title">
              {t('language.label')}
            </p>
          ) : (
            <div className="language-menu-heading">
              <span className="language-menu-title" id={`${parts.list}-title`}>
                {t('language.label')}
              </span>
              <span className="language-menu-line">{t('language.follows')}</span>
            </div>
          )}
          <div id={parts.list} role="menu" aria-labelledby={`${parts.list}-title`}>
            {LANGUAGES.map((language, index) => (
              <button
                key={language.code}
                ref={(item) => {
                  items.current[index] = item;
                }}
                className={parts.item}
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
                {guest ? (
                  <span>{language.name}</span>
                ) : (
                  <span className="language-menu-names">
                    <span>{language.name}</span>
                    {language.english != null && (
                      <span className="language-menu-english" lang="en">
                        {language.english}
                      </span>
                    )}
                  </span>
                )}
                {index === chosen && parts.tick}
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
