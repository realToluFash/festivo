import { useRef } from 'react';
import { Link } from 'react-router';

import { TextAction } from './SettingsParts.tsx';

import './ruleNotices.css';

export interface RuleNoticeWords {
  kind: 'attention' | 'quiet';
  title: string;
  body: string | null;
  step: { label: string; to: string };
  close: string | null;
}

/** One of the sign-in rules' notices as the board draws it: a dot, no border, and the step a white pill with violet words (#87594). */
export function RuleNoticeBox({
  words,
  onClose,
}: {
  words: RuleNoticeWords;
  onClose?: (box: HTMLElement | null) => void;
}) {
  const box = useRef<HTMLDivElement>(null);

  return (
    <div ref={box} className={`rn-box is-${words.kind}`} role="status">
      <span className="rn-mark" aria-hidden="true" />
      <div className="rn-main">
        <div className="rn-words" data-notice-lead tabIndex={-1}>
          <p className="rn-title">{words.title}</p>
          {words.body != null && <p className="rn-body">{words.body}</p>}
        </div>
        <div className="rn-actions">
          <Link className="desk-step" to={words.step.to}>
            {words.step.label}
          </Link>
          {words.close != null && onClose != null && (
            <TextAction label={words.close} onClick={() => onClose(box.current)} />
          )}
        </div>
      </div>
    </div>
  );
}
