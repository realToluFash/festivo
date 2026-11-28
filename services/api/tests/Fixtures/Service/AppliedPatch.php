<?php

declare(strict_types=1);

namespace App\Tests\Fixtures\Service;

use PHPUnit\Framework\Assert;
use Psl\Iter;
use Psl\Str;
use Psl\Vec;

/** An RFC 6902 patch applied as a client would, to check what the server sends. */
final class AppliedPatch
{
    /** @param list<array{op: string, path: string, value?: mixed}> $patch */
    public static function to(mixed $doc, array $patch): mixed
    {
        foreach ($patch as $op) {
            $doc = self::at($doc, '' === $op['path'] ? [] : Vec\map(Str\split(Str\slice($op['path'], 1), '/'), static fn (string $part): string => Str\replace_every($part, ['~1' => '/', '~0' => '~'])), $op);
        }

        return $doc;
    }

    /**
     * @param list<string>                                   $parts
     * @param array{op: string, path: string, value?: mixed} $op
     */
    private static function at(mixed $doc, array $parts, array $op): mixed
    {
        if ([] === $parts) {
            return $op['value'] ?? null;
        }

        Assert::assertIsArray($doc);
        $key = \array_is_list($doc) && \ctype_digit($parts[0]) ? (int) $parts[0] : $parts[0];

        if (1 === Iter\count($parts)) {
            if ('remove' === $op['op']) {
                unset($doc[$key]);

                return \array_is_list($doc) || \is_int($key) ? Vec\values($doc) : $doc;
            }

            if ('add' === $op['op'] && \is_int($key)) {
                \array_splice($doc, $key, 0, [$op['value'] ?? null]);

                return $doc;
            }

            $doc[$key] = $op['value'] ?? null;

            return $doc;
        }

        $doc[$key] = self::at($doc[$key], Vec\values(Vec\drop($parts, 1)), $op);

        return $doc;
    }
}
