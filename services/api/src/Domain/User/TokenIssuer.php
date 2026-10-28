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
use Psl\Iter;
use Psl\SecureRandom;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use SensitiveParameter;
use Symfony\Bridge\Doctrine\Types\UuidType;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Uid\Uuid;

final readonly class TokenIssuer
{
    /** OpenID Connect's session id claim: the refresh chain, which every access token of the session shares. */
    public const string SESSION_CLAIM = 'sid';

    private const int REFRESH_BYTES = 32;

    /** The User-Agent column, which a client can otherwise exceed at will. */
    private const int USER_AGENT_LENGTH = 255;

    public function __construct(
        private JWTTokenManagerInterface $jwtTokenManager,
        private EntityManagerInterface $entityManager,
        private RevokedSessions $revokedSessions,
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

    /** One session, ended from the devices list. The caller flushes. */
    public function end(RefreshToken $session): void
    {
        if (null !== $session->getRevokedAt()) {
            return;
        }

        $session->setRevokedAt(new DateTimeImmutable());
        $this->revokedSessions->add($session->getChainId());
    }

    /** Until the transaction ends: a sign-out landing mid-refresh would otherwise miss the token that refresh issues. */
    public function holdChain(#[SensitiveParameter] RefreshToken $token): void
    {
        $this->entityManager->getConnection()->executeStatement(
            'SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))',
            ['key' => 'refresh-chain:' . $token->getChainId()->toRfc4122()],
        );
        $this->entityManager->refresh($token);
    }

    /**
     * All of them, since revoking one leaves the thief the newest. Bypasses the UnitOfWork: loaded tokens go stale.
     *
     * @return int how many were still live
     */
    public function revokeChain(#[SensitiveParameter] RefreshToken $token): int
    {
        $revoked = $this->entityManager
            ->createQuery(
                'UPDATE ' . RefreshToken::class . ' t SET t.revokedAt = :now'
                . ' WHERE t.chainId = :chain AND t.revokedAt IS NULL',
            )
            ->setParameter('now', new DateTimeImmutable(), Types::DATETIME_IMMUTABLE)
            ->setParameter('chain', $token->getChainId(), UuidType::NAME)
            ->execute();

        $this->revokedSessions->add($token->getChainId());

        return Type\int()->coerce($revoked);
    }

    /** Every session the account has, on every device: a new password means nobody stays in on the old one. */
    public function revokeAllFor(User $user): void
    {
        $this->revokeLive($user);
    }

    /**
     * Every session that a sign-in through this provider started: unlinking it signs those devices out.
     *
     * @return list<Uuid> the chains of the live sessions it ended
     */
    public function revokeSignedInWith(User $user, IdentityProvider $provider): array
    {
        return $this->endLive($user, null, $provider);
    }

    /** Linking is a sign-in with the provider, so a password session that links one counts as opened through it from then on (sc-69). */
    public function markSignedInWith(User $user, Uuid $chainId, IdentityProvider $provider): void
    {
        $this->entityManager
            ->createQuery(
                'UPDATE ' . RefreshToken::class . ' t SET t.signedInWith = :provider'
                . ' WHERE t.chainId = :chain AND t.user = :user AND t.revokedAt IS NULL AND t.signedInWith IS NULL',
            )
            ->setParameter('provider', $provider->value)
            ->setParameter('chain', $chainId, UuidType::NAME)
            ->setParameter('user', $user->getId(), UuidType::NAME)
            ->execute();
    }

    /**
     * Every session but the one named, if it is this account's: the shared piece for sc-115 and sc-116.
     *
     * @return list<Uuid> the chains of the live sessions it ended
     */
    public function revokeAllExcept(User $user, ?Uuid $keep): array
    {
        $kept = null === $keep ? null : $this->entityManager->find(RefreshToken::class, $keep);

        return $this->endLive($user, null !== $kept && $kept->getUser()->getId()->equals($user->getId()) ? $kept->getChainId() : null);
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
            $this->jwtTokenManager->createFromPayload($user, [self::SESSION_CLAIM => $token->getChainId()->toRfc4122()]),
            $plain,
            $token->getExpiresAt(),
            $token->getId(),
        );
    }

    /** @return int how many live sessions ended */
    private function revokeLive(User $user, ?Uuid $keepChain = null, ?IdentityProvider $signedInWith = null): int
    {
        return Iter\count($this->endLive($user, $keepChain, $signedInWith));
    }

    /**
     * SQL rather than DQL for RETURNING: the chains it ended are the ones the revoked list needs.
     *
     * @return list<Uuid> the chains of the live sessions it ended
     */
    private function endLive(User $user, ?Uuid $keepChain = null, ?IdentityProvider $signedInWith = null): array
    {
        $sql = <<<'SQL'
            UPDATE refresh_tokens
               SET revoked_at = :now
             WHERE user_id = :user
               AND revoked_at IS NULL
               AND expires_at > :now
               AND (CAST(:keep AS UUID) IS NULL OR chain_id <> :keep)
               AND (CAST(:provider AS VARCHAR) IS NULL OR signed_in_with = :provider)
            RETURNING chain_id
            SQL;

        $chains = $this->entityManager->getConnection()->executeQuery(
            $sql,
            ['now' => new DateTimeImmutable(), 'user' => $user->getId(), 'keep' => $keepChain, 'provider' => $signedInWith?->value],
            ['now' => Types::DATETIME_IMMUTABLE, 'user' => UuidType::NAME, 'keep' => UuidType::NAME, 'provider' => Types::STRING],
        )->fetchFirstColumn();

        $ended = Vec\map(
            $chains,
            static fn (mixed $chain): Uuid => Uuid::fromString(Type\string()->coerce($chain)),
        );
        $this->revokedSessions->add(...$ended);

        return $ended;
    }

    private static function truncate(?string $userAgent): ?string
    {
        if (null === $userAgent || '' === $userAgent) {
            return null;
        }

        return Str\slice($userAgent, 0, self::USER_AGENT_LENGTH);
    }
}
