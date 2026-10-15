/**
 * The page and the API have to be the same site, checked once at boot.
 *
 * The refresh token is a `SameSite=Strict` cookie, so the browser attaches it
 * only to requests going to the same site as the page. A deployment that puts
 * the API on another registrable domain still signs people in and still works
 * for fifteen minutes — and then every refresh fails, everybody is signed out,
 * and nothing points at the configuration that did it.
 *
 * So it is refused at boot, where both origins are in hand and main.tsx has
 * somewhere to print the reason. The web app and the API share a domain by
 * decision rather than by accident — docs/architecture/sessions.md records it,
 * and names the two ways out if that ever has to change.
 */

export function requireSameSiteApi(pageOrigin: string, apiBaseUrl: string): void {
  const api = parsed(apiBaseUrl);

  // A relative base URL is same-origin by construction — the reverse-proxy
  // arrangement sessions.md names as the alternative. Nothing to check.
  if (api == null) return;

  const page = parsed(pageOrigin);

  if (
    page != null &&
    page.protocol === api.protocol &&
    registrableDomainOf(page.hostname) === registrableDomainOf(api.hostname)
  ) {
    return;
  }

  throw new Error(
    `The API at ${apiBaseUrl} is not the same site as this page at ${pageOrigin}, so the browser would not send the refresh cookie and every session would end after fifteen minutes. Put the API on this page's own domain, or serve it through this container at /api — see docs/architecture/sessions.md.`,
  );
}

function parsed(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/**
 * The last two labels.
 *
 * That is the registrable domain for every hostname this product uses, and an
 * over-permissive answer for a multi-label suffix like `co.uk`, where it would
 * call two unrelated domains the same site. Erring that way is deliberate: the
 * check exists to catch a deployment pointed at an unrelated host, and the
 * public suffix list is a dependency with a monthly update behind it for a
 * question this answers once.
 */
function registrableDomainOf(hostname: string): string {
  return hostname.toLowerCase().split('.').slice(-2).join('.');
}
