/**
 * Rules both clients must agree on.
 *
 * Pure functions and types only — no network, no storage, no framework, no
 * React. This is the package where a test is cheapest and a bug is most
 * expensive, because a rule implemented twice WILL diverge and the divergence
 * is invisible until a catering count is wrong.
 */
export * from './locales.ts';
export * from './guestName.ts';
export * from './userAgent.ts';
export * from './datetime.ts';
export * from './devices.ts';
export * from './password.ts';
export * from './regions.ts';
export * from './initials.ts';
export * from './phone.ts';
export * from './forms.ts';
export * from './timeZones.ts';
export * from './phoneCodeRoute.ts';
