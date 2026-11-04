import { type ReactNode, useState } from 'react';
import { Link } from 'react-router';

import { Brand } from '../components/Brand.tsx';
import { LanguageMenu } from '../components/LanguageMenu.tsx';
import { AppleMark, GoogleMark } from '../components/ProviderSignIn.tsx';
import { offButton } from '../offButton.ts';
import { SAMPLE } from './rules.ts';

/** The board's page: the lockup and the header's right end, the form's column, the footer, and the way back under it. */
export function BoardPage({
  children,
  end = <NewHere />,
  back,
  controls,
  tall = false,
}: {
  children: ReactNode;
  /** The header's right end; null leaves it empty. */
  end?: ReactNode;
  /** GOV.UK's back link, above the step line, where the board draws one. */
  back?: { to: string; state?: unknown };
  /** Demo-only switches, under the page with the way back. */
  controls?: ReactNode;
  /** Sits higher and tighter, for the board's tallest page. */
  tall?: boolean;
}) {
  const [language, setLanguage] = useState('en');

  return (
    <div className="demo-page">
      <header className="demo-page-header">
        <Brand lockup />
        {end != null && <div className="demo-page-new">{end}</div>}
      </header>
      <main
        id="content"
        className={['demo-page-main', back != null && 'demo-backed', tall && 'demo-tall']
          .filter(Boolean)
          .join(' ')}
      >
        <section className="demo-column">
          {back != null && (
            <Link className="demo-back" to={back.to} state={back.state}>
              <svg
                aria-hidden="true"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                className="demo-chevron"
              >
                <path d="M15 5l-7 7 7 7" />
              </svg>
              Back
            </Link>
          )}
          {children}
        </section>
      </main>
      <footer className="demo-page-footer">
        <span>© 2026 Soirely</span>
        <nav className="demo-page-links" aria-label="Legal and language">
          <Link className="link-button demo-link" to="/demo/later?screen=terms">
            Terms
          </Link>
          <Link className="link-button demo-link" to="/demo/later?screen=privacy">
            Privacy
          </Link>
          {/* Choosing renames the button only: the demo's words stay English. */}
          <LanguageMenu current={language} onChoose={setLanguage} />
        </nav>
      </footer>
      <div className="demo-way-in">
        {controls}
        <Link className="link-button" to="/demo">
          All states in the demo
        </Link>
      </div>
    </div>
  );
}

function NewHere() {
  return (
    <>
      <span>New to Soirely?</span>
      <Link className="button demo-dense" to="/demo/create-account">
        Create an account
      </Link>
    </>
  );
}

export function HaveAccount({ question = 'Already have an account?' }: { question?: string }) {
  return (
    <>
      <span>{question}</span>
      <Link className="button demo-dense" to="/demo/sign-in">
        Sign in
      </Link>
    </>
  );
}

/** From the email code on: who is signed in, where desktop pages keep the account. */
export function SignedInAs({ email = SAMPLE.email }: { email?: string }) {
  return (
    <>
      <span>{email}</span>
      <Link className="button demo-dense" to="/demo/sign-in?state=signed-out">
        Sign out
      </Link>
    </>
  );
}

export function Tick({ size = 14 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" className="demo-tick">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

export function Providers({ busy, onChoose }: { busy: boolean; onChoose: (name: string) => void }) {
  return (
    <div className="demo-providers">
      <button
        className="button button-google demo-wide"
        type="button"
        {...offButton(busy, { dim: false })}
        onClick={() => onChoose('Google')}
      >
        <GoogleMark />
        <span>Continue with Google</span>
      </button>
      <button
        className="button demo-apple demo-wide"
        type="button"
        {...offButton(busy, { dim: false })}
        onClick={() => onChoose('Apple')}
      >
        <AppleMark onLight />
        <span>Continue with Apple</span>
      </button>
    </div>
  );
}

export function OrLine({ words = 'or' }: { words?: string }) {
  return (
    <div className="auth-or">
      <span className="auth-or-rule" />
      <span>{words}</span>
      <span className="auth-or-rule" />
    </div>
  );
}
