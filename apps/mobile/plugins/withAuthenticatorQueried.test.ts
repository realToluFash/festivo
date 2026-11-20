import { describe, expect, it } from 'vitest';

import { withAuthenticatorQuery } from './withAuthenticatorQueried.ts';

const ROOT = { 'xmlns:android': 'http://schemas.android.com/apk/res/android' };

const BROWSABLE = {
  intent: [
    {
      action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
      category: [{ $: { 'android:name': 'android.intent.category.BROWSABLE' } }],
      data: [{ $: { 'android:scheme': 'https' } }],
    },
  ],
};

const OTPAUTH = {
  intent: [
    {
      action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
      data: [{ $: { 'android:scheme': 'otpauth' } }],
    },
  ],
};

describe('withAuthenticatorQuery', () => {
  it('adds a VIEW query for otpauth beside the template’s', () => {
    const manifest = withAuthenticatorQuery({ manifest: { $: ROOT, queries: [BROWSABLE] } });

    expect(manifest.manifest.queries).toEqual([BROWSABLE, OTPAUTH]);
  });

  it('adds it where the manifest has no queries', () => {
    const manifest = withAuthenticatorQuery({
      manifest: { $: ROOT } as Parameters<typeof withAuthenticatorQuery>[0]['manifest'],
    });

    expect(manifest.manifest.queries).toEqual([OTPAUTH]);
  });

  it('leaves a manifest that already asks as it is', () => {
    const manifest = withAuthenticatorQuery({
      manifest: { $: ROOT, queries: [BROWSABLE, OTPAUTH] },
    });

    expect(manifest.manifest.queries).toEqual([BROWSABLE, OTPAUTH]);
  });
});
