import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import { RowWords } from '../components/SettingsParts.tsx';
import { RuleMark } from '../components/SignInRulesParts.tsx';
import type { Viewer } from './settings.ts';
import {
  type RowMark,
  type Standing,
  type StatusKind,
  pageFor,
  rowAction,
  ssoRow,
} from './singleSignOn.ts';
import './dataControl.css';
import './singleSignOn.css';

/** Every status a shape with its word: grey for not yet, the green tick, the alert, the lock, the spinner. */
export function SsoMark({ kind }: { kind: StatusKind | RowMark }) {
  switch (kind) {
    case 'grey':
      return <RuleMark mark="notApplicable" />;
    case 'on':
    case 'passed':
      return <RuleMark mark="met" />;
    case 'failed':
      return (
        <span className="sso-mark is-failed" aria-hidden="true">
          <Glyph name="alert" size={18} weight={2.2} />
        </span>
      );
    case 'lock':
      return (
        <span className="sso-mark is-lock" aria-hidden="true">
          <Glyph name="lock" size={13} weight={2.4} />
        </span>
      );
    case 'running':
      return (
        <span className="sso-mark" aria-hidden="true">
          <span className="pending-spinner" />
        </span>
      );
  }
}

/** Single sign-on's row on Sign-in rules: where it stands, opening its own page for an owner or admin. */
export function SsoRuleRow({ standing, viewer }: { standing: Standing; viewer: Viewer }) {
  const navigate = useNavigate();
  const row = ssoRow(standing);
  const words = (
    <>
      <SsoMark kind={row.mark} />
      <RowWords title={row.word} lines={[row.line]} />
    </>
  );

  return (
    <ul className="desk-rows signin-rows">
      <li>
        {viewer.manages ? (
          <button
            type="button"
            className="desk-row"
            onClick={() => void navigate(pageFor(standing, viewer))}
          >
            {words}
            <span className="signin-change">{rowAction(standing, viewer)}</span>
          </button>
        ) : (
          <div className="desk-row">{words}</div>
        )}
      </li>
    </ul>
  );
}

export function Switch({
  label,
  on,
  onPress,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      className="dc-switch"
      aria-checked={on}
      aria-label={label}
      onClick={onPress}
    >
      <span className="dc-switch-track" aria-hidden="true">
        <span className="dc-switch-knob" />
      </span>
    </button>
  );
}

/** What only the demo does, in a dashed box, so nobody takes it for the product. */
export function DemoOnly({ children }: { children: ReactNode }) {
  return <div className="sso-demo-only">{children}</div>;
}

export function Refused({
  line,
  action,
  onAction,
}: {
  line: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="signin-refusal sso-refused" role="alert">
      <Glyph name="alert" size={20} weight={2.2} />
      <div className="desk-after">
        <p className="desk-line is-ink">{line}</p>
        <button type="button" className="desk-text" onClick={onAction}>
          {action}
        </button>
      </div>
    </div>
  );
}
