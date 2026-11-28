<?php

declare(strict_types=1);

namespace App\Domain\Organisation\SingleSignOn;

use App\Domain\Organisation\Interfaces\ProviderDocumentsInterface;
use SensitiveParameter;

/** The suite's identity providers. Static, because every request in the suite reboots the kernel: a test starts with forgetAll(). */
final class ScriptedProviderDocuments implements ProviderDocumentsInterface
{
    /** @var array<string, string> */
    private static array $published = [];

    public static function publish(string $url, string $body): void
    {
        self::$published[$url] = $body;
    }

    /** @var list<array{endpoint: string, clientId: string, clientSecret: string, fields: array<string, string>}> */
    public static array $redeemed = [];

    public static ?string $tokenReply = null;

    public static function forgetAll(): void
    {
        self::$published = [];
        self::$redeemed = [];
        self::$tokenReply = null;
    }

    public function fetch(string $url): ?string
    {
        return self::$published[$url] ?? null;
    }

    public function redeem(string $endpoint, string $clientId, #[SensitiveParameter] string $clientSecret, #[SensitiveParameter] array $fields): ?string
    {
        self::$redeemed[] = ['endpoint' => $endpoint, 'clientId' => $clientId, 'clientSecret' => $clientSecret, 'fields' => $fields];

        return self::$tokenReply;
    }
}
