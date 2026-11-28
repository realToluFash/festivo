<?php

declare(strict_types=1);

namespace App\Repository;

use Psl\Str;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;

/** The LIKE patterns Search ranks by (sc-39534): a term's wildcards are letters, as on Events' own field. */
final class NameSearch
{
    public static function start(string $term): string
    {
        return self::escaped($term) . '%';
    }

    public static function anywhere(string $term): string
    {
        return '%' . self::escaped($term) . '%';
    }

    /**
     * @param list<Uuid> $ids
     *
     * @return list<string>
     */
    public static function ids(array $ids): array
    {
        return Vec\map($ids, static fn (Uuid $id): string => $id->toRfc4122());
    }

    private static function escaped(string $term): string
    {
        return \addcslashes(Str\trim($term), '\\%_');
    }
}
