<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Psl\File;
use Psl\Iter;
use Psl\Str;
use Psl\Type;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use SplFileInfo;

/** sc-852: every sender asks AccountLanguage. Reading a person's stored language anywhere else fails here. */
final class OneWayToALanguageTest extends TestCase
{
    private const array ALLOWED = ['Domain/User/Mail/AccountLanguage.php', 'Domain/User/Http/AccountSerialiser.php'];

    #[Test]
    public function nothingButAccountLanguageReadsAPersonsStoredLanguage(): void
    {
        $source = \dirname(__DIR__, 2) . '/src/';
        $offenders = [];

        foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($source)) as $file) {
            if (!$file instanceof SplFileInfo || 'php' !== $file->getExtension()) {
                continue;
            }

            $relative = Str\strip_prefix($file->getPathname(), $source);

            if (Iter\contains(self::ALLOWED, $relative) || 'Entity/User.php' === $relative) {
                continue;
            }

            // One method name, however the user was reached: no variable name can slip past it.
            if (Str\contains(File\read(Type\non_empty_string()->assert($file->getPathname())), '->storedLanguage()')) {
                $offenders[] = $relative;
            }
        }

        self::assertSame([], $offenders, 'Ask AccountLanguage::of() for a person\'s language instead.');
    }
}
