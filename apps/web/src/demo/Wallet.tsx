import { Link, useLocation, useSearchParams } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import { type Lang, codePath, wordsFor } from './guest.ts';
import {
  type Device,
  type Face,
  ISSUER,
  NAMES,
  type Names,
  WALLET_WORDS,
  faceOf,
  isLang,
  namesOf,
  offerFor,
  passContent,
} from './wallet.ts';
import './wallet.css';

const CODE = codePath();

const passAt = (face: Face, lang: Lang, names: Names = 'page'): string =>
  `/demo/wallet-pass?face=${face}&lang=${lang}${names === 'long' ? '&names=long' : ''}`;

/** Placeholder for the platform's supplied artwork: the product uses Apple's and Google's files, never this drawing. */
interface Placed {
  device: Device;
  lang: Lang;
  start?: boolean;
}

function Badge({ kind, lang, start }: { kind: 'apple' | 'google'; lang: Lang; start: boolean }) {
  const words = WALLET_WORDS[lang];
  const name = kind === 'apple' ? words.apple : words.google;

  return (
    <a
      className={`wl-badge is-${kind}${start ? ' is-start' : ''}`}
      href={passAt(kind, lang)}
      target="_blank"
      rel="noreferrer"
      aria-label={name}
    >
      <span className="wl-badge-art" aria-hidden="true">
        <span className="wl-badge-mark" />
        <span className="wl-badge-words">{name}</span>
      </span>
    </a>
  );
}

/** Inside the code card, under the QR and its line: one button for the phone in the guest's hand. */
export function WalletButton({ device, lang, start = false }: Placed) {
  const offer = offerFor(device);

  if (offer === 'line') return null;

  return <Badge kind={offer} lang={lang} start={start} />;
}

/** Under the card, on a computer, an iPad or an Android tablet. */
export function WalletLine({ device, lang, start = false }: Placed) {
  if (offerFor(device) !== 'line') return null;

  return <p className={start ? 'wl-line is-start' : 'wl-line'}>{WALLET_WORDS[lang].openOnPhone}</p>;
}

const DEVICE_NAMES: Record<Device, string> = {
  ios: 'iPhone',
  android: 'Android phone',
  desktop: 'Computer or tablet',
};

/** Demo only: the board's `wallet` tweak, since the width cannot say which phone it is. */
export function WalletDevices({ device }: { device: Device }) {
  const { pathname, search } = useLocation();
  const to = (each: Device) => {
    const query = new URLSearchParams(search);
    query.set('wallet', each);

    return `${pathname}?${query.toString()}`;
  };

  return (
    <nav className="wl-devices" aria-label="Demo only: the guest's device">
      {(Object.keys(DEVICE_NAMES) as Device[]).map((each) => (
        <Link
          key={each}
          className="wl-tweak"
          to={to(each)}
          replace
          aria-current={each === device ? 'true' : undefined}
        >
          {DEVICE_NAMES[each]}
        </Link>
      ))}
    </nav>
  );
}

function Qr() {
  return (
    <svg className="wl-qr" aria-hidden="true" width="150" height="150" viewBox="0 0 29 29">
      <path d={CODE} />
    </svg>
  );
}

function StandIn({ shape }: { shape: 'circle' | 'square' }) {
  return <span className={`wl-standin is-${shape}`} aria-hidden="true" />;
}

const FACE_NAMES: Record<Face, string> = {
  apple: 'Apple front',
  'apple-back': 'Apple back',
  google: 'Google face',
  'google-details': 'Google details',
  'google-emptied': 'Google emptied',
};

const LANGS: readonly Lang[] = ['en', 'es', 'fr', 'pt'];

