<?php

declare(strict_types=1);

namespace App\Domain\User;

use App\Domain\User\Model\IssuedTokens;
use App\Entity\RefreshToken;
use App\Entity\User;
use App\Enum\IdentityProvider;
use DateInterval;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Psl\SecureRandom;
use Psl\Str;
use Psl\Type;
use SensitiveParameter;
use Symfony\Bridge\Doctrine\Types\UuidType;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Uid\Uuid;

final readonly class TokenIssuer
{
    private const int REFRESH_BYTES = 32;

    /** The User-Agent column, which a client can otherwise exceed at will. */
    private const int USER_AGENT_LENGTH = 255;

    public function __construct(
        private JWTTokenManagerInterface $jwtTokenManager,
        private EntityManagerInterface $entityManager,
        #[Autowire(param: 'app.refresh_token_ttl')]
        private int $refreshTokenTtl,
    ) {
    }

    /** The caller flushes. `$signedInWith` is the provider the sign-in came through, null for a password. */
    public function issueFor(User $user, ?Request $request = null, ?IdentityProvider $signedInWith = null): IssuedTokens
    {
        return $this->issue($user, null, $request, $signedInWith);
    }

    /** The caller flushes, so the revocation and the new row commit together. */
    public function rotate(RefreshToken $used, ?Request $request = null): IssuedTokens
    {
        $used->setRevokedAt(new DateTimeImmutable());

        return $this->issue($used->getUser(), $used->getChainId(), $request, $used->getSignedInWith());
    }

    /** All of them, since revoking one leaves the thief the newest. Bypasses the UnitOfWork: loaded tokens go stale. */
    public function revokeChain(#[SensitiveParameter] RefreshToken $token): void
    {
        $this->entityManager
            ->createQuery(
                'UPDATE ' . RefreshToken::class . ' t SET t.revokedAt = :now'
                . ' WHERE t.chainId = :chain AND t.revokedAt IS NULL',
            )
            ->setParameter('now', new DateTimeImmutable(), Types::DATETIME_IMMUTABLE)
            ->setParameter('chain', $token->getChainId(), UuidType::NAME)
            ->execute();
    }

    /** Every session the account has, on every device: a new password means nobody stays in on the old one. */
    public function revokeAllFor(User $user): void
    {
        $this->entityManager
            ->createQuery('UPDATE ' . RefreshToken::class . ' t SET t.revokedAt = :now WHERE t.user = :user AND t.revokedAt IS NULL')
            ->setParameter('now', new DateTimeImmutable(), Types::DATETIME_IMMUTABLE)
            ->setParameter('user', $user)
            ->execute();
    }

    /**
     * Every session that a sign-in through this provider started: unlinking it signs those devices out.
     *
     * @return int how many live sessions ended
     */
    public function revokeSignedInWith(User $user, IdentityProvider $provider): int
    {
        return Type\int()->coerce($this->entityManager
            ->createQuery(
                'UPDATE ' . RefreshToken::class . ' t SET t.revokedAt = :now'
                . ' WHERE t.user = :user AND t.signedInWith = :provider AND t.revokedAt IS NULL AND t.expiresAt > :now',
            )
            ->setParameter('now', new DateTimeImmutable(), Types::DATETIME_IMMUTABLE)
            ->setParameter('user', $user)
            ->setParameter('provider', $provider->value)
            ->execute());
    }

    /**
     * Every session but the one named, if it is this account's: the shared piece for sc-115 and sc-116.
     *
     * @return int how many live sessions ended
     */
    public function revokeAllExcept(User $user, ?Uuid $keep): int
    {
        $kept = null === $keep ? null : $this->entityManager->find(RefreshToken::class, $keep);
        $chain = null !== $kept && $kept->getUser()->getId()->equals($user->getId()) ? $kept->getChainId() : null;

        $query = $this->entityManager
            ->createQuery(
                'UPDATE ' . RefreshToken::class . ' t SET t.revokedAt = :now'
                . ' WHERE t.user = :user AND t.revokedAt IS NULL AND t.expiresAt > :now'
                . (null === $chain ? '' : ' AND t.chainId <> :chain'),
            )
            ->setParameter('now', new DateTimeImmutable(), Types::DATETIME_IMMUTABLE)
            ->setParameter('user', $user);

        if (null !== $chain) {
            $query->setParameter('chain', $chain, UuidType::NAME);
        }

        return Type\int()->coerce($query->execute());
    }

    /** SHA-256, not a password hash: 256 bits of randomness has nothing to brute-force. */
    public static function hash(string $plain): string
    {
        return \hash('sha256', $plain);
    }

    private function issue(User $user, ?Uuid $chainId, ?Request $request, ?IdentityProvider $signedInWith): IssuedTokens
    {
        $plain = \bin2hex(SecureRandom\bytes(self::REFRESH_BYTES));

        $token = new RefreshToken(
            $user,
            self::hash($plain),
            new DateTimeImmutable()->add(new DateInterval(Str\format('PT%dS', $this->refreshTokenTtl))),
            $chainId,
            self::truncate($request?->headers->get('User-Agent')),
            $request?->getClientIp(),
            $signedInWith,
        );

        $this->entityManager->persist($token);

        return new IssuedTokens(
            $this->jwtTokenManager->create($user),
            $plain,
            $token->getExpiresAt(),
            $token->getId(),
        );
    }

    private static function truncate(?string $userAgent): ?string
    {
        if (null === $userAgent || '' === $userAgent) {
            return null;
        }

        return Str\slice($userAgent, 0, self::USER_AGENT_LENGTH);
    }
}
