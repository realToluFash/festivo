/** The link Try again on Cannot reach Soirely returns to: a request to join, or a password reset. */
export type HeldLink = { kind: 'join' | 'reset'; token: string };

/** The unreachable screen, remembering the link so Try again can return to it. */
export function unreachableFrom(link?: HeldLink) {
  return link == null
    ? ({ pathname: '/unreachable' } as const)
    : ({ pathname: '/unreachable', params: { link: link.token, to: link.kind } } as const);
}

/** Where Try again carries on to once Soirely answers: the link it came from, else launch. */
export function carryOn(link: string | undefined, to: string | undefined) {
  if (link == null || link === '') return '/' as const;

  return to === 'reset'
    ? ({ pathname: '/reset-password', params: { token: link } } as const)
    : ({ pathname: '/join/[token]', params: { token: link } } as const);
}
