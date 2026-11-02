import { Link } from 'react-router';

interface Drawn {
  label: string;
  heard?: string | undefined;
  className?: string;
}

type Goes = { to: string; onClick?: never } | { onClick: () => void; to?: never };

/** "‹ Events": every web back control, a link when it has a place to go and a button otherwise (sc-25608). */
export function BackControl({ label, heard, className, to, onClick }: Drawn & Goes) {
  const classes = ['link-button', 'back-control', className].filter(Boolean).join(' ');
  const content = (
    <>
      <span aria-hidden="true">‹</span>
      {label}
    </>
  );

  return to != null ? (
    <Link className={classes} to={to} aria-label={heard}>
      {content}
    </Link>
  ) : (
    <button type="button" className={classes} aria-label={heard} onClick={onClick}>
      {content}
    </button>
  );
}
