import type { ReactNode } from 'react';

/** Another way through an auth step: a bordered row ending in a chevron. */
export function AuthRow({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button className="auth-row" type="button" onClick={onClick}>
      <span className="auth-row-label">{children}</span>
      <svg
        className="auth-row-chevron"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
    </button>
  );
}
