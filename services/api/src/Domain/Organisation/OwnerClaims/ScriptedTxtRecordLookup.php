<?php

declare(strict_types=1);

namespace App\Domain\Organisation\OwnerClaims;

use App\Domain\Organisation\Interfaces\TxtRecordLookupInterface;

/** The suite's DNS. Static, because every request in the suite reboots the kernel: a test starts with forgetAll(). */
final class ScriptedTxtRecordLookup implements TxtRecordLookupInterface
{
    /** @var array<string, list<string>> */
    private static array $published = [];

    public static function publish(string $name, string $value): void
    {
        self::$published[$name] = [...self::$published[$name] ?? [], $value];
    }

    public static function unpublish(string $name): void
    {
        unset(self::$published[$name]);
    }

    public static function forgetAll(): void
    {
        self::$published = [];
    }

    public function lookUp(string $name): array
    {
        return self::$published[$name] ?? [];
    }
}
