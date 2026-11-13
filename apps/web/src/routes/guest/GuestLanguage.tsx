import { LOCALES } from '@soirely/domain';
import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { chooseLanguage } from '../../accountLanguage.ts';
import { Glyph } from '../../components/Glyph.tsx';
import { currentLocale } from '../../i18n/index.ts';
import { useSessionState } from '../../session.ts';

/** The header's language button and its menu, as the guest demo draws them: the four in their own names, each with its lang. */
export function GuestLanguage() {
  const { t } = useTranslation();
  const signedIn = useSessionState().status === 'signedIn';
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const chosen = Math.max(
    0,
    LOCALES.findIndex((one) => one.code === currentLocale()),
  );
  const name = LOCALES[chosen]?.nativeName ?? '';

  useEffect(() => {
    if (!open) return;

    items.current[chosen]?.focus();
    const outside = (event: MouseEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', outside);

    return () => document.removeEventListener('mousedown', outside);
  }, [open, chosen]);

  function close(): void {
    setOpen(false);
    wrap.current?.querySelector<HTMLButtonElement>('.gp-lang')?.focus();
  }

  function onKey(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    const count = LOCALES.length;
    const to = (at: number) => {
      event.preventDefault();
      items.current[(at + count) % count]?.focus();
    };

    if (event.key === 'ArrowDown') to(index + 1);
    else if (event.key === 'ArrowUp') to(index - 1);
    else if (event.key === 'Home') to(0);
    else if (event.key === 'End') to(count - 1);
    else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'Tab') setOpen(false);
  }

  return (
    <div ref={wrap} className="gp-lang-wrap">
      <button
        className={open ? 'gp-lang is-open' : 'gp-lang'}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? 'gp-lang-menu' : undefined}
        aria-label={t('language.current', { language: name })}
        onClick={() => setOpen((was) => !was)}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown') return;
          event.preventDefault();
          setOpen(true);
        }}
      >
        <Glyph name="globe" size={18} weight={1.9} className="gp-lang-globe" />
        <span>{name}</span>
        <Glyph name="chevdown" size={14} weight={2.2} className="gp-lang-chev" />
      </button>
      {open && (
        <div className="gp-menu">
          <p id="gp-lang-title" className="gp-menu-title">
            {t('language.label')}
          </p>
          <div id="gp-lang-menu" role="menu" aria-labelledby="gp-lang-title">
            {LOCALES.map((one, index) => (
              <button
                key={one.code}
                ref={(item) => {
                  items.current[index] = item;
                }}
                className="gp-menu-item"
                type="button"
                role="menuitemradio"
                aria-checked={index === chosen}
                lang={one.code}
                tabIndex={-1}
                onClick={() => {
                  close();
                  void chooseLanguage(one.code, signedIn);
                }}
                onKeyDown={(event) => onKey(event, index)}
              >
                <span>{one.nativeName}</span>
                {index === chosen && <Glyph name="tick" size={18} weight={2.6} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
