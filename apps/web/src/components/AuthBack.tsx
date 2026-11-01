import { useLocation, useNavigate } from 'react-router';

/** "‹ Sign in": the title of the step the browser's Back returns to, doing what Back does there (sc-23279). */
export interface AuthBackTo {
  label: string;
  heard?: string;
  /** Where it goes when this page was the first one opened; without it, there is no control. */
  fallback?: string;
}

/** The control, or null where Back would leave the site, so the header shows the brand instead. */
export function useAuthBack(back: AuthBackTo | undefined) {
  const navigate = useNavigate();
  const opened = useLocation().key === 'default';

  if (back == null || (opened && back.fallback == null)) return null;

  const { label, heard, fallback } = back;

  return (
    <button
      type="button"
      className="link-button auth-back"
      aria-label={heard}
      onClick={() =>
        opened && fallback != null ? void navigate(fallback, { replace: true }) : void navigate(-1)
      }
    >
      <span aria-hidden="true">‹</span>
      {label}
    </button>
  );
}
