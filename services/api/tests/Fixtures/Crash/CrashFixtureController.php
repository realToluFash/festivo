<?php

declare(strict_types=1);

namespace App\Tests\Fixtures\Crash;

use App\Http\Access\Policy\PublicAccess;
use Psl\Str;
use Symfony\Component\HttpKernel\Attribute\AsController;
use Symfony\Component\Routing\Attribute\Route;

/** Routes that exist only in the suite, each a request PHP itself dies on. */
#[AsController]
#[PublicAccess]
final class CrashFixtureController
{
    #[Route('/api/_crash/memory', name: 'crash_fixture_memory', methods: ['GET'])]
    public function memory(): never
    {
        $held = [];
        while (true) {
            $held[] = Str\repeat('x', 1_048_576);
        }
    }

    #[Route('/api/_crash/time', name: 'crash_fixture_time', methods: ['GET'])]
    public function time(): never
    {
        \set_time_limit(1);
        $spins = 0;
        while (true) {
            ++$spins;
        }
    }
}
