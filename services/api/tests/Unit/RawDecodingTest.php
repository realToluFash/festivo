<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use FilesystemIterator;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use SplFileInfo;

/**
 * Nothing in src/ decodes JSON itself.
 *
 * `json_decode` answers `null` for a malformed document and for the literal
 * `null`, which means every caller has to remember a flag or an exception mode
 * to tell those apart — and the ones that forget read "no value" where the
 * truth was "unreadable input". `Psl\Json\decode` throws, so forgetting is not
 * an option.
 *
 * A convention nothing checks is a convention that holds until the first busy
 * afternoon, which is why this is a test and not a line in a document.
 */
final class RawDecodingTest extends TestCase
{
    /** @var list<string> */
    private const FORBIDDEN = ['json_decode', 'json_encode'];

    /** @var array<string, string> each file's reason sits above its call */
    private const EXEMPT = ['Http/Input.php' => 'json_decode'];

    #[Test]
    public function noSourceFileCallsPhpsOwnJsonFunctions(): void
    {
        $offenders = [];

        foreach ($this->sourceFiles() as $file) {
            $contents = \file_get_contents($file);
            self::assertIsString($contents);

            foreach (self::FORBIDDEN as $function) {
                if ((self::EXEMPT[$this->relative($file)] ?? null) === $function) {
                    continue;
                }

                if (\str_contains($contents, $function . '(')) {
                    $offenders[] = \sprintf('%s calls %s()', $this->relative($file), $function);
                }
            }
        }

        self::assertSame(
            [],
            $offenders,
            "Decode through Psl\\Json\\decode and encode through Psl\\Json\\encode — both throw.\n"
            . "A JsonResponse encodes for you and needs neither.\n"
            . \implode("\n", $offenders),
        );
    }

    /** @return list<string> */
    private function sourceFiles(): array
    {
        $files = [];

        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($this->src(), FilesystemIterator::SKIP_DOTS),
        );

        /** @var SplFileInfo $file */
        foreach ($iterator as $file) {
            if ('php' === $file->getExtension()) {
                $files[] = $file->getPathname();
            }
        }

        \sort($files);

        return $files;
    }

    private function src(): string
    {
        return \dirname(__DIR__, 2) . '/src';
    }

    private function relative(string $path): string
    {
        return \str_replace($this->src() . '/', '', $path);
    }
}
