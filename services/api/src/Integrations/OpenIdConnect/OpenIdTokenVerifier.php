<?php

declare(strict_types=1);

namespace App\Integrations\OpenIdConnect;

use App\Domain\User\Interfaces\IdTokenVerifierInterface;
use App\Domain\User\Provider\ProviderClaims;
use App\Enum\ErrorCode;
use App\Enum\IdentityProvider;
use App\Http\Exception\ApiException;
use DateInterval;
use Lcobucci\JWT\Encoding\JoseEncoder;
use Lcobucci\JWT\Signer\Key\InMemory;
use Lcobucci\JWT\Signer\Rsa\Sha256;
use Lcobucci\JWT\Token\Parser;
use Lcobucci\JWT\UnencryptedToken;
use Lcobucci\JWT\Validation\Constraint\IssuedBy;
use Lcobucci\JWT\Validation\Constraint\LooseValidAt;
use Lcobucci\JWT\Validation\Constraint\PermittedFor;
use Lcobucci\JWT\Validation\Constraint\SignedWith;
use Lcobucci\JWT\Validation\Validator;
use Psl\Str;
use Psr\Clock\ClockInterface;
use SensitiveParameter;
use Throwable;

/** RS256 only: a token that names another algorithm is refused rather than checked some other way. */
final readonly class OpenIdTokenVerifier implements IdTokenVerifierInterface
{
    /** The skew allowed between a provider's clock and ours. */
    private const string LEEWAY = 'PT60S';

    public function __construct(
        private SigningKeysInterface $signingKeys,
        private ClockInterface $clock,
        private string $googleIssuers,
        private string $googleClientIds,
        private string $appleIssuers,
        private string $appleClientIds,
    ) {
    }

    public function verify(
        IdentityProvider $provider,
        #[SensitiveParameter]
        string $idToken,
        #[SensitiveParameter]
        ?string $rawNonce,
    ): ProviderClaims {
        $token = $this->parse($idToken);
        $validator = new Validator();
        [$issuers, $audiences] = $this->configured($provider);

        $this->verifySignature($provider, $token, $validator);

        $checked = $validator->validate($token, new IssuedBy(...$issuers), new LooseValidAt($this->clock, new DateInterval(self::LEEWAY)))
            && $token->claims()->has('exp')
            && $this->permittedForOneOf($token, $validator, $audiences);

        if (!$checked) {
            throw self::refused();
        }

        $this->verifyNonce($token, $rawNonce);

        $claims = $token->claims();
        $subject = $claims->get('sub');
        $email = $claims->get('email');
        $name = $claims->get('name');

        if (!\is_string($subject) || '' === $subject) {
            throw self::refused();
        }

        return new ProviderClaims(
            $subject,
            \is_string($email) ? $email : null,
            true === $claims->get('email_verified') || 'true' === $claims->get('email_verified'),
            \is_string($name) && '' !== Str\trim($name) ? Str\trim($name) : null,
        );
    }

    private function parse(#[SensitiveParameter] string $idToken): UnencryptedToken
    {
        if ('' === $idToken) {
            throw self::refused();
        }

        try {
            $token = new Parser(new JoseEncoder())->parse($idToken);
        } catch (Throwable) {
            throw self::refused();
        }

        if (!$token instanceof UnencryptedToken || 'RS256' !== $token->headers()->get('alg')) {
            throw self::refused();
        }

        return $token;
    }

    /** @param list<non-empty-string> $audiences */
    private function permittedForOneOf(#[SensitiveParameter] UnencryptedToken $token, Validator $validator, array $audiences): bool
    {
        foreach ($audiences as $audience) {
            if ($validator->validate($token, new PermittedFor($audience))) {
                return true;
            }
        }

        return false;
    }

    /** Keys rotate, and a cached set can be a rotation behind: one fetch afresh before refusing. */
    private function verifySignature(IdentityProvider $provider, #[SensitiveParameter] UnencryptedToken $token, Validator $validator): void
    {
        $keyId = $token->headers()->get('kid');

        if (!\is_string($keyId)) {
            throw self::refused();
        }

        foreach ([false, true] as $fresh) {
            $pem = $this->signingKeys->publicKey($provider, $keyId, $fresh);

            if (null !== $pem && '' !== $pem && $validator->validate($token, new SignedWith(new Sha256(), InMemory::plainText($pem)))) {
                return;
            }
        }

        throw self::refused();
    }

    // The provider got the nonce's hash and the API gets the nonce, so a captured token is useless alone.
    // A token with no nonce claim, as the sandbox issues, is accepted (docs/architecture/sessions.md).
    private function verifyNonce(#[SensitiveParameter] UnencryptedToken $token, #[SensitiveParameter] ?string $rawNonce): void
    {
        $claimed = $token->claims()->get('nonce');

        if (null === $claimed) {
            return;
        }

        if (!\is_string($claimed) || null === $rawNonce || !\hash_equals($claimed, \hash('sha256', $rawNonce))) {
            throw self::refused();
        }
    }

    /** @return array{non-empty-list<non-empty-string>, list<non-empty-string>} */
    private function configured(IdentityProvider $provider): array
    {
        [$issuers, $audiences] = match ($provider) {
            IdentityProvider::Google => [$this->googleIssuers, $this->googleClientIds],
            IdentityProvider::Apple => [$this->appleIssuers, $this->appleClientIds],
        };

        $issuers = ConfiguredList::of($issuers);

        if ([] === $issuers) {
            throw self::refused();
        }

        return [$issuers, ConfiguredList::of($audiences)];
    }

    private static function refused(): ApiException
    {
        return new ApiException(ErrorCode::OAuthTokenInvalid, 'That sign-in could not be checked.');
    }
}
