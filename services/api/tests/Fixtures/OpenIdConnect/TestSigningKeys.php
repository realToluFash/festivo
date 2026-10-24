<?php

declare(strict_types=1);

namespace App\Tests\Fixtures\OpenIdConnect;

use App\Enum\IdentityProvider;
use App\Integrations\OpenIdConnect\RsaJwk;
use App\Integrations\OpenIdConnect\SigningKeysInterface;
use DateTimeImmutable;
use Lcobucci\JWT\Encoding\ChainedFormatter;
use Lcobucci\JWT\Encoding\JoseEncoder;
use Lcobucci\JWT\Signer\Key\InMemory;
use Lcobucci\JWT\Signer\Rsa\Sha256;
use Lcobucci\JWT\Token\Builder;
use LogicException;
use OpenSSLAsymmetricKey;
use Psl\Str;
use Psl\Type;

/** A provider the suite controls: it signs tokens, and can rotate its key under the same id as the sandbox does. */
final class TestSigningKeys implements SigningKeysInterface
{
    public const string KEY_ID = 'test-key-1';

    private OpenSSLAsymmetricKey $current;

    private ?string $published = null;

    public int $fetches = 0;

    public function __construct()
    {
        $this->current = self::generate();
    }

    public function publicKey(IdentityProvider $provider, string $keyId, bool $fresh): ?string
    {
        if ($fresh || null === $this->published) {
            ++$this->fetches;
            $this->published = $this->asPublished($this->current);
        }

        return self::KEY_ID === $keyId ? $this->published : null;
    }

    /** A new key under the old id: whatever was fetched before is now a rotation behind. */
    public function rotate(): void
    {
        $this->current = self::generate();
    }

    /** @param array<string, mixed> $claims */
    public function sign(array $claims, ?OpenSSLAsymmetricKey $with = null, string $keyId = self::KEY_ID): string
    {
        $builder = Builder::new(new JoseEncoder(), ChainedFormatter::default())->withHeader('kid', $keyId);

        foreach ($claims as $name => $value) {
            $builder = match ($name) {
                'iss' => $builder->issuedBy(Type\non_empty_string()->coerce($value)),
                'aud' => $builder->permittedFor(Type\non_empty_string()->coerce($value)),
                'sub' => $builder->relatedTo(Type\non_empty_string()->coerce($value)),
                'iat' => $builder->issuedAt(Type\instance_of(DateTimeImmutable::class)->coerce($value)),
                'exp' => $builder->expiresAt(Type\instance_of(DateTimeImmutable::class)->coerce($value)),
                default => $builder->withClaim(Type\non_empty_string()->assert($name), $value),
            };
        }

        \openssl_pkey_export($with ?? $this->current, $private);

        return $builder->getToken(new Sha256(), InMemory::plainText(Type\non_empty_string()->coerce($private)))->toString();
    }

    public static function generate(): OpenSSLAsymmetricKey
    {
        return \openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => \OPENSSL_KEYTYPE_RSA])
            ?: throw new LogicException('OpenSSL could not make a key.');
    }

    /** Published as a provider publishes it, a modulus and an exponent, so the conversion is under test too. */
    private function asPublished(OpenSSLAsymmetricKey $key): string
    {
        $rsa = \openssl_pkey_get_details($key)['rsa'] ?? throw new LogicException('Not an RSA key.');

        return RsaJwk::toPem(self::base64Url($rsa['n']), self::base64Url($rsa['e']));
    }

    private static function base64Url(string $bytes): string
    {
        return Str\trim_right(Str\replace_every(\base64_encode($bytes), ['+' => '-', '/' => '_']), '=');
    }
}
