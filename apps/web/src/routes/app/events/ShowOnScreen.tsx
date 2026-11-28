import { type ScreenLink } from '@soirely/api-client';
import { formatWallClock, wallOfZoned } from '@soirely/domain';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { Glyph } from '../../../components/Glyph.tsx';
import { useDialogKeys } from '../../../dialogFocus.ts';
import { dateLocale } from '../../../i18n/index.ts';
import './showOnScreen.css';

interface Said {
  words: string;
  done: boolean;
}

/** The address a TV or projector opens, on this web's own origin. */
function screenUrl(token: string): string {
  return `${window.location.origin}/s/${token}`;
}

/** sc-3897's Show on a screen: one room screen link per place, each with Copy screen link, Open here and Replace link. */
export function ShowOnScreen({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const keep = useRef<HTMLButtonElement>(null);
  const [links, setLinks] = useState<ScreenLink[]>([]);
  const [load, setLoad] = useState<'loading' | 'failed' | 'loaded'>('loading');
  const [round, setRound] = useState(0);
  const [asking, setAsking] = useState<string | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [said, setSaid] = useState<Said | null>(null);
  const main = t('schedule.main');
  const named = (link: ScreenLink) => link.place ?? main;
  const keyOf = (link: ScreenLink) => link.place ?? '';

  useDialogKeys(dialog, onClose, false);

  useEffect(() => {
    title.current?.focus();
  }, []);

  useEffect(() => {
    let current = true;

    api.screenLinks(eventId).then(
      (answer) => {
        if (!current) return;
        setLinks(answer);
        setLoad('loaded');
      },
      () => {
        if (current) setLoad('failed');
      },
    );

    return () => {
      current = false;
    };
  }, [eventId, round]);

  const asked = useRef<string | null>(null);

  useEffect(() => {
    if (asking != null) keep.current?.focus();
    else if (asked.current != null) document.getElementById(replaceId(asked.current))?.focus();
    asked.current = asking;
  }, [asking]);

  function tryAgain() {
    setLoad('loading');
    setRound((was) => was + 1);
    title.current?.focus();
  }

  function copy(link: ScreenLink) {
    const place = named(link);
    const done = () => setSaid({ words: t('showOnScreen.copied', { place }), done: true });
    const refused = () => {
      setSaid({ words: t('showOnScreen.copyRefused', { place }), done: false });
      selectLink(keyOf(link));
    };

    if (navigator.clipboard == null) refused();
    else navigator.clipboard.writeText(screenUrl(link.token)).then(done, refused);
  }

  function replace(link: ScreenLink) {
    const place = named(link);

    setReplacing(true);
    api.replaceScreenLink(eventId, link.place).then(
      (answer) => {
        setLinks(answer);
        setAsking(null);
        setReplacing(false);
        setSaid({ words: t('showOnScreen.replacedSaid', { place }), done: true });
      },
      () => {
        setReplacing(false);
        setAsking(null);
        setSaid({ words: t('showOnScreen.replaceFailed', { place }), done: false });
      },
    );
  }

  return (
    <>
      <div className="dialog-scrim" aria-hidden="true" onClick={onClose} />
      <div
        ref={dialog}
        className="dialog ss-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ss-title"
        aria-describedby="ss-line"
      >
        <div className="dialog-heading">
          <h2 id="ss-title" ref={title} tabIndex={-1}>
            {t('showOnScreen.title')}
          </h2>
          <p id="ss-line" className="ss-line">
            {t('showOnScreen.line')}
          </p>
        </div>
        {load === 'loading' && (
          <ul className="ss-rows skeleton-rows" aria-hidden="true">
            {[0, 1, 2].map((row) => (
              <li key={row} className="skeleton-row skeleton-row-76">
                <span className="skeleton-row-bars">
                  <span className="skeleton-bar skeleton-bar-first" />
                  <span className="skeleton-bar skeleton-bar-second" />
                </span>
              </li>
            ))}
          </ul>
        )}
        {load === 'loaded' && links.length > 0 && (
          <ul className="ss-rows">
            {links.map((link, at) => {
              const place = named(link);
              const id = `ss-place-${at}`;

              return (
                <li key={keyOf(link)} className="ss-row" aria-labelledby={id}>
                  <div className="ss-what">
                    <h3 id={id} className="ss-place" dir="auto">
                      {place}
                    </h3>
                    <p id={linkId(keyOf(link))} className="ss-link">
                      {screenUrl(link.token)}
                    </p>
                    {link.replacedAt != null && (
                      <p className="ss-replaced">
                        <Glyph name="tick" size={15} weight={2.6} />
                        {t('showOnScreen.replacedAt', {
                          time: formatWallClock(wallOfZoned(link.replacedAt), dateLocale()),
                        })}
                      </p>
                    )}
                  </div>
                  {asking === keyOf(link) ? (
                    <div className="ss-ask" role="group" aria-labelledby={`${id}-ask`}>
                      <p id={`${id}-ask`} className="ss-ask-title">
                        {t('showOnScreen.replaceTitle', { place })}
                      </p>
                      <p className="ss-line">{t('showOnScreen.replaceBody')}</p>
                      <div className="ss-acts">
                        <button
                          type="button"
                          className="link-button"
                          ref={keep}
                          onClick={() => setAsking(null)}
                        >
                          {t('showOnScreen.keep')}
                        </button>
                        <button
                          type="button"
                          className="gs-pill is-secondary"
                          disabled={replacing}
                          onClick={() => replace(link)}
                        >
                          {t('showOnScreen.replace')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="ss-acts">
                      <button
                        type="button"
                        className="gs-pill is-secondary"
                        onClick={() => copy(link)}
                      >
                        <Glyph name="copy" size={16} weight={2.2} />
                        {t('showOnScreen.copy')}
                      </button>
                      <a className="gs-pill is-secondary" href={screenUrl(link.token)}>
                        {t('showOnScreen.openHere')}
                      </a>
                      <button
                        type="button"
                        id={replaceId(keyOf(link))}
                        className="gs-pill is-secondary"
                        onClick={() => {
                          setSaid(null);
                          setAsking(keyOf(link));
                        }}
                      >
                        {t('showOnScreen.replace')}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <div className="ss-status">
          <p className={saidClass(load, said)} role="status">
            {load === 'loading' && t('showOnScreen.loading')}
            {load === 'failed' && t('showOnScreen.failed')}
            {load === 'loaded' && said != null && (
              <>
                {said.done && <Glyph name="tick" size={17} weight={2.6} />}
                {said.words}
              </>
            )}
          </p>
          {load === 'failed' && (
            <button type="button" className="link-button" onClick={tryAgain}>
              {t('showOnScreen.tryAgain')}
            </button>
          )}
        </div>
        <div className="dialog-actions">
          <button type="button" className="gs-pill is-secondary" onClick={onClose}>
            {t('showOnScreen.close')}
          </button>
        </div>
      </div>
    </>
  );
}

function saidClass(load: 'loading' | 'failed' | 'loaded', said: Said | null): string {
  if (load === 'loading') return 'ss-said is-quiet';
  if (load === 'failed' || said?.done === false) return 'ss-said is-ink';

  return 'ss-said';
}

function replaceId(key: string): string {
  return `ss-replace-${encodeURIComponent(key)}`;
}

function linkId(key: string): string {
  return `ss-link-${encodeURIComponent(key)}`;
}

/** A refused clipboard leaves the link selected, so Ctrl+C or Command+C copies it (as Share does). */
function selectLink(key: string) {
  const link = document.getElementById(linkId(key));
  const selection = window.getSelection();

  if (link == null || selection == null) return;
  const range = document.createRange();

  range.selectNodeContents(link);
  selection.removeAllRanges();
  selection.addRange(range);
}
