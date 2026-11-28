import { ssoHref, type SsoState } from './SingleSignOnModel.ts';
import { signInSsoHref, SSO_MEMBER } from './SingleSignOnSignIn.ts';
import { SAMPLE } from '../samples.ts';

interface Board {
  title: string;
  what: string;
  href: string;
}

const PAGE: Record<SsoState, readonly [string, string]> = {
  none: ['nothing set up', 'Pick SAML 2.0 or OpenID Connect'],
  saml_form: ['SAML 2.0', 'Name, metadata URL, Soirely’s values with Copy'],
  saml_blank: ['SAML, Save with nothing', 'Both checks before sending'],
  saml_invalid: ['SAML, wrong values', 'Over 40 characters, an http:// URL'],
  saml_bad_metadata: ['SAML, metadata unread', 'The server could not read it'],
  oidc_form: ['OpenID Connect', 'Issuer, client ID, secret, the redirect URL'],
  oidc_blank: ['OpenID Connect, Save with nothing', 'Every check before sending'],
  oidc_invalid: ['OpenID Connect, wrong values', 'No https:// on the issuer'],
  oidc_discovery_failed: [
    'OpenID Connect, discovery failed',
    'No /.well-known/openid-configuration',
  ],
  saved: ['saved, not tested', 'Test sign-on; saving switched nothing on'],
  test_running: ['testing', 'The system browser’s stand-in, It worked or not'],
  test_passed: ['test worked', 'Who came back, and the switch'],
  test_failed: ['test did not work', 'The provider’s error in plain words'],
  test_failed_checks: ['test failed our checks', 'Soirely’s own reason, no “Okta said:”'],
  switch_untested: ['switch before a test', 'Refused until a test works'],
  on: ['on', 'Required sign-on, Change provider…, Remove Okta…'],
  required_confirm: ['Require sign-on?', 'The owners’ own sign-in stays'],
  required_on: ['required', 'Only Okta signs in ire.events'],
  change_confirm: ['Change the provider?', 'Okta keeps working until the new one is on'],
  remove_confirm: ['Remove Okta?', 'Keep it or Remove'],
  remove_refused: ['Remove while required', 'Turn off required sign-on first'],
  removed: ['removed', 'Okta removed, the form again'],
  no_domain: ['no domain proved', 'Prove a domain first'],
  not_owner: ['not an owner', 'Julien reads it; only an owner changes it'],
};

export const SSO_BOARDS: readonly Board[] = [
  ...(Object.entries(PAGE) as [SsoState, readonly [string, string]][]).map(
    ([state, [title, what]]) => ({
      title: `Single sign-on · ${title}`,
      what,
      href: ssoHref(state, state === 'not_owner' ? { as: 'julien' } : {}),
    }),
  ),
  {
    title: 'Single sign-on · Free',
    what: 'Comes with Enterprise, See plans',
    href: ssoHref(null, { plan: 'free' }),
  },
  {
    title: 'Sign-in rules · single sign-on saved',
    what: 'The row: Saved, off',
    href: '/demo/settings/sign-in-rules?state=ssoSaved',
  },
  {
    title: 'Sign-in rules · single sign-on on',
    what: 'The row: On, through Okta',
    href: '/demo/settings/sign-in-rules?state=ssoOn',
  },
  {
    title: 'Sign-in rules · single sign-on required',
    what: 'The row: Required',
    href: '/demo/settings/sign-in-rules?state=ssoRequired',
  },
  {
    title: 'Sign-in rules · single sign-on on Free',
    what: 'The row: Comes with Enterprise',
    href: '/demo/settings/sign-in-rules?state=ssoFree',
  },
  {
    title: 'Sign-in rules · two-factor, single sign-on exempt',
    what: 'Two-factor for everyone while Okta is on',
    href: '/demo/settings/sign-in-rules?state=ssoExempt',
  },
  {
    title: 'Sign in · through Okta',
    what: 'An ire.events address: Continue to Okta',
    href: signInSsoHref('sso_handoff', SAMPLE.email),
  },
  {
    title: 'Sign in · Okta required',
    what: 'Priya: a password, Google and Apple refused',
    href: signInSsoHref('sso_required', SSO_MEMBER),
  },
  {
    title: 'Sign in · Okta required, an owner',
    what: 'Folake can still sign in another way',
    href: signInSsoHref('sso_required', SAMPLE.email),
  },
];
