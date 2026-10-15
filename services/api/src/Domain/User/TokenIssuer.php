<?php

declare(strict_types=1);

namespace App\Domain\User;

use App\Domain\User\Model\IssuedTokens;
use App\Entity\RefreshToken;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Psl\SecureRandom;
use Psl\Str;
use Symfony\Component\HttpFoundation\Request;

final readonly class TokenIssuer
{
    private const int REFRESH_BYTES = 32;

    /** The User-Agent column, which a client can otherwise exceed at will. */
    private const int USER_AGENT_LENGTH = 255;

    public function __construct(
        private JWTTokenManagerInterface $jwtTokenManager,
        private EntityManagerInterface $entityManager,
    ) {
    }

    /** The caller flushes, so this commits with whatever else the request did. */
    public function issueFor(User $user, ?Request $request = null): IssuedTokens
    {
        $plain = \bin2hex(SecureRandom\bytes(self::REFRESH_BYTES));

        $token = new RefreshToken(
            $user,
            self::hash($plain),
            self::truncate($request?->headers->get('User-Agent')),
            $request?->getClientIp(),
        );

        $this->entityManager->persist($token);

        return new IssuedTokens($this->jwtTokenManager->create($user), $plain, $token->getExpiresAt());
    }

    /**
     * SHA-256 rather than a password hash. The value is 256 bits of randomness,
     * so there is nothing to brute-force and no reason to pay for a slow hash
     * on every refresh.
     */
    public static function hash(string $plain): string
    {
        return \hash('sha256', $plain);
    }

    private static function truncate(?string $userAgent): ?string
    {
        if (null === $userAgent || '' === $userAgent) {
            return null;
        }

        return Str\slice($userAgent, 0, self::USER_AGENT_LENGTH);
    }
}
