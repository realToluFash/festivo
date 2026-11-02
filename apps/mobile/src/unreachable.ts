/** The unreachable screen, remembering a request link so Try again can return to it. */
export function unreachableFrom(token?: string) {
  return token == null
    ? ({ pathname: '/unreachable' } as const)
    : ({ pathname: '/unreachable', params: { link: token } } as const);
}

/** Where Try again carries on to once Soirely answers: the link it came from, else launch. */
export function carryOn(link: string | undefined) {
  return link != null && link !== ''
    ? ({ pathname: '/join/[token]', params: { token: link } } as const)
    : ('/' as const);
}
