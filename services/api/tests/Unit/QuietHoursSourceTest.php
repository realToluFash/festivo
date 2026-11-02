<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Domain\Messaging\QuietHours;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Psl\File;
use Psl\Json;
use Psl\Type;

/** The footer says the hours /quiet-hours.json gives the clients, and the worker holds pushes by QuietHours: one window, so drift fails here (sc-20494). */
final class QuietHoursSourceTest extends TestCase
{
    #[Test]
    public function theWorkersWindowIsTheFootersWindow(): void
    {
        // A fixed mount, like EVENT_STATES_FILE: the file lives outside the application's tree.
        $path = $_SERVER['QUIET_HOURS_FILE'] ?? \getenv('QUIET_HOURS_FILE') ?: null;

        self::assertIsString($path, 'QUIET_HOURS_FILE is not set — see compose.yaml');
        self::assertFileExists($path, 'The quiet hours declaration is missing');

        $declared = Json\typed(File\read($path), Type\shape(['start' => Type\int(), 'end' => Type\int()], true));

        self::assertSame(['start' => QuietHours::START, 'end' => QuietHours::END], ['start' => $declared['start'], 'end' => $declared['end']]);
    }
}
