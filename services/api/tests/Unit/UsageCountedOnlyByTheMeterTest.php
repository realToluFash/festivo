<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Psl\File;
use Psl\Iter;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use SplFileInfo;

/** sc-3929: only the meter counts usage, so no second count of a message or an AI request can grow beside it. */
final class UsageCountedOnlyByTheMeterTest extends TestCase
{
    private const array COUNTED = ['usage_records', 'UsageRecord', 'assistant_interactions', 'AssistantInteraction'];

    private const array ALLOWED = [
        '/src/Domain/Billing/Meter/',
        '/src/Entity/UsageRecord.php',
        '/src/Entity/UsageReservation.php',
        '/src/Entity/UsageHoldRelease.php',
        '/src/Entity/AssistantInteraction.php',
        '/src/AI/InteractionRecorder.php',
    ];

    #[Test]
    public function nothingOutsideTheMeterReadsTheUsageRecordsOrTheAssistantInteractions(): void
    {
        $root = \dirname(__DIR__, 2);
        $readers = [];

        foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root . '/src')) as $file) {
            if (!$file instanceof SplFileInfo || 'php' !== $file->getExtension()) {
                continue;
            }

            $path = Str\after($file->getPathname(), $root) ?? $file->getPathname();

            if (Iter\any(self::ALLOWED, static fn (string $allowed): bool => Str\starts_with($path, $allowed))) {
                continue;
            }

            $source = File\read(Type\non_empty_string()->coerce($file->getPathname()));

            if (Iter\any(self::COUNTED, static fn (string $name): bool => Str\contains($source, $name))) {
                $readers[] = $path;
            }
        }

        self::assertSame([], Vec\sort($readers), 'usage counted outside the meter: settle it through UsageMeter and read it through UsageReader');
    }
}
