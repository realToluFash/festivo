/**
 * The localisation guards, shared across every surface.
 *
 * One implementation rather than one per app: a check each app keeps for itself
 * is a check the next app silently does not have, and the previous build had
 * three copies of the same parity test with three subtly different ideas of
 * what parity meant.
 */
export * from './catalogues.ts';
export * from './literals.ts';
export * from './surfaces.ts';
