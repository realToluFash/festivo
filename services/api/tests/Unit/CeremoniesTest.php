<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Tests\Double\VirtualAuthenticator;
use App\WebAuthn\Cbor;
use App\WebAuthn\Ceremonies;
use App\WebAuthn\CoseKey;
use App\WebAuthn\Exception\CeremonyRefused;
use App\WebAuthn\Model\CheckedAssertion;
use App\WebAuthn\Model\NewCredential;
use App\WebAuthn\RelyingParty;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psl\Encoding\Base64;
use RuntimeException;

final class CeremoniesTest extends TestCase
{
    private Ceremonies $ceremonies;
    private RelyingParty $party;
    private VirtualAuthenticator $authenticator;

    protected function setUp(): void
    {
        $this->ceremonies = new Ceremonies(new Cbor(), new CoseKey());
        $this->party = new RelyingParty('soirely.test', 'https://app.soirely.test');
        $this->authenticator = new VirtualAuthenticator();
    }

    public function testARegistrationAndItsAssertionsCheckOut(): void
    {
        $credential = $this->register('first');

        self::assertSame(Base64\encode($this->authenticator->credentialId, Base64\Variant::UrlSafe, padding: false), $credential->id);
        self::assertSame('fbfc3007-154e-4ecc-8c0b-6e020557d7bd', $credential->aaguid);
        self::assertTrue($credential->backedUp);

        $this->authenticator->backedUp = false;
        $checked = $this->assertWith($this->authenticator->get('second'), 'second', $credential->publicKeyPem, 0);

        self::assertFalse($checked->backedUp);
        self::assertSame(1, $checked->signCount);
    }

    public function testTheChallengeIsReadBackFromTheClientData(): void
    {
        $response = $this->authenticator->get('the challenge');

        self::assertSame('the challenge', $this->ceremonies->challengeOf($this->decoded($response['response']['clientDataJSON'])));
    }

    /** @return iterable<string, array{0: callable(VirtualAuthenticator): void, 1: string, 2: RelyingParty|null}> */
    public static function refusals(): iterable
    {
        yield 'another relying party' => [static fn (VirtualAuthenticator $a) => $a->rpId = 'soirely.com', 'challenge', null];
        yield 'another origin' => [static fn (VirtualAuthenticator $a) => $a->origin = 'http://evil.localhost:5173', 'challenge', null];
        yield 'another challenge' => [static fn () => null, 'other', null];
        yield 'no relying party set' => [static fn () => null, 'challenge', new RelyingParty('127.0.0.1', 'http://127.0.0.1:5173')];
    }

    #[DataProvider('refusals')]
    public function testAnAssertionThatDoesNotMatchIsRefused(callable $change, string $expected, ?RelyingParty $party): void
    {
        $credential = $this->register('first');
        $change($this->authenticator);

        $this->expectException(CeremonyRefused::class);
        $this->assertWith($this->authenticator->get('challenge'), $expected, $credential->publicKeyPem, 0, $party);
    }

    public function testAnotherKeysSignatureIsRefused(): void
    {
        $credential = $this->register('first');

        $this->expectException(CeremonyRefused::class);
        $this->assertWith(new VirtualAuthenticator()->get('challenge'), 'challenge', $credential->publicKeyPem, 0);
    }

    public function testACounterThatDidNotMoveIsRefused(): void
    {
        $credential = $this->register('first');

        $this->expectException(CeremonyRefused::class);
        $this->assertWith($this->authenticator->get('challenge'), 'challenge', $credential->publicKeyPem, 5);
    }

    public function testAnAssertionIsNotARegistration(): void
    {
        $this->expectException(CeremonyRefused::class);
        $response = $this->authenticator->create('challenge', 'webauthn.get');
        $this->ceremonies->register($this->party, $this->decoded($response['response']['clientDataJSON']), $this->decoded($response['response']['attestationObject']), 'challenge');
    }

    public function testAnIpAddressIsNoRelyingParty(): void
    {
        self::assertNull(new RelyingParty('127.0.0.1', 'http://127.0.0.1:5173')->id);
        self::assertNull(new RelyingParty('', 'http://localhost:5173')->id);
        self::assertNull(new RelyingParty('localhost', 'http://127.0.0.1:45173')->id);
        self::assertSame('qa2.localhost', new RelyingParty('qa2.localhost', 'http://qa2.localhost:25173')->id);
        self::assertSame('soirely.com', new RelyingParty('soirely.com', 'https://app.soirely.com')->id);
    }

    public function testAnRsaKeyBecomesAPemOpensslReads(): void
    {
        $key = \openssl_pkey_new(['private_key_type' => \OPENSSL_KEYTYPE_RSA, 'private_key_bits' => 2048]);
        self::assertNotFalse($key);
        $rsa = (\openssl_pkey_get_details($key) ?: throw new RuntimeException('no key details'))['rsa'] ?? throw new RuntimeException('no RSA parts');

        $pem = new CoseKey()->toPem([1 => 3, 3 => -257, -1 => $rsa['n'], -2 => $rsa['e']]);

        $read = \openssl_pkey_get_details(\openssl_pkey_get_public($pem) ?: throw new RuntimeException($pem)) ?: throw new RuntimeException('no key details');

        self::assertSame($rsa['n'], ($read['rsa'] ?? throw new RuntimeException('no RSA parts'))['n']);
    }

    private function register(string $challenge): NewCredential
    {
        $response = $this->authenticator->create($challenge);

        return $this->ceremonies->register(
            $this->party,
            $this->decoded($response['response']['clientDataJSON']),
            $this->decoded($response['response']['attestationObject']),
            $challenge,
        );
    }

    /** @param array{response: array{clientDataJSON: string, authenticatorData: string, signature: string}, ...} $response */
    private function assertWith(array $response, string $challenge, string $pem, int $stored, ?RelyingParty $party = null): CheckedAssertion
    {
        return $this->ceremonies->assert(
            $party ?? $this->party,
            $this->decoded($response['response']['clientDataJSON']),
            $this->decoded($response['response']['authenticatorData']),
            $this->decoded($response['response']['signature']),
            $challenge,
            $pem,
            $stored,
        );
    }

    private function decoded(string $base64Url): string
    {
        return Base64\decode($base64Url, Base64\Variant::UrlSafe, explicitPadding: false);
    }
}
