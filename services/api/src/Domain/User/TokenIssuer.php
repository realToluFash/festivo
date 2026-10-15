<?php

declare(strict_types=1);

namespace App\Domain\User;

use App\Domain\User\Model\IssuedTokens;
use App\Entity\RefreshToken;
use App\Entity\User;
use App\Repository\RefreshTokenRepository;
use DateInterval;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Psl\SecureRandom;
use Psl\Str;
use SensitiveParameter;
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
        private RefreshTokenRepository $refreshTokenRepository,
        #[Autowire(param: 'app.refresh_token_ttl')]
        private int $refreshTokenTtl,
    ) {
    }

    /** The caller flushes. */
    public function issueFor(User $user, ?Request $request = null): IssuedTokens
    {
        return $this->issue($user, null, $request);
    }

    /** The caller flushes, so the revocation and the new row commit together. */
    public function rotate(RefreshToken $used, ?Request $request = null): IssuedTokens
    {
        $used->setRevokedAt(new DateTimeImmutable());

        return $this->issue($used->getUser(), $used->getChainId(), $request);
    }

    /** All of them: revoking one would leave the thief holding the newest token. */
    public function revokeChain(#[SensitiveParameter] RefreshToken $token): void
    {
        $now = new DateTimeImmutable();

        foreach ($this->refreshTokenRepository->findChain($token->getChainId()) as $sibling) {
            if (null === $sibling->getRevokedAt()) {
                $sibling->setRevokedAt($now);
            }
        }
    }

    /** SHA-256, not a password hash: 256 bits of randomness has nothing to brute-force. */
    public static function hash(string $plain): string
    {
        return \hash('sha256', $plain);
    }

    private function issue(User $user, ?Uuid $chainId, ?Request $request): IssuedTokens
    {
        $plain = \bin2hex(SecureRandom\bytes(self::REFRESH_BYTES));

        $token = new RefreshToken(
            $user,
            self::hash($plain),
            new DateTimeImmutable()->add(new DateInterval(Str\format('PT%dS', $this->refreshTokenTtl))),
            $chainId,
            self::truncate($request?->headers->get('User-Agent')),
            $request?->getClientIp(),
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
