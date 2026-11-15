/** The builds the design demo opens in: never one a store ships. */
export const DEMO_BUILDS: readonly string[] = ['development', 'qa', 'phone'];

export function demoOpens(environment: string): boolean {
  return DEMO_BUILDS.includes(environment);
}
