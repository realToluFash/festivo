<?php

declare(strict_types=1);

namespace App\WebAuthn;

use App\WebAuthn\Exception\CeremonyRefused;
use App\WebAuthn\Model\CheckedAssertion;
use App\WebAuthn\Model\NewCredential;
use Psl\Encoding\Base64;
use Psl\Json;
use Psl\Str;
use Psl\Str\Byte;
use Psl\Type;
use Throwable;

/** The relying party's checks on a registration (WebAuthn Level 3 §7.1) and an assertion (§7.2). */
final readonly class Ceremonies
{
    private const int USER_PRESENT = 0x01;
    private const int USER_VERIFIED = 0x04;
    private const int BACKUP_ELIGIBLE = 0x08;
    private const int BACKED_UP = 0x10;
    private const int ATTESTED_CREDENTIAL = 0x40;
    private const int MAX_CREDENTIAL_ID = 1023;

    public function __construct(
        private Cbor $cbor,
        private CoseKey $coseKey,
    ) {
    }

    /** The challenge the client signed over, to find what this ceremony answers before checking anything else. */
    public function challengeOf(string $clientDataJson): string
    {
        return $this->bytes($this->clientData($clientDataJson)['challenge']);
    }

    public function register(RelyingParty $party, string $clientDataJson, string $attestationObject, string $challenge): NewCredential
    {
        $this->checkClientData($party, $clientDataJson, 'webauthn.create', $challenge);
        [$attestation] = $this->cbor->decode($attestationObject);
        $authData = \is_array($attestation) ? ($attestation['authData'] ?? null) : null;

        if (!\is_string($authData)) {
            throw new CeremonyRefused('attestation object has no authenticator data');
        }

        $flags = $this->checkAuthData($party, $authData);

        if (0 === ($flags & self::ATTESTED_CREDENTIAL) || Byte\length($authData) < 55) {
            throw new CeremonyRefused('no attested credential');
        }

        $aaguid = \bin2hex(Byte\slice($authData, 37, 16));
        $idLength = \unpack('n', Byte\slice($authData, 53, 2))[1];

        if ($idLength < 1 || $idLength > self::MAX_CREDENTIAL_ID) {
            throw new CeremonyRefused('credential id length out of range');
        }

        $id = $this->slice($authData, 55, $idLength);
        [$cose] = $this->cbor->decode($authData, 55 + $idLength);

        if (!\is_array($cose)) {
            throw new CeremonyRefused('credential public key is not a map');
        }

        return new NewCredential(
            Base64\encode($id, Base64\Variant::UrlSafe, padding: false),
            $this->coseKey->toPem($cose),
            Str\join([Byte\slice($aaguid, 0, 8), Byte\slice($aaguid, 8, 4), Byte\slice($aaguid, 12, 4), Byte\slice($aaguid, 16, 4), Byte\slice($aaguid, 20)], '-'),
            0 !== ($flags & self::BACKED_UP),
            $this->signCount($authData),
        );
    }

    public function assert(
        RelyingParty $party,
        string $clientDataJson,
        string $authenticatorData,
        string $signature,
        string $challenge,
        string $publicKeyPem,
        int $storedSignCount,
    ): CheckedAssertion {
        $this->checkClientData($party, $clientDataJson, 'webauthn.get', $challenge);
        $flags = $this->checkAuthData($party, $authenticatorData);

        $signed = $authenticatorData . \hash('sha256', $clientDataJson, true);
        if (1 !== \openssl_verify($signed, $signature, $publicKeyPem, \OPENSSL_ALGO_SHA256)) {
            throw new CeremonyRefused('signature does not verify');
        }

        $count = $this->signCount($authenticatorData);
        // §7.2 step 22: a counter that has not moved past the stored one may be a cloned authenticator.
        if (($count > 0 || $storedSignCount > 0) && $count <= $storedSignCount) {
            throw new CeremonyRefused('signature counter did not increase');
        }

        return new CheckedAssertion(0 !== ($flags & self::BACKED_UP), $count);
    }

    private function checkClientData(RelyingParty $party, string $json, string $type, string $challenge): void
    {
        $data = $this->clientData($json);

        if ($type !== $data['type']) {
            throw new CeremonyRefused('client data type is not ' . $type);
        }

        if (!\hash_equals($challenge, $this->bytes($data['challenge']))) {
            throw new CeremonyRefused('challenge does not match');
        }

        if ($party->origin !== $data['origin'] || true === ($data['crossOrigin'] ?? false)) {
            throw new CeremonyRefused('origin does not match');
        }
    }

    /** @return int the flags byte */
    private function checkAuthData(RelyingParty $party, string $authData): int
    {
        if (null === $party->id || Byte\length($authData) < 37) {
            throw new CeremonyRefused('authenticator data too short, or no relying party');
        }

        if (!\hash_equals(\hash('sha256', $party->id, true), Byte\slice($authData, 0, 32))) {
            throw new CeremonyRefused('relying party id hash does not match');
        }

        $flags = \ord($authData[32]);

        if (0 === ($flags & self::USER_PRESENT) || 0 === ($flags & self::USER_VERIFIED)) {
            throw new CeremonyRefused('user not present or not verified');
        }

        if (0 !== ($flags & self::BACKED_UP) && 0 === ($flags & self::BACKUP_ELIGIBLE)) {
            throw new CeremonyRefused('backed up but not backup eligible');
        }

        return $flags;
    }

    private function signCount(string $authData): int
    {
        return \unpack('N', Byte\slice($authData, 33, 4))[1];
    }

    /** @return array{type: string, challenge: string, origin: string, crossOrigin?: bool, ...} */
    private function clientData(string $json): array
    {
        try {
            return Json\typed($json, Type\shape([
                'type' => Type\string(),
                'challenge' => Type\string(),
                'origin' => Type\string(),
                'crossOrigin' => Type\optional(Type\bool()),
            ], true));
        } catch (Throwable) {
            throw new CeremonyRefused('client data is not the JSON WebAuthn writes');
        }
    }

    private function bytes(string $base64Url): string
    {
        try {
            return Base64\decode($base64Url, Base64\Variant::UrlSafe, explicitPadding: false);
        } catch (Throwable) {
            throw new CeremonyRefused('not base64url');
        }
    }

    private function slice(string $bytes, int $offset, int $length): string
    {
        if ($offset < 0 || $length < 0 || $offset + $length > Byte\length($bytes)) {
            throw new CeremonyRefused('authenticator data ends early');
        }

        return Byte\slice($bytes, $offset, $length);
    }
}
