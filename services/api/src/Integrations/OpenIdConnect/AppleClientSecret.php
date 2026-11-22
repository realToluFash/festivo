<?php

declare(strict_types=1);

namespace App\Integrations\OpenIdConnect;

use DateTimeImmutable;
use Lcobucci\JWT\Encoding\ChainedFormatter;
use Lcobucci\JWT\Encoding\JoseEncoder;
use Lcobucci\JWT\Exception as JwtException;
use Lcobucci\JWT\Signer\Ecdsa\Sha256;
use Lcobucci\JWT\Signer\Key\InMemory;
use Lcobucci\JWT\Token\Builder;
use Psl\Dict;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Psr\Log\LoggerInterface;
use SensitiveParameter;

/** Apple's web client secret: an ES256 JWT made fresh for each redemption, so none is sent after its `exp`. */
final readonly class AppleClientSecret
{
    public const string AUDIENCE = 'https://appleid.apple.com';

    public const int LIFETIME_SECONDS = 300;

    public function __construct(
        #[SensitiveParameter]
        private string $privateKey,
        private string $keyId,
        private string $teamId,
        private string $clientId,
        private ClockInterface $clock,
        private LoggerInterface $logger,
    ) {
    }

    /** Null when a setting is empty or the key is not a P-256 private key, each logged by name and without the key. */
    public function issue(): ?string
    {
        $pem = Str\replace($this->privateKey, '\n', "\n");

        $missing = Vec\keys(Dict\filter(
            [
                'OAUTH_APPLE_WEB_PRIVATE_KEY' => $pem,
                'OAUTH_APPLE_WEB_KEY_ID' => $this->keyId,
                'OAUTH_APPLE_TEAM_ID' => $this->teamId,
                'OAUTH_APPLE_WEB_CLIENT_ID' => $this->clientId,
            ],
            static fn (string $value): bool => '' === $value,
        ));

        if ([] !== $missing) {
            $settings = Str\join($missing, ', ');
            $this->logger->error('Sign in with Apple is missing ' . $settings . ', so web sign-in with Apple cannot redeem codes.', ['settings' => $settings]);

            return null;
        }

        if (!self::isP256PrivateKey($pem)) {
            $this->logger->error('The Sign in with Apple private key could not be read, so web sign-in with Apple cannot redeem codes.', ['keyId' => $this->keyId]);

            return null;
        }

        $issuedAt = DateTimeImmutable::createFromInterface($this->clock->now());

        try {
            return Builder::new(new JoseEncoder(), ChainedFormatter::withUnixTimestampDates())
                ->withHeader('kid', $this->keyId)
                ->issuedBy(Type\non_empty_string()->coerce($this->teamId))
                ->relatedTo(Type\non_empty_string()->coerce($this->clientId))
                ->permittedFor(self::AUDIENCE)
                ->issuedAt($issuedAt)
                ->expiresAt($issuedAt->modify('+' . self::LIFETIME_SECONDS . ' seconds'))
                ->getToken(new Sha256(), InMemory::plainText(Type\non_empty_string()->coerce($pem)))
                ->toString();
        } catch (JwtException) {
            $this->logger->error('The Sign in with Apple private key could not sign the client secret.', ['keyId' => $this->keyId]);

            return null;
        }
    }

    private static function isP256PrivateKey(#[SensitiveParameter] string $pem): bool
    {
        $key = \openssl_pkey_get_private($pem);

        do {
            $error = \openssl_error_string();
        } while (false !== $error);

        if (false === $key) {
            return false;
        }

        $details = \openssl_pkey_get_details($key);

        return false !== $details && \OPENSSL_KEYTYPE_EC === ($details['type'] ?? null) && 'prime256v1' === ($details['ec']['curve_name'] ?? null);
    }
}
