import type { Guest } from '@soirely/api-client';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Glyph, type GlyphName } from '../../../components/Glyph.tsx';
import { Ask, Head, RowWords } from '../../../components/SettingsParts.tsx';
import { focusWhenFree } from '../../../layers.ts';
import type { Mesh } from '../../../mesh.ts';

type Copy =
  { kind: 'none' } | { kind: 'copied' } | { kind: 'byHand'; url: string } | { kind: 'failed' };

type Replace =
  { kind: 'none' } | { kind: 'asking'; busy: boolean } | { kind: 'failed' } | { kind: 'replaced' };

const PIECES = [1, 2, 3, 4, 5, 6];

/** A guest beside the list, as A draws it: the cover card, the wrong-person notice, then Invitation for those who can add guests (sc-1526). sc-3773 adds Details under the notice. */
export function GuestColumn({
  guest,
  mesh,
  reply,
  mark,
  manages,
  invites,
  flagged,
  onCopy,
  onReplace,
}: {
  guest: Guest;
  mesh: Mesh;
  reply: string;
  mark: string;
  manages: boolean;
  invites: boolean;
  /** Someone who opened this guest's link pressed Tell them; only ever true for those who can add guests. */
  flagged: boolean;
  /** The whole link; refused 409 on a phase that does not invite. */
  onCopy: () => Promise<string>;
  onReplace: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const heading = useId();
  const [copy, setCopy] = useState<Copy>({ kind: 'none' });
  const [replace, setReplace] = useState<Replace>({ kind: 'none' });
  const replaceButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (replace.kind === 'replaced') focusWhenFree(() => replaceButton.current);
  }, [replace.kind]);

  function copied(): void {
    onCopy().then(
      (url) => {
        const byHand = () => setCopy({ kind: 'byHand', url });

        if (navigator.clipboard == null) byHand();
        else navigator.clipboard.writeText(url).then(() => setCopy({ kind: 'copied' }), byHand);
      },
      () => setCopy({ kind: 'failed' }),
    );
  }

  function replaced(): void {
    setReplace({ kind: 'asking', busy: true });
    onReplace().then(
      () => {
        setCopy({ kind: 'none' });
        setReplace({ kind: 'replaced' });
      },
      () => setReplace({ kind: 'failed' }),
    );
  }

  const ask = () => setReplace({ kind: 'asking', busy: false });

  return (
    <div className="gs-guest">
      {replace.kind === 'replaced' && (
        <p className="gs-ok" role="status">
          <Glyph name="tick" size={17} weight={2.6} />
          {t('guestList.linkReplaced', { name: guest.fullName })}
        </p>
      )}
      <section
        className={`ev-card today-cover is-${mesh} gs-card is-guest`}
        aria-labelledby={heading}
      >
        <span className="ev-scrim" aria-hidden="true" />
        {PIECES.map((piece) => (
          <span key={piece} className={`desk-piece p${piece}`} aria-hidden="true" />
        ))}
        <div className="ev-card-inner gs-card-inner">
          <ul className="desk-glass-tags">
            <li className="desk-glass">
              <span className={`gs-mark ${mark} on-cover`} aria-hidden="true" />
              {reply}
            </li>
          </ul>
          <h2 id={heading} className="gs-name" tabIndex={-1} data-focus="guest-heading">
            {guest.fullName}
          </h2>
        </div>
      </section>
      {manages && flagged && (
        <WrongPerson name={guest.fullName} heading={heading} onReplace={ask} />
      )}
      {replace.kind === 'failed' && (
        <p className="desk-error gs-refused" role="alert">
          <Glyph name="alert" size={15} weight={2.2} />
          {t('guestList.notReplaced')}
        </p>
      )}
      {manages && (
        <section className="desk-block" aria-labelledby={`${heading}-invitation`}>
          <Head
            level={3}
            title={<span id={`${heading}-invitation`}>{t('guestList.invitation')}</span>}
          />
          <ul className="desk-rows gs-rows">
            {invites && (
              <li>
                <button type="button" className="desk-row gs-do" data-focus="copy" onClick={copied}>
                  <Lead name="link" />
                  <RowWords title={t('guestList.copyLink')} lines={[t('guestList.copyLinkLine')]} />
                </button>
                <p className="gs-copied" role="status">
                  {copy.kind === 'copied' && (
                    <span>
                      <Glyph name="tick" size={16} weight={2.6} />
                      {t('guestList.linkCopied')}
                    </span>
                  )}
                </p>
                {copy.kind === 'byHand' && <CopyByHand url={copy.url} />}
                {copy.kind === 'failed' && (
                  <p className="gs-refused" role="alert">
                    {t('guestList.loadFailedLine')}
                  </p>
                )}
              </li>
            )}
            <li>
              <button
                ref={replaceButton}
                type="button"
                className="desk-row gs-do"
                data-focus="replace"
                onClick={ask}
              >
                <Lead name="refresh" />
                <RowWords
                  title={t('guestList.replaceLink')}
                  lines={[t('guestList.replaceLinkLine')]}
                />
              </button>
            </li>
          </ul>
        </section>
      )}
      {replace.kind === 'asking' && (
        <Ask
          title={t('guestList.replaceTitle', { name: guest.fullName })}
          line={t('guestList.replaceLine')}
          keep={t('guestList.keepIt')}
          go={t('guestList.replace')}
          red={false}
          busy={replace.busy ? t('guestList.replace') : undefined}
          onKeep={() => setReplace({ kind: 'none' })}
          onGo={replaced}
        />
      )}
    </div>
  );
}

/** Marked by the triangle and the words, not the amber alone; there when the page opens, so a region, not an alert. */
function WrongPerson({
  name,
  heading,
  onReplace,
}: {
  name: string;
  heading: string;
  onReplace: () => void;
}) {
  const { t } = useTranslation();

  return (
    <section className="gs-amber" aria-labelledby={`${heading}-flag`}>
      <h3 id={`${heading}-flag`} className="gs-amber-head">
        <Glyph name="warn" size={17} weight={2.2} />
        {t('guestList.flaggedTitle')}
      </h3>
      <p className="gs-amber-line">{t('guestList.flaggedLine', { name })}</p>
      <button type="button" className="desk-text" data-focus="flag-replace" onClick={onReplace}>
        {t('guestList.replaceLink')}
      </button>
    </section>
  );
}

function Lead({ name }: { name: GlyphName }) {
  return (
    <span className="gs-lead is-icon" aria-hidden="true">
      <Glyph name={name} size={20} weight={2} />
    </span>
  );
}

/** The browser kept the clipboard, so the link is selected to copy by hand. */
function CopyByHand({ url }: { url: string }) {
  const { t } = useTranslation();
  const id = useId();
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    field.current?.focus();
    field.current?.select();
  }, []);

  return (
    <div className="desk-field gs-by-hand">
      <label htmlFor={id} className="desk-label">
        {t('guestList.invitationLink')}
      </label>
      <textarea
        ref={field}
        id={id}
        className="gs-link"
        readOnly
        rows={2}
        value={url}
        aria-describedby={`${id}-help`}
        onFocus={(event) => event.target.select()}
      />
      <p id={`${id}-help`} className="desk-help">
        {t('guestList.clipboardRefused')}
      </p>
    </div>
  );
}
