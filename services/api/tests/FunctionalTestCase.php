<?php

declare(strict_types=1);

namespace App\Tests;

use App\Tests\Traits\ServiceAccessTrait;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;

/**
 * A test that needs the container but not HTTP. Extend ApiTestCase instead when
 * the test sends a request.
 */
abstract class FunctionalTestCase extends KernelTestCase
{
    use ServiceAccessTrait;

    protected function setUp(): void
    {
        self::bootKernel();
    }
}
