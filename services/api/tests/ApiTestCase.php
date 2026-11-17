<?php

declare(strict_types=1);

namespace App\Tests;

use App\Tests\Traits\ServiceAccessTrait;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * A test that sends HTTP requests. The client is created once in setUp, because
 * creating a second one in the same test boots a second kernel and quietly
 * discards the first one's container.
 */
abstract class ApiTestCase extends WebTestCase
{
    use ServiceAccessTrait;

    protected KernelBrowser $client;

    protected function setUp(): void
    {
        // Symfony's own default is `en-us`, which would write every screen's dates in US order (sc-65714).
        $this->client = self::createClient(server: ['HTTP_ACCEPT_LANGUAGE' => 'en']);
    }
}
