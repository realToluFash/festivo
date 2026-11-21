<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Tests\ApiTestCase;
use PHPUnit\Framework\Attributes\Test;

final class MinimumAppVersionsEndpointTest extends ApiTestCase
{
    /** Signed out, and with neither minimum set, as the local and QA stacks ship. */
    #[Test]
    public function itGivesBothPlatformsToAnybody(): void
    {
        $this->client->request('GET', '/api/app-versions/minimum');

        self::assertResponseIsSuccessful();
        self::assertSame(
            ['ios' => null, 'android' => null],
            \json_decode((string) $this->client->getResponse()->getContent(), true, 512, \JSON_THROW_ON_ERROR),
        );
    }
}
