import { useId } from 'react';
import { Link } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import { SAMPLE } from './rules.ts';
import './managed.css';

const DOMAIN = SAMPLE.email.split('@')[1] ?? '';

const MANAGED_WORDS = {
  title: `Managed by ${SAMPLE.organisation}`,
  body: `Your ${DOMAIN} address is managed by ${SAMPLE.organisation}, so you can only be a member there.`,
  single: 'Access to a single event still works.',
  way: 'Change your main email address',
} as const;

/** sc-563's refusal wherever a membership path ends for an account its home organisation manages: an "i" on Surf, and the way out. */
export function ManagedBanner({ alert = false, level = 2 }: { alert?: boolean; level?: 2 | 3 }) {
  const id = useId();
  const Heading = level === 2 ? 'h2' : 'h3';

  return (
    <section className="managed" role={alert ? 'alert' : undefined} aria-labelledby={id}>
      <span className="managed-mark" aria-hidden="true">
        <Glyph name="info" size={20} weight={2.2} />
      </span>
      <div className="managed-words">
        <Heading id={id} className="managed-title">
          {MANAGED_WORDS.title}
        </Heading>
        <p>{MANAGED_WORDS.body}</p>
        <p>{MANAGED_WORDS.single}</p>
        <Link className="managed-way" to="/demo/settings/account">
          {MANAGED_WORDS.way}
        </Link>
      </div>
    </section>
  );
}
