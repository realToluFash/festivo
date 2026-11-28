import { SAMPLE } from '../samples.ts';

export const SSO_ORG = SAMPLE.organisation;
export const SSO_DOMAIN = 'ire.events';
export const NAME_LIMIT = 40;

const PEOPLE = `people at ${SSO_DOMAIN}`;
const People = `People at ${SSO_DOMAIN}`;

export const SSO_WORDS = {
  title: 'Single sign-on',
  back: 'Sign-in rules',
  intro: `Let ${PEOPLE} sign in to Soirely through ${SSO_ORG}’s identity provider, like Microsoft Entra ID, Google Workspace or Okta. When IT turns someone off there, their Soirely access ends too.`,
  protocols: 'How your provider connects',
  saml: { title: 'SAML 2.0', line: 'For Microsoft Entra ID, Okta and most others.' },
  oidc: { title: 'OpenID Connect', line: 'For Google Workspace and newer setups.' },
  name: 'Provider name',
  nameHelp: `People see it when they sign in: “${SSO_ORG} signs you in through Okta.”`,
  metadata: 'Provider metadata',
  ways: { url: 'Paste its URL', file: 'Upload the file' },
  url: 'Metadata URL',
  urlHelp: 'Starts with https://.',
  chooseFile: 'Choose the metadata file',
  chooseAnother: 'Choose another',
  fileDemo:
    'The app opens the device’s file picker for an .xml file. The demo picks a sample file and reads nothing on the device.',
  issuer: 'Issuer URL',
  issuerHelp: 'We read the rest from its /.well-known/openid-configuration.',
  clientId: 'Client ID',
  secret: 'Client secret',
  show: 'Show',
  hide: 'Hide',
  giveThese: 'Give these to your provider',
  giveThis: 'Give this to your provider',
  entityId: 'Entity ID',
  replyUrl: 'Reply URL (assertion consumer service)',
  redirectUrl: 'Redirect URL',
  metadataUrl: 'Soirely metadata URL',
  copy: 'Copy',
  copyLabel: (label: string) => `Copy ${label}`,
  copied: 'Copied.',
  cancel: 'Cancel',
  save: 'Save provider',
  saving: 'Saving provider…',
  problem: {
    name: 'Enter a name people will recognise, like Okta.',
    nameLong: `Keep the name to ${NAME_LIMIT} characters or fewer.`,
    metadata: 'Paste the metadata URL, or upload the metadata file.',
    url: 'Enter a metadata URL that starts with https://.',
    issuer: 'Enter the issuer URL.',
    issuerHttps: 'Enter an issuer URL that starts with https://.',
    clientId: 'Enter the client ID.',
    secret: 'Enter the client secret.',
  },
  badMetadata:
    'We could not read that metadata. Check that the URL opens your provider’s SAML metadata, or upload the file instead.',
  discoveryFailed: (issuer: string) =>
    `We could not find your provider’s settings at ${issuer}/.well-known/openid-configuration. Check the issuer URL.`,
  notSetUp: 'Not set up',
  notSetUpLine: `Connect ${SSO_ORG}’s identity provider for ${SSO_DOMAIN}.`,
  setUp: 'Set up',
  savedNotTested: 'Saved, not tested',
  savedOff: 'Saved, off',
  savedOffLine: (name: string) => `${name} is saved. Test sign-on, then switch it on.`,
  test: 'Test sign-on',
  testing: 'Testing sign-on…',
  testingLine: (name: string) => `Finish signing in to ${name} in the browser.`,
  stopTesting: 'Stop testing',
  browserDemo: (name: string) =>
    `The app opens ${name} in the system browser, never a web view inside the app (RFC 8252). The demo opens nothing. Come back from ${name}:`,
  worked: 'It worked',
  didNotWork: 'It did not work',
  passed: 'Test worked',
  passedLine: (name: string, at: string) =>
    `${name} signed in ${SAMPLE.email} · ${SAMPLE.name} at ${at}.`,
  testAgain: 'Test again',
  failed: 'Test did not work',
  failedLine: (name: string) =>
    `${name} said: This person is not assigned to the Soirely app in ${name}.`,
  failedNext: (name: string) => `Nothing was switched on. Fix it in ${name}, then test again.`,
  checks: {
    noCode: 'The provider sent no sign-in code back.',
    noToken: 'The provider did not hand over a sign-in. Check the client ID and client secret.',
    unchecked: 'The sign-in the provider sent back did not pass our checks.',
    otherDomain: 'The provider signed in an address that is not at one of your proved domains.',
  },
  checksNext: (name: string) =>
    `Nothing was switched on. Check the settings here and in ${name}, then test again.`,
  failedChecks: 'It failed Soirely’s checks',
  switchName: 'Single sign-on',
  switchLine: 'Switches on after a test works.',
  untested: 'Test sign-on first. Single sign-on switches on only after a test works.',
  on: 'On',
  onLine: (name: string) =>
    `${People} sign in through ${name}. A password, Google and Apple still work for them.`,
  onRow: (name: string) => `${People} sign in through ${name}.`,
  requiredName: 'Required sign-on',
  requiredLine: (name: string) => `When it is on, ${PEOPLE} can sign in only through ${name}.`,
  required: 'Required',
  requiredOnLine: (name: string) =>
    `Only ${name} signs in ${PEOPLE}. Owners keep their own sign-in.`,
  requiredAsk: {
    title: (name: string) => `Require sign-on through ${name}?`,
    lines: (name: string) => [
      `${People} will sign in only through ${name}. A password, Google and Apple will be refused.`,
      `Owners keep their own sign-in, so a broken provider cannot lock ${SSO_ORG} out. Every owner sign-in that skips ${name} is recorded and emailed to the other owners.`,
    ],
    keep: 'Keep it optional',
    confirm: 'Require sign-on',
  },
  change: 'Change provider…',
  changeAsk: {
    title: 'Change the identity provider?',
    line: (name: string) =>
      `People keep signing in through ${name} until the new provider has passed Test sign-on and you switch it on.`,
    keep: (name: string) => `Keep ${name}`,
    confirm: 'Change provider',
  },
  changeNote: (name: string) =>
    `${name} stays on until the new provider is tested and switched on.`,
  remove: (name: string) => `Remove ${name}…`,
  removeAsk: {
    title: (name: string) => `Remove ${name}?`,
    line: `${People} go back to signing in with a password, Google or Apple.`,
    keep: (name: string) => `Keep ${name}`,
    confirm: (name: string) => `Remove ${name}`,
  },
  removeRefused: (name: string) =>
    `Turn off required sign-on first. While it is on, removing ${name} would leave ${PEOPLE} with no way to sign in.`,
  switchOffRefused: 'Turn off required sign-on first.',
  turnOffRequired: 'Turn off required sign-on',
  removed: (name: string) => `${name} removed. ${People} sign in with a password, Google or Apple.`,
  noDomain: 'Prove a domain first',
  noDomainLine: `Single sign-on connects for a domain ${SSO_ORG} has proved.`,
  proveDomain: 'Prove a domain',
  notOwner: 'Only an owner can set up or change single sign-on.',
  free: 'Comes with Enterprise',
  freeLine: `Single sign-on is part of Enterprise. ${SSO_ORG} is on Free.`,
  seePlans: 'See plans',
  plansToast: 'Plans has its own design.',
  exempt: 'Sign-in through your organisation’s own single sign-on is exempt.',
  copyFailed: 'Could not copy. Select the value and copy it.',
  provider: 'Provider',
  switches: 'Sign-in',
  rowTitle: 'Single sign-on',
} as const;

