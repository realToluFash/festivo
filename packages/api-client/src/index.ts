/**
 * What both clients use to talk to the API.
 *
 * Wire types in `schema.d.ts` are GENERATED from the API's own OpenAPI
 * document — `npm run generate` in this package. Do not hand-write one: a
 * client type maintained alongside the server's serialisation is a second copy
 * of a fact, and two copies diverge while both sides typecheck perfectly.
 */
export * from './client.ts';
export * from './problem.ts';
export * from './oauth.ts';
export * from './proofRefusal.ts';
