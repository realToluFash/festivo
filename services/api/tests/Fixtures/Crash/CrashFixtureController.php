<?php

declare(strict_types=1);

namespace App\Tests\Fixtures\Crash;

use App\Http\Access\Policy\PublicAccess;
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
        // A chain of small arrays, as Doctrine hydrates rows: no one large allocation fails
        // with room to spare, and the limit is used up to the last bytes.
        $held = null;
        while (true) {
            $held = [$held];
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
