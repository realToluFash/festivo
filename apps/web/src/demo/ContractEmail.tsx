import { Link, useSearchParams } from 'react-router';

import { EMAIL_KINDS, type EmailKind, contractEmail, emailKindOf } from './contract.ts';
import './usageWarning.css';
import './contract.css';

const NAMES: Record<EmailKind, string> = {
  due_today: 'Due today',
  overdue: 'Overdue',
  read_only: 'Read-only',
  renewal: 'Renewal',
};

/** sc-613: the emails to the billing contacts (ContractEmails.dc.html) at 600 px, on sample data. */
export function ContractEmail() {
  const [params] = useSearchParams();
  const kind = emailKindOf(params.get('state'));
  const mail = contractEmail(kind, 'en-GB');

  return (
    <div className="uw-mail-page">
      <div className="uw-mail">
        <div className="uw-mail-top">
          <p className="uw-mail-subject">{mail.subject}</p>
          <p className="demo-muted">From [Soirely] · To finance@ire.events, folake@ire.events</p>
        </div>
        <article className="uw-mail-body" aria-label={mail.subject}>
          <h1>{mail.subject}</h1>
          {mail.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
          <dl className="ct-facts ct-mail-facts">
            {mail.facts.map(([term, value]) => (
              <div key={term} className="ct-fact">
                <dt>{term}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {kind !== 'renewal' && (
            <p className="demo-muted">[Attached: Paddle’s invoice PDF, inv_01-2026-0930]</p>
          )}
          <p className="demo-muted">[Footer, as on sc-5937’s email]</p>
        </article>
      </div>
      <div className="uw-demo-only">
        <p>
          The demo only. The board’s English at mail width; [en] owns the words, in en, es, fr and
          pt. The overdue email goes every 7 days after the due date; from day 31 it reads as
          read-only.
        </p>
        {EMAIL_KINDS.map((one) => (
          <Link
            key={one}
            className="desk-text"
            aria-current={one === kind ? 'page' : undefined}
            to={`/demo/contract-email?state=${one}`}
          >
            {NAMES[one]}
          </Link>
        ))}
        <Link className="desk-text" to="/demo">
          All states in the demo
        </Link>
      </div>
    </div>
  );
}
