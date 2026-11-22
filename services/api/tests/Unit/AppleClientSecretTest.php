<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Enum\IdentityProvider;
use App\Http\Exception\ApiException;
use App\Integrations\OpenIdConnect\AppleClientSecret;
use App\Integrations\OpenIdConnect\HttpCodeRedeemer;
use DateTimeImmutable;
use Lcobucci\JWT\Encoding\JoseEncoder;
use Lcobucci\JWT\Signer\Ecdsa\Sha256;
use Lcobucci\JWT\Signer\Key\InMemory;
use Lcobucci\JWT\Token\Parser;
use Lcobucci\JWT\UnencryptedToken;
use LogicException;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psr\Log\LoggerInterface;
use Psr\Log\NullLogger;
use SensitiveParameter;
use Symfony\Component\Clock\MockClock;
use Symfony\Component\ErrorHandler\BufferingLogger;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class AppleClientSecretTest extends TestCase
{
    private const string NOW = '2026-11-22 10:00:00';

    private const string APPLE_ANSWER = 'apple.id.token';

    private const string GOOGLE_ANSWER = 'google.id.token';

    private const string GOOGLE_WEB_CLIENT_CREDENTIAL = 'google-web-client';

    #[Test]
    public function theSecretIsTheJwtAppleDescribes(): void
    {
        [$private, $public] = self::keyPair('prime256v1');

        $jwt = self::secret($private)->issue();

        self::assertNotNull($jwt);
        $token = self::parse($jwt);
        self::assertSame('ES256', $token->headers()->get('alg'));
        self::assertSame('KEY123', $token->headers()->get('kid'));
        self::assertSame('TEAM123', $token->claims()->get('iss'));
        self::assertSame('soirely-web.test', $token->claims()->get('sub'));
        self::assertSame(['https://appleid.apple.com'], $token->claims()->get('aud'));
        self::assertTrue(new Sha256()->verify($token->signature()->hash(), $token->payload(), InMemory::plainText($public)));
    }

    #[Test]
    public function theSecretExpiresMinutesAfterItIsMadeAndWithinAppleSSixMonths(): void
    {
        [$private] = self::keyPair('prime256v1');

        $payload = Json\decode(self::base64UrlDecode(Str\split(Type\string()->coerce(self::secret($private)->issue()), '.')[1]));
        $claims = Type\shape(['iat' => Type\int(), 'exp' => Type\int()], true)->coerce($payload);

        self::assertSame(new DateTimeImmutable(self::NOW)->getTimestamp(), $claims['iat']);
        self::assertSame(AppleClientSecret::LIFETIME_SECONDS, $claims['exp'] - $claims['iat']);
        self::assertLessThanOrEqual(15_777_000, AppleClientSecret::LIFETIME_SECONDS);
    }

    #[Test]
    public function eachRedemptionGetsASecretMadeThen(): void
    {
        [$private] = self::keyPair('prime256v1');
        $clock = new MockClock(self::NOW);
        $secret = self::secret($private, $clock);

        $first = self::parse(Type\string()->coerce($secret->issue()));
        $clock->sleep(3600);
        $second = self::parse(Type\string()->coerce($secret->issue()));

        self::assertTrue($first->isExpired($clock->now()));
        self::assertFalse($second->isExpired($clock->now()));
    }

    #[Test]
    public function aKeyWithEscapedNewlinesReadsAsTheKey(): void
    {
        [$private] = self::keyPair('prime256v1');

        self::assertNotNull(self::secret(Str\replace($private, "\n", '\n'))->issue());
    }

    #[Test]
    public function aMissingKeyIsLoggedWithoutTheKeyAndMakesNoSecret(): void
    {
        $logger = new BufferingLogger();

        self::assertNull(self::secret('', logger: $logger)->issue());
        self::assertSame('error', $logger->cleanLogs()[0][0]);
    }

    #[Test]
    public function aKeyThatIsNotP256IsNotUsedAndNeverLogged(): void
    {
        foreach ([self::keyPair('secp384r1')[0], self::rsaKey(), 'not a key at all'] as $wrong) {
            $logger = new BufferingLogger();

            self::assertNull(self::secret($wrong, logger: $logger)->issue());

            $logs = $logger->cleanLogs();
            self::assertCount(1, $logs);
            self::assertSame('error', $logs[0][0]);
            self::assertStringNotContainsString($wrong, Json\encode([$logs[0][1], $logs[0][2]]));
        }
    }

    #[Test]
    public function appleIsSentTheSignedSecret(): void
    {
        [$private] = self::keyPair('prime256v1');
        $sent = [];
        $client = new MockHttpClient(static function (string $method, string $url, array $options) use (&$sent): MockResponse {
            \parse_str(Type\string()->coerce($options['body']), $sent);

            return new MockResponse(Json\encode(['id_token' => self::APPLE_ANSWER]));
        });

        $idToken = self::redeemer($client, self::secret($private))->redeem(IdentityProvider::Apple, 'code', 'verifier', 'https://soirely.test/return');

        self::assertSame(self::APPLE_ANSWER, $idToken);
        self::assertSame('soirely-web.test', $sent['client_id'] ?? null);
        self::assertSame('TEAM123', self::parse(Type\string()->coerce($sent['client_secret'] ?? null))->claims()->get('iss'));
    }

    #[Test]
    public function withoutAKeyAppleIsNotCalledAndTheCodeIsNotRedeemed(): void
    {
        $client = new MockHttpClient(static fn (): never => throw new LogicException('Apple was called without a secret.'));

        try {
            self::redeemer($client, self::secret(''))->redeem(IdentityProvider::Apple, 'code', 'verifier', 'https://soirely.test/return');
            self::fail('The code was redeemed without a secret.');
        } catch (ApiException $exception) {
            self::assertSame('provider.code_not_redeemed', $exception->getMessage());
        }
    }

    #[Test]
    public function googleStillRedeemsWithItsOwnSecretWhenAppleSKeyIsMissing(): void
    {
        $sent = [];
        $client = new MockHttpClient(static function (string $method, string $url, array $options) use (&$sent): MockResponse {
            \parse_str(Type\string()->coerce($options['body']), $sent);

            return new MockResponse(Json\encode(['id_token' => self::GOOGLE_ANSWER]));
        });

        $idToken = self::redeemer($client, self::secret(''))->redeem(IdentityProvider::Google, 'code', 'verifier', 'https://soirely.test/return');

        self::assertSame(self::GOOGLE_ANSWER, $idToken);
        self::assertSame(self::GOOGLE_WEB_CLIENT_CREDENTIAL, $sent['client_secret'] ?? null);
    }

    private static function secret(#[SensitiveParameter] string $privateKey, ?MockClock $clock = null, ?LoggerInterface $logger = null): AppleClientSecret
    {
        return new AppleClientSecret($privateKey, 'KEY123', 'TEAM123', 'soirely-web.test', $clock ?? new MockClock(self::NOW), $logger ?? new NullLogger());
    }

    private static function redeemer(MockHttpClient $client, #[SensitiveParameter] AppleClientSecret $secret): HttpCodeRedeemer
    {
        return new HttpCodeRedeemer($client, 'https://google.test/token', 'google-web', self::GOOGLE_WEB_CLIENT_CREDENTIAL, 'https://appleid.apple.test/token', 'soirely-web.test', $secret);
    }

    private static function parse(string $jwt): UnencryptedToken
    {
        return Type\instance_of(UnencryptedToken::class)->coerce(new Parser(new JoseEncoder())->parse(Type\non_empty_string()->coerce($jwt)));
    }

    private static function base64UrlDecode(string $part): string
    {
        return Type\string()->coerce(\base64_decode(\strtr($part, '-_', '+/'), true));
    }

    /** @return array{non-empty-string, non-empty-string} */
    private static function keyPair(string $curve): array
    {
        $key = \openssl_pkey_new(['private_key_type' => \OPENSSL_KEYTYPE_EC, 'curve_name' => $curve]) ?: throw new LogicException('OpenSSL could not make a key.');
        \openssl_pkey_export($key, $private);
        $details = \openssl_pkey_get_details($key) ?: throw new LogicException('OpenSSL could not read the key.');

        return [Type\non_empty_string()->coerce($private), Type\non_empty_string()->coerce($details['key'] ?? null)];
    }

    private static function rsaKey(): string
    {
        $key = \openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => \OPENSSL_KEYTYPE_RSA]) ?: throw new LogicException('OpenSSL could not make a key.');
        \openssl_pkey_export($key, $private);

        return Type\string()->coerce($private);
    }
}
