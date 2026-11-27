import { Link } from 'react-router';

import { BoardPage } from './BoardPage.tsx';
import { dataControlPath } from './dataControl.ts';
import { VIEWERS } from './settings.ts';
import { BREAK_GLASS as B } from './singleSignOn.ts';
import './singleSignOn.css';

/** The email the other owners get when an owner signs in without the organisation's provider (sc-610). */
export function BreakGlass() {
  return (
    <BoardPage end={null}>
      <div className="demo-heading">
        <h1>{B.subject}</h1>
        <p className="demo-muted">
          From {B.from} · To {B.to}
        </p>
      </div>
      <article className="sso-email" aria-label={B.subject}>
        {B.lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
        <Link className="button" to={dataControlPath('auditLog', VIEWERS.folake)}>
          {B.button}
        </Link>
        <p className="demo-muted">{B.foot}</p>
      </article>
    </BoardPage>
  );
}
