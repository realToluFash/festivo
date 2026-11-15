export function requireSameSiteApi(pageOrigin: string, apiBaseUrl: string): void {
  const api = parsed(apiBaseUrl);

  // A relative base URL is same-origin by construction.
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

/** The last two labels: over-permissive for a multi-label suffix like `co.uk`, deliberately. */
function registrableDomainOf(hostname: string): string {
  return hostname.toLowerCase().split('.').slice(-2).join('.');
}
