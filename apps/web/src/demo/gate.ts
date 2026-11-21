/** The environments the design demo opens in: never one a customer reaches. */
const DEMO_ENVIRONMENTS: readonly string[] = ['development', 'dev', 'qa'];

export function demoOpens(environment: string): boolean {
  return DEMO_ENVIRONMENTS.includes(environment);
}
