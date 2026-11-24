<?php

declare(strict_types=1);

namespace App\Tests\Double;

use OpenSSLAsymmetricKey;
use Psl\Encoding\Base64;
use Psl\Iter;
use Psl\Json;
use Psl\SecureRandom;
use Psl\Str\Byte;
use RuntimeException;

/** A P-256 authenticator answering as `PublicKeyCredential.toJSON()` does, holding one credential. */
final class VirtualAuthenticator
{
    public string $credentialId;
    public int $signCount = 0;
    public bool $backedUp = true;
    public string $aaguid = 'fbfc3007154e4ecc8c0b6e020557d7bd';
    private OpenSSLAsymmetricKey $key;

    public function __construct(
        public string $rpId = 'soirely.test',
        public string $origin = 'https://app.soirely.test',
    ) {
        $this->credentialId = SecureRandom\bytes(16);
        $this->key = \openssl_pkey_new(['private_key_type' => \OPENSSL_KEYTYPE_EC, 'curve_name' => 'prime256v1'])
            ?: throw new RuntimeException('openssl made no key');
    }

    /** @return array{id: string, rawId: string, type: string, response: array{clientDataJSON: string, attestationObject: string}} */
    public function create(string $challenge, string $type = 'webauthn.create'): array
    {
        $details = \openssl_pkey_get_details($this->key) ?: throw new RuntimeException('no key details');
        $ec = $details['ec'] ?? throw new RuntimeException('not an EC key');
        $cose = self::map([1 => 2, 3 => -7, -1 => 1, -2 => self::bytes(Byte\pad_left($ec['x'], 32, "\0")), -3 => self::bytes(Byte\pad_left($ec['y'], 32, "\0"))]);
        $authData = $this->authData(0x40) . (\hex2bin($this->aaguid) ?: throw new RuntimeException('AAGUID is not hex')) . \pack('n', Byte\length($this->credentialId)) . $this->credentialId . $cose;
        $attestation = self::map(['fmt' => self::text('none'), 'attStmt' => self::map([]), 'authData' => self::bytes($authData)]);

        return [
            'id' => self::b64($this->credentialId),
            'rawId' => self::b64($this->credentialId),
            'type' => 'public-key',
            'response' => [
                'clientDataJSON' => self::b64($this->clientData($type, $challenge)),
                'attestationObject' => self::b64($attestation),
            ],
        ];
    }

    /** @return array{id: string, rawId: string, type: string, response: array{clientDataJSON: string, authenticatorData: string, signature: string}} */
    public function get(string $challenge, string $type = 'webauthn.get'): array
    {
        ++$this->signCount;
        $authData = $this->authData(0);
        $clientData = $this->clientData($type, $challenge);
        \openssl_sign($authData . \hash('sha256', $clientData, true), $signature, $this->key, \OPENSSL_ALGO_SHA256);

        return [
            'id' => self::b64($this->credentialId),
            'rawId' => self::b64($this->credentialId),
            'type' => 'public-key',
            'response' => [
                'clientDataJSON' => self::b64($clientData),
                'authenticatorData' => self::b64($authData),
                'signature' => self::b64($signature),
            ],
        ];
    }

    /** The challenge out of options the server sent, base64url as WebAuthn's JSON carries it. */
    public static function challengeOf(array $options): string
    {
        return Base64\decode($options['challenge'], Base64\Variant::UrlSafe, explicitPadding: false);
    }

    private function authData(int $extraFlags): string
    {
        // User present, user verified, backup eligible, and backed up when it is.
        $flags = 0x01 | 0x04 | 0x08 | ($this->backedUp ? 0x10 : 0) | $extraFlags;

        return \hash('sha256', $this->rpId, true) . Byte\chr($flags) . \pack('N', $this->signCount);
    }

    private function clientData(string $type, string $challenge): string
    {
        return Json\encode(['type' => $type, 'challenge' => self::b64($challenge), 'origin' => $this->origin, 'crossOrigin' => false]);
    }

    private static function b64(string $bytes): string
    {
        return Base64\encode($bytes, Base64\Variant::UrlSafe, padding: false);
    }

    /** @param array<int|string, string|int> $entries values already encoded, or integers */
    private static function map(array $entries): string
    {
        $out = self::head(5, Iter\count($entries));
        foreach ($entries as $key => $value) {
            $out .= (\is_int($key) ? self::int($key) : self::text($key)) . (\is_int($value) ? self::int($value) : $value);
        }

        return $out;
    }

    private static function int(int $value): string
    {
        return $value >= 0 ? self::head(0, $value) : self::head(1, -1 - $value);
    }

    private static function bytes(string $value): string
    {
        return self::head(2, Byte\length($value)) . $value;
    }

    private static function text(string $value): string
    {
        return self::head(3, Byte\length($value)) . $value;
    }

    private static function head(int $major, int $argument): string
    {
        return match (true) {
            $argument < 24 => Byte\chr(($major << 5) | $argument),
            $argument < 0x100 => Byte\chr(($major << 5) | 24) . Byte\chr($argument),
            $argument < 0x10000 => Byte\chr(($major << 5) | 25) . \pack('n', $argument),
            default => Byte\chr(($major << 5) | 26) . \pack('N', $argument),
        };
    }
}
