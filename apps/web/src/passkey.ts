import type { PasskeyAnswer, PasskeyOptions } from '@soirely/api-client';

/** Whether this browser can open a passkey sheet at all. */
export function canUsePasskeys(): boolean {
  return typeof window !== 'undefined' && typeof window.PublicKeyCredential === 'function';
}

/** `null` when the sheet was closed or timed out: nothing is sent then. */
export async function askPasskey(options: PasskeyOptions): Promise<PasskeyAnswer | null> {
  const publicKey: PublicKeyCredentialRequestOptions = {
    ...(options as unknown as PublicKeyCredentialRequestOptions),
    challenge: bytes(options.challenge),
    allowCredentials: list(options.allowCredentials).map((one) => ({
      ...(one as unknown as PublicKeyCredentialDescriptor),
      id: bytes(one.id),
    })),
  };

  return answer(await sheet(() => navigator.credentials.get({ publicKey })));
}

export async function makePasskey(options: PasskeyOptions): Promise<PasskeyAnswer | null> {
  const user = (options.user ?? {}) as Record<string, unknown>;
  const publicKey: PublicKeyCredentialCreationOptions = {
    ...(options as unknown as PublicKeyCredentialCreationOptions),
    challenge: bytes(options.challenge),
    user: { ...(user as unknown as PublicKeyCredentialUserEntity), id: bytes(user.id) },
    excludeCredentials: list(options.excludeCredentials).map((one) => ({
      ...(one as unknown as PublicKeyCredentialDescriptor),
      id: bytes(one.id),
    })),
  };

  return answer(await sheet(() => navigator.credentials.create({ publicKey })));
}

async function sheet(open: () => Promise<Credential | null>): Promise<Credential | null> {
  try {
    return await open();
  } catch (error) {
    if (error instanceof DOMException && ['NotAllowedError', 'AbortError'].includes(error.name)) {
      return null;
    }
    throw error;
  }
}

function answer(credential: Credential | null): PasskeyAnswer | null {
  if (!(credential instanceof PublicKeyCredential)) return null;

  const response = credential.response;
  const written: Record<string, string> = { clientDataJSON: text(response.clientDataJSON) };

  if (response instanceof AuthenticatorAttestationResponse) {
    written.attestationObject = text(response.attestationObject);
  } else if (response instanceof AuthenticatorAssertionResponse) {
    written.authenticatorData = text(response.authenticatorData);
    written.signature = text(response.signature);
  }

  return {
    id: credential.id,
    rawId: text(credential.rawId),
    type: credential.type,
    response: written,
  };
}

function list(raw: unknown): Record<string, unknown>[] {
  return Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
}

function bytes(raw: unknown): ArrayBuffer {
  const base64 = String(raw).replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='));

  return Uint8Array.from(binary, (char) => char.charCodeAt(0)).buffer;
}

function text(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
