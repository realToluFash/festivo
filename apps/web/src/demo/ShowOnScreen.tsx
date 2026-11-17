import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import { useDialogKeys } from '../dialogFocus.ts';
import {
  type ScreenPlace,
  SCREEN_PLACES,
  SCREEN_START,
  SHOW_WORDS as W,
  screenAt,
  screenLinkOf,
  screenTime,
} from './roomScreen.ts';
import type { ScreensStart } from './schedule.ts';
import { useLoad } from './useDataControl.ts';
import './showOnScreen.css';

interface Said {
  words: string;
  copied: boolean;
}

/** sc-3897's Show on a screen: one screen link per place, each with Copy screen link, Open here and Replace link. */
export function ShowOnScreen({ start, onClose }: { start: ScreensStart; onClose: () => void }) {
  const dialog = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const [rounds, setRounds] = useState<Partial<Record<ScreenPlace, number>>>(
    start === 'replaced' ? { Ballroom: 1 } : {},
  );
  const [asking, setAsking] = useState<ScreenPlace | null>(start === 'replace' ? 'Ballroom' : null);
  const [said, setSaid] = useState<Said | null>(() => {
    if (start === 'replaced') return { words: W.replacedSaid('Ballroom'), copied: true };
    if (start === 'refused') return { words: W.copyRefused('Ballroom'), copied: false };
    if (start === 'replaceFailed') return { words: W.notReplaced('Ballroom'), copied: false };

    return null;
  });
  const [load, retry] = useLoad(
    start === 'loading' ? 'loading' : start === 'failed' ? 'failed' : 'loaded',
  );

  useDialogKeys(dialog, onClose, false);
  const keep = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (start === 'replaceFailed') document.getElementById('ss-ballroom-replace')?.focus();
    else title.current?.focus();
    if (start === 'refused') selectLink('Ballroom');
  }, [start]);
  useEffect(() => {
    if (asking != null) keep.current?.focus();
  }, [asking]);

  function copy(place: ScreenPlace) {
    const done = () => setSaid({ words: W.copied(place), copied: true });
    const refused = () => {
      setSaid({ words: W.copyRefused(place), copied: false });
      selectLink(place);
    };

    if (navigator.clipboard == null) refused();
    else navigator.clipboard.writeText(screenLinkOf(place, rounds[place])).then(done, refused);
  }

  function replace(place: ScreenPlace) {
    setRounds({ ...rounds, [place]: (rounds[place] ?? 0) + 1 });
    setAsking(null);
    setSaid({ words: W.replacedSaid(place), copied: true });
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
            {W.title}
          </h2>
          <p id="ss-line" className="ss-line">
            {W.line}
          </p>
        </div>
        {load === 'loading' && (
          <ul className="ss-rows skeleton-rows" aria-hidden="true">
            {SCREEN_PLACES.map((place) => (
              <li key={place} className="skeleton-row skeleton-row-76">
                <span className="skeleton-row-bars">
                  <span className="skeleton-bar skeleton-bar-first" />
                  <span className="skeleton-bar skeleton-bar-second" />
                </span>
              </li>
            ))}
          </ul>
        )}
        {load === 'loaded' && (
          <ul className="ss-rows">
            {SCREEN_PLACES.map((place) => {
              const round = rounds[place] ?? 0;
              const id = `ss-${place.toLowerCase()}`;

              return (
                <li key={place} className="ss-row" aria-labelledby={id}>
                  <div className="ss-what">
                    <h3 id={id} className="ss-place">
                      {place}
                    </h3>
                    <p id={`${id}-link`} className="ss-link">
                      {screenLinkOf(place, round)}
                    </p>
                    {round > 0 && (
                      <p className="ss-replaced">
                        <Glyph name="tick" size={15} weight={2.6} />
                        {W.replacedAt(screenTime(SCREEN_START, 'en-GB'))}
                      </p>
                    )}
                  </div>
                  {asking === place ? (
                    <div className="ss-ask" role="group" aria-labelledby={`${id}-ask`}>
                      <p id={`${id}-ask`} className="ss-ask-title">
                        {W.replaceTitle(place)}
                      </p>
                      <p className="ss-line">{W.replaceBody}</p>
                      <div className="ss-acts">
                        <button
                          type="button"
                          className="link-button"
                          ref={keep}
                          onClick={() => setAsking(null)}
                        >
                          {W.keep}
                        </button>
                        <button
                          type="button"
                          className="gs-pill is-secondary"
                          onClick={() => replace(place)}
                        >
                          {W.replace}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="ss-acts">
                      <button
                        type="button"
                        className="gs-pill is-secondary"
                        onClick={() => copy(place)}
                      >
                        <Glyph name="copy" size={16} weight={2.2} />
                        {W.copy}
                      </button>
                      <Link className="gs-pill is-secondary" to={screenAt(place)}>
                        {W.openHere}
                      </Link>
                      <button
                        type="button"
                        id={`${id}-replace`}
                        className="gs-pill is-secondary"
                        onClick={() => {
                          setSaid(null);
                          setAsking(place);
                        }}
                      >
                        {W.replace}
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
            {load === 'loading' && W.loading}
            {load === 'failed' && W.notLoaded}
            {load === 'loaded' && said != null && (
              <>
                {said.copied && <Glyph name="tick" size={17} weight={2.6} />}
                {said.words}
              </>
            )}
          </p>
          {load === 'failed' && (
            <button
              type="button"
              className="link-button"
              onClick={() => {
                retry();
                title.current?.focus();
              }}
            >
              {W.tryAgain}
            </button>
          )}
        </div>
        <div className="dialog-actions">
          <button type="button" className="gs-pill is-secondary" onClick={onClose}>
            {W.close}
          </button>
        </div>
      </div>
    </>
  );
}

function saidClass(load: 'loaded' | 'loading' | 'failed', said: Said | null): string {
  if (load === 'loading') return 'ss-said is-quiet';
  if (load === 'failed' || said?.copied === false) return 'ss-said is-ink';

  return 'ss-said';
}

/** A refused clipboard leaves the link selected, so Ctrl+C or Command+C copies it (as Share does). */
function selectLink(place: ScreenPlace) {
  const link = document.getElementById(`ss-${place.toLowerCase()}-link`);
  const selection = window.getSelection();

  if (link == null || selection == null) return;
  const range = document.createRange();

  range.selectNodeContents(link);
  selection.removeAllRanges();
  selection.addRange(range);
}
