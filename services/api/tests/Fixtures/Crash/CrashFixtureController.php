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
        // Many small rows, as Doctrine hydrates them. Proves makeRoom's headroom on 8.4.26 only:
        // 8.4.27 lifts the limit after the error, so there it proves the 500's shape. Kept flat:
        // 8.4.27 segfaults freeing an array nested some hundred thousand deep.
        $held = [];
        $id = 0;
        while (true) {
            $held[] = ['id' => ++$id];
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
