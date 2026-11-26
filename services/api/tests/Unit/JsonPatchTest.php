<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Domain\Service\JsonPatch;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Psl\Iter;
use Psl\Str;
use Psl\Vec;

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

        self::assertSame($to, self::apply($from, $patch));
        self::assertSame($from === $to, [] === $patch);
    }

    /** @param list<array{op: string, path: string, value?: mixed}> $patch */
    private static function apply(mixed $doc, array $patch): mixed
    {
        foreach ($patch as $op) {
            $doc = self::at($doc, '' === $op['path'] ? [] : Vec\map(Str\split(Str\slice($op['path'], 1), '/'), static fn (string $part): string => Str\replace_every($part, ['~1' => '/', '~0' => '~'])), $op);
        }

        return $doc;
    }

    /**
     * @param list<string>                                       $parts
     * @param array{op: string, path: string, value?: mixed} $op
     */
    private static function at(mixed $doc, array $parts, array $op): mixed
    {
        if ([] === $parts) {
            return $op['value'] ?? null;
        }

        self::assertIsArray($doc);
        $key = array_is_list($doc) && \ctype_digit($parts[0]) ? (int) $parts[0] : $parts[0];

        if (1 === Iter\count($parts)) {
            if ('remove' === $op['op']) {
                unset($doc[$key]);

                return array_is_list($doc) || \is_int($key) ? Vec\values($doc) : $doc;
            }

            if ('add' === $op['op'] && \is_int($key)) {
                array_splice($doc, $key, 0, [$op['value'] ?? null]);

                return $doc;
            }

            $doc[$key] = $op['value'] ?? null;

            return $doc;
        }

        $doc[$key] = self::at($doc[$key], Vec\values(Vec\drop($parts, 1)), $op);

        return $doc;
    }
}