export const SSO_SIGN_IN_WORDS = {
  through: (name: string) => `${SSO_ORG} signs in through ${name}`,
  throughLine: (name: string) =>
    `Your address is at ${SSO_DOMAIN}, so ${name} signs you in. You will not need a Soirely password.`,
  continueTo: (name: string) => `Continue to ${name}`,
  anotherWay: 'Sign in another way',
  backTo: (name: string) => `Sign in through ${name}`,
  required: (name: string) => `${SSO_ORG} signs you in through ${name}.`,
  requiredLine: `A password, Google and Apple are not used for ${SSO_DOMAIN}.`,
  breakGlass: (name: string) =>
    `As an owner you keep your own sign-in, in case ${name} is down. This sign-in is recorded and emailed to the other owners.`,
  browserTitle: (name: string) => `Signing in through ${name}`,
  stop: 'Cancel',
  didNotWork: (name: string) =>
    `${name} did not sign you in. Try again, or ask the people who run ${name} at ${SSO_ORG}.`,
  viaDemo: (who: string) =>
    `Stand-in for Google and Apple. Come back from either as ${who}; the demo opens nothing:`,
  viaRefused: (via: string, name: string) =>
    `${via} is not used for ${SSO_DOMAIN}. ${SSO_ORG} signs you in through ${name}.`,
} as const;
