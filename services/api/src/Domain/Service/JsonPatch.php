<?php

declare(strict_types=1);

namespace App\Domain\Service;

use Psl\Dict;
use Psl\Iter;
use Psl\Math;
use Psl\Str;
use Psl\Vec;

/** The RFC 6902 operations that turn one JSON value into another; applied in order, they give exactly the second. */
final class JsonPatch
{
    /** @return list<array{op: string, path: string, value?: mixed}> */
    public static function diff(mixed $from, mixed $to, string $path = ''): array
    {
        if ($from === $to) {
            return [];
        }

        if (\is_array($from) && \is_array($to) && \array_is_list($from) === \array_is_list($to) && ([] !== $from || [] !== $to)) {
            if (\array_is_list($from) && \array_is_list($to)) {
                return self::lists($from, $to, $path);
            }

            return self::objects($from, $to, $path);
        }

        return [['op' => 'replace', 'path' => $path, 'value' => $to]];
    }

    /**
     * @param list<mixed> $from
     * @param list<mixed> $to
     *
     * @return list<array{op: string, path: string, value?: mixed}>
     */
    private static function lists(array $from, array $to, string $path): array
    {
        $ops = [];
        $shared = Math\minva(Iter\count($from), Iter\count($to));

        for ($i = 0; $i < $shared; ++$i) {
            $ops = [...$ops, ...self::diff($from[$i], $to[$i], $path . '/' . $i)];
        }

        for ($i = Iter\count($from) - 1; $i >= $shared; --$i) {
            $ops[] = ['op' => 'remove', 'path' => $path . '/' . $i];
        }

        for ($i = $shared; $i < Iter\count($to); ++$i) {
            $ops[] = ['op' => 'add', 'path' => $path . '/' . $i, 'value' => $to[$i]];
        }

        return $ops;
    }

    /**
     * @param array<array-key, mixed> $from
     * @param array<array-key, mixed> $to
     *
     * @return list<array{op: string, path: string, value?: mixed}>
     */
    private static function objects(array $from, array $to, string $path): array
    {
        $ops = [];

        foreach ($from as $key => $value) {
            $at = $path . '/' . self::escape((string) $key);
            $ops = [...$ops, ...(Iter\contains_key($to, $key) ? self::diff($value, $to[$key], $at) : [['op' => 'remove', 'path' => $at]])];
        }

        foreach (Dict\diff_by_key($to, $from) as $key => $value) {
            $ops[] = ['op' => 'add', 'path' => $path . '/' . self::escape((string) $key), 'value' => $value];
        }

        return Vec\values($ops);
    }

    private static function escape(string $key): string
    {
        return Str\replace(Str\replace($key, '~', '~0'), '/', '~1');
    }
}
