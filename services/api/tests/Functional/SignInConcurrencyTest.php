<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Psl\Dict;
use Psl\SecureRandom;
use Psl\Str;
use Psl\Vec;

/** Real processes at one instant on one shared budget (sc-838); unknown addresses hash the same and need no row. */
final class SignInConcurrencyTest extends TestCase
{
    private const string SCRIPT = __DIR__ . '/../Fixtures/Concurrency/sign-in.php';

    #[Test]
    public function twentyParallelGuessesForOneAddressCheckFiveAndRefuseFifteen(): void
    {
        $codes = $this->inParallel(Vec\fill(20, ['guessed@example.com', '198.51.100.7']));

        self::assertSame([401 => 5, 429 => 15], $codes);
    }

    #[Test]
    public function twoAddressesInParallelDoNotBlockEachOther(): void
    {
        $codes = $this->inParallel([
            ...Vec\fill(5, ['first@example.com', '198.51.100.8']),
            ...Vec\fill(5, ['second@example.com', '198.51.100.9']),
        ]);

        self::assertSame([401 => 10], $codes, 'each address spends its own five, none refused');
    }

    /** @param list<array{0: string, 1: string}> $attempts address and client IP */
    private function inParallel(array $attempts): array
    {
        $namespace = 'sc838-' . SecureRandom\string(8);
        // Long enough for every process to boot its kernel before the instant they all sign in at.
        $startAt = (string) (\microtime(true) + 15);
        $processes = Vec\map($attempts, static fn (array $attempt): array => self::start($startAt, $attempt[0], $attempt[1], $namespace));

        $codes = Vec\map($processes, static function (array $process): string {
            [$handle, $pipes] = $process;
            $out = Str\trim((string) \stream_get_contents($pipes[1]));
            \fclose($pipes[1]);
            \proc_close($handle);

            return $out;
        });

        return Dict\sort_by_key(Dict\count_values($codes));
    }

    /** @return array{0: resource, 1: array<int, resource>} */
    private static function start(string ...$arguments): array
    {
        $handle = \proc_open(['php', self::SCRIPT, ...$arguments], [1 => ['pipe', 'w'], 2 => ['file', '/dev/null', 'w']], $pipes);
        self::assertIsResource($handle);

        return [$handle, $pipes];
    }
}
