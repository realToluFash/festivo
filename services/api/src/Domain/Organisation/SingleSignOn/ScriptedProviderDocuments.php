<?php

declare(strict_types=1);

namespace App\Domain\Organisation\SingleSignOn;

use App\Domain\Organisation\Interfaces\ProviderDocumentsInterface;

/** The suite's identity providers. Static, because every request in the suite reboots the kernel: a test starts with forgetAll(). */
final class ScriptedProviderDocuments implements ProviderDocumentsInterface
{
    /** @var array<string, string> */
    private static array $published = [];

    public static function publish(string $url, string $body): void
    {
        self::$published[$url] = $body;
    }

    public static function forgetAll(): void
    {
        self::$published = [];
    }

    public function fetch(string $url): ?string
    {
        return self::$published[$url] ?? null;
    }
}
