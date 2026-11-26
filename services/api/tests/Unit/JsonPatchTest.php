<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Domain\Service\JsonPatch;
use App\Tests\Fixtures\Service\AppliedPatch;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

final class JsonPatchTest extends TestCase
{
    /** @return iterable<string, array{mixed, mixed}> */
    public static function pairs(): iterable
    {
        yield 'the same' => [['a' => 1], ['a' => 1]];
        yield 'a key changed' => [['stage' => 'toServe', 'held' => false], ['stage' => 'dishing', 'held' => false]];
        yield 'a key added and one gone' => [['a' => 1, 'b' => 2], ['a' => 1, 'c' => 3]];
        yield 'a list grown' => [['plates' => ['x']], ['plates' => ['x', 'y', 'z']]];
        yield 'a list shrunk' => [['plates' => ['x', 'y', 'z']], ['plates' => ['y']]];
        yield 'nested' => [['tables' => [['counts' => ['served' => 0]]]], ['tables' => [['counts' => ['served' => 3]]]]];
        yield 'a key with a slash and a tilde' => [['a/b' => 1, 'c~d' => 1], ['a/b' => 2, 'c~d' => 2]];
        yield 'an empty list becoming an object' => [['x' => []], ['x' => ['k' => 1]]];
    }

    #[Test]
    #[DataProvider('pairs')]
    public function applyingTheDiffGivesTheSecond(mixed $from, mixed $to): void
    {
        $patch = JsonPatch::diff($from, $to);

        self::assertSame($to, AppliedPatch::to($from, $patch));
        self::assertSame($from === $to, [] === $patch);
    }
}
