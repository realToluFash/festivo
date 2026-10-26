const REQUEST_LINK_TOKEN = /^[0-9a-f]{32}$/i;

/** The unreachable screen, remembering a request link so Try again can return to it. */
export function unreachableFrom(token?: string) {
  return token == null
    ? ({ pathname: '/unreachable' } as const)
    : ({ pathname: '/unreachable', params: { link: token } } as const);
}

/** Where Try again carries on to once Soirely answers: the request link it came from, else launch. */
export function carryOn(link: string | undefined) {
  return link != null && REQUEST_LINK_TOKEN.test(link)
    ? ({ pathname: '/join/[token]', params: { token: link } } as const)
    : ('/' as const);
}