/** The pass as Wallet draws it, in the platform's type: tweaks face, lang and names, as on `WalletPass.dc.html`. */
export function WalletPassPage() {
  const [params] = useSearchParams();
  const face = faceOf(params.get('face'));
  const langParam = params.get('lang');
  const lang: Lang = isLang(langParam) ? langParam : 'en';
  const names = namesOf(params.get('names'));
  const words = WALLET_WORDS[lang];
  const content = passContent(face, names, lang, wordsFor(lang).doorTitle);
  const full = NAMES[names];

  return (
    <div className="wl-page">
      <nav className="wl-tweaks" aria-label="Demo only: the pass's tweaks">
        <p className="wl-demo-only">Demo only. Wallet draws the pass; this stands in for it.</p>
        <Link className="link-button" to="/demo">
          All states in the demo
        </Link>
        <ul className="wl-tweak-row">
          {(Object.keys(FACE_NAMES) as Face[]).map((each) => (
            <li key={each}>
              <Link
                className="wl-tweak"
                to={passAt(each, lang, names)}
                aria-current={each === face ? 'page' : undefined}
              >
                {FACE_NAMES[each]}
              </Link>
            </li>
          ))}
        </ul>
        <ul className="wl-tweak-row">
          {LANGS.map((each) => (
            <li key={each}>
              <Link
                className="wl-tweak"
                to={passAt(face, each, names)}
                aria-current={each === lang ? 'page' : undefined}
              >
                {each}
              </Link>
            </li>
          ))}
          <li>
            <Link
              className="wl-tweak"
              to={passAt(face, lang, names === 'long' ? 'page' : 'long')}
              aria-current={names === 'long' ? 'true' : undefined}
            >
              Long names (sc-4329)
            </Link>
          </li>
        </ul>
      </nav>

      <div className="wl-stage" lang={lang}>
        {content.kind === 'emptied' ? (
          <section className="wl-pass is-google" aria-label="Google Wallet pass, emptied">
            <div className="wl-g-top">
              <StandIn shape="circle" />
              <span className="wl-issuer">{content.issuer}</span>
            </div>
            <p className="wl-g-header">{content.header}</p>
            <p className="wl-expired">
              <Glyph name="clock" size={18} />
              {content.expired}
            </p>
          </section>
        ) : face === 'apple' ? (
          <section className="wl-pass is-apple" aria-label="Apple Wallet pass, front">
            <div className="wl-a-top">
              <span className="wl-issuer">{content.issuer}</span>
            </div>
            <p className="wl-a-primary">{content.event}</p>
            <p className="wl-a-secondary">{content.guest}</p>
            <p className="wl-door">{content.door}</p>
            <div className="wl-qr-box">
              <Qr />
            </div>
          </section>
        ) : face === 'google' ? (
          <section className="wl-pass is-google" aria-label="Google Wallet pass, face">
            <div className="wl-g-top">
              <StandIn shape="circle" />
              <span className="wl-issuer">{content.issuer}</span>
            </div>
            <p className="wl-door">{content.door}</p>
            <p className="wl-g-header is-two">{content.event}</p>
            <p className="wl-g-text">{content.guest}</p>
            <div className="wl-qr-box">
              <Qr />
            </div>
          </section>
        ) : (
          <section
            className={`wl-pass is-back ${face === 'apple-back' ? 'is-apple' : 'is-google'}`}
            aria-label={
              face === 'apple-back' ? 'Apple Wallet pass, back' : 'Google Wallet pass, details'
            }
          >
            <dl className="wl-back">
              {face === 'apple-back' && (
                <div className="wl-back-row">
                  <dt className="visually-hidden">{words.eventLabel}</dt>
                  <dd>{full.event}</dd>
                </div>
              )}
              <div className="wl-back-row">
                <dt className="visually-hidden">{words.guestLabel}</dt>
                <dd>{full.guest}</dd>
              </div>
            </dl>
            <p className="wl-back-line">{words.latest}</p>
          </section>
        )}

        <aside className="wl-notes" aria-label="Demo only: what the pass carries">
          {face.startsWith('apple') && content.kind === 'live' && (
            <p>
              VoiceOver reads the pass as: <q>{words.description(full.event)}</q> (Apple’s
              description, unseen).
            </p>
          )}
          {face === 'apple' && (
            <p className="wl-icon-note">
              <StandIn shape="square" /> Apple’s icon, in notifications and email: Soirely’s square
              mark, 660 × 660 px or more, from the owner. Never ship this stand-in.
            </p>
          )}
          {face.startsWith('google') && (
            <p>
              The dashed circle stands in for Soirely’s square mark, masked to a circle by Google.
              Never ship it.
            </p>
          )}
          <p>
            Issued by {ISSUER}. No date, time, venue, table, companions, reply or link. No relevant
            date or place, so it never comes up on the lock screen by itself.
          </p>
        </aside>
      </div>
    </div>
  );
}
