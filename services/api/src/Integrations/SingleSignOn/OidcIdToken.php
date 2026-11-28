<?php

declare(strict_types=1);

namespace App\Integrations\SingleSignOn;

use App\Domain\Organisation\Interfaces\OrganisationIdTokenInterface;
use App\Domain\Organisation\Interfaces\ProviderDocumentsInterface;
use App\Domain\Organisation\SingleSignOn\Model\OidcAnswer;
use App\Entity\SsoProvider;
use App\Integrations\OpenIdConnect\RsaJwk;
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
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psr\Clock\ClockInterface;
use SensitiveParameter;
use Throwable;

/** An organisation provider's ID token: sc-58's checks, but against its own issuer, client and keys, and the nonce is required. */
final readonly class OidcIdToken implements OrganisationIdTokenInterface
{
    private const string LEEWAY = 'PT60S';

    public function __construct(
        private ProviderDocumentsInterface $providerDocuments,
        private ClockInterface $clock,
    ) {
    }

    public function read(SsoProvider $provider, #[SensitiveParameter] string $idToken, string $nonce): ?OidcAnswer
    {
        $issuer = $provider->getOidcIssuer();
        $clientId = $provider->getOidcClientId();

        if ('' === $idToken || null === $issuer || '' === $issuer || null === $clientId || '' === $clientId) {
            return null;
        }

        try {
            $token = new Parser(new JoseEncoder())->parse($idToken);
        } catch (Throwable) {
            return null;
        }

        if (!$token instanceof UnencryptedToken || 'RS256' !== $token->headers()->get('alg')) {
            return null;
        }

        $keyId = $token->headers()->get('kid');
        $pem = \is_string($keyId) ? $this->publicKey($provider, $keyId) : null;

        if (null === $pem || '' === $pem) {
            return null;
        }

        $checked = new Validator()->validate(
            $token,
            new SignedWith(new Sha256(), InMemory::plainText($pem)),
            new IssuedBy($issuer),
            new PermittedFor($clientId),
            new LooseValidAt($this->clock, new DateInterval(self::LEEWAY)),
        );
        $claims = $token->claims();

        if (!$checked || !$claims->has('exp') || $nonce !== $claims->get('nonce')) {
            return null;
        }

        $email = $claims->get('email');
        $name = $claims->get('name');

        return new OidcAnswer(\is_string($email) && '' !== $email ? $email : null, \is_string($name) ? Str\trim($name) : '');
    }

    // ponytail: the key set is read on every answer; cache it as HttpSigningKeys does if sign-in traffic asks for it.
    private function publicKey(SsoProvider $provider, string $keyId): ?string
    {
        $body = $this->providerDocuments->fetch($provider->getOidcJwksUri() ?? '');

        if (null === $body) {
            return null;
        }

        try {
            $set = Type\shape([
                'keys' => Type\vec(Type\shape([
                    'kty' => Type\string(),
                    'kid' => Type\optional(Type\string()),
                    'n' => Type\optional(Type\string()),
                    'e' => Type\optional(Type\string()),
                ], true)),
            ], true)->coerce(Json\decode($body));
        } catch (Json\Exception\DecodeException|Type\Exception\CoercionException) {
            return null;
        }

        foreach ($set['keys'] as $key) {
            if ('RSA' === $key['kty'] && $keyId === ($key['kid'] ?? null) && isset($key['n'], $key['e'])) {
                return RsaJwk::toPem($key['n'], $key['e']);
            }
        }

        return null;
    }
}
