import { Link } from 'react-router';

import { offButton } from '../offButton.ts';
import { DemoOnly } from './SingleSignOnParts.tsx';
import { BREAK_GLASS_PATH, SIGN_IN_SSO as S } from './singleSignOn.ts';

/** Continue to the provider in place of the password, and what the demo does once it is pressed. */
export function SsoHandoff({
  busy,
  gone,
  onAnother,
}: {
  busy: boolean;
  gone: boolean;
  onAnother: () => void;
}) {
  return (
    <>
      <p className="demo-text">{S.line}</p>
      <button className="button button-primary demo-wide" type="submit" {...offButton(busy)}>
        {S.go}
      </button>
      {gone && <SsoGone />}
      <button className="link-button demo-link" type="button" onClick={onAnother}>
        {S.another}
      </button>
    </>
  );
}

export function SsoGone() {
  return (
    <DemoOnly>
      <p>{S.demoGone}</p>
      <Link className="button" to="/demo/today">
        {S.back}
      </Link>
    </DemoOnly>
  );
}

/** Required sign-on refused the password, Google or Apple: the way through the provider instead. */
export function SsoRefusedStep({ gone, onGo }: { gone: boolean; onGo: () => void }) {
  return (
    <div className="demo-buttons">
      <button className="button button-primary demo-wide" type="button" onClick={onGo}>
        {S.go}
      </button>
      {gone && <SsoGone />}
    </div>
  );
}

export function BreakGlassControl() {
  return (
    <p className="demo-switch">
      {S.ownerStill}{' '}
      <Link className="link-button demo-link" to={BREAK_GLASS_PATH}>
        {S.seeEmail}
      </Link>
    </p>
  );
}
