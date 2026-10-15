<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\User\TokenIssuer;
use App\Domain\User\UserRegistrar;
use App\Entity\RefreshToken;
use App\Repository\RefreshTokenRepository;
use App\Tests\FunctionalTestCase;
use PHPUnit\Framework\Attributes\Test;

final class TokenLifetimeTest extends FunctionalTestCase
{
    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private const int MAXIMUM_REVOCATION_WINDOW = 900;

    #[Test]
    public function theAccessTokenIsShortEnoughThatEndingASessionMeansSomething(): void
    {
        $ttl = self::getContainer()->getParameter('lexik_jwt_authentication.token_ttl');

        self::assertIsNumeric($ttl);
        self::assertLessThanOrEqual(
            self::MAXIMUM_REVOCATION_WINDOW,
            (int) $ttl,
            'An ended session stays usable for this long, so raising it widens that window with nothing else failing.',
        );
    }

    #[Test]
    public function theRefreshTokenOutlivesTheAccessTokenByEnoughToBeWorthStoring(): void
    {
        $ttl = (int) self::getContainer()->getParameter('lexik_jwt_authentication.token_ttl');

        self::assertSame('P30D', RefreshToken::LIFETIME);
        self::assertGreaterThan($ttl * 100, 30 * 24 * 60 * 60);
    }

    #[Test]
    public function aSessionReportsWhenItBeganRatherThanWhenItLastRenewed(): void
    {
        self::service(UserRegistrar::class)->register('rotated@example.com', 'Rotated', self::PASSWORD);
        self::em()->flush();

        $tokens = self::service(RefreshTokenRepository::class)->findAll();
        self::assertCount(1, $tokens);

        $first = $tokens[0];
        $started = $first->getChainStartedAt();

        $next = new RefreshToken(
            $first->getUser(),
            TokenIssuer::hash('a later token in the same chain'),
            $first->getChainId(),
        );
        self::em()->persist($next);
        self::em()->flush();

        self::assertEquals(
            $started,
            $next->getChainStartedAt(),
            'every token in a chain reports the same beginning',
        );
    }

    #[Test]
    public function aFreshChainBeginsWithItself(): void
    {
        self::service(UserRegistrar::class)->register('fresh@example.com', 'Fresh', self::PASSWORD);
        self::em()->flush();

        $token = self::service(RefreshTokenRepository::class)->findAll()[0];

        self::assertEquals($token->getId(), $token->getChainId());
        self::assertSame(
            $token->getCreatedAt()->format('Y-m-d H:i'),
            $token->getChainStartedAt()->format('Y-m-d H:i'),
        );
    }
}
