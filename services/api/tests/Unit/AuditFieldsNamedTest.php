<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Domain\Organisation\AuditLog\AuditEntryView;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Psl\File;
use Psl\Iter;
use Psl\Json;
use Psl\Regex;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use SplFileInfo;

/** A field the log shows needs a name in audit.field.*, or its Changes row is dropped without a word (sc-611). */
final class AuditFieldsNamedTest extends TestCase
{
    /** The folders whose entries the log shows; the rest are areas AuditTypeTest leaves out. */
    private const array SHOWN = ['/src/Domain/Event/', '/src/Domain/Organisation/', '/src/Deletion/'];

    /** Keys the scan finds in an audited file that are not a recorded field. */
    private const array NOT_FIELDS = ['propertyPath', 'message', 'code', 'parameters'];

    #[Test]
    public function everyFieldTheLogRecordsIsNamedOrNeverShown(): void
    {
        $root = \dirname(__DIR__, 2);
        $named = Vec\filter_nulls(Vec\map(
            Vec\keys(Type\dict(Type\string(), Type\mixed())->coerce(Json\decode(File\read($root . '/translations/messages+intl-icu.en.json')))),
            static fn (string $key): ?string => Str\after($key, 'audit.field.'),
        ));
        $recorded = $this->recordedFields($root);

        self::assertContains('everyoneNeedsTwoFactor', $recorded);
        self::assertContains('venueName', $recorded);
        self::assertContains('deletedAt', $recorded);
        self::assertSame([], Vec\values(Vec\filter(
            $recorded,
            static fn (string $field): bool => !Iter\contains($named, $field) && !Iter\contains(AuditEntryView::UNSHOWN_FIELDS, $field),
        )), 'a recorded field with no audit.field.* name and not on AuditEntryView::UNSHOWN_FIELDS');
        self::assertSame([], Vec\values(Vec\filter(AuditEntryView::UNSHOWN_FIELDS, static fn (string $field): bool => Iter\contains($named, $field))), 'a field never shown that the catalogue names');
    }

    /**
     * Every change pair ('field' => [before, after]) in a file that uses the Auditor, and every key a snapshot passed to Auditor::diff returns.
     *
     * @return list<string>
     */
    private function recordedFields(string $root): array
    {
        $fields = [];

        foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root . '/src')) as $file) {
            if (!$file instanceof SplFileInfo || 'php' !== $file->getExtension() || !Iter\any(self::SHOWN, static fn (string $folder): bool => Str\contains($file->getPathname(), $folder))) {
                continue;
            }

            $source = File\read(Type\non_empty_string()->coerce($file->getPathname()));

            if (!Str\contains($source, 'Audit\\Auditor;')) {
                continue;
            }

            foreach (Regex\every_match($source, "/'([a-zA-Z]+)' => \\[/") ?? [] as $match) {
                $fields[] = $match[1];
            }

            foreach (Regex\every_match($source, '/function (?:recorded|venueRecorded|rulesOf)\(.*?\n    \}/s') ?? [] as $snapshot) {
                foreach (Regex\every_match($snapshot[0], "/'([a-zA-Z]+)' =>/") ?? [] as $match) {
                    $fields[] = $match[1];
                }
            }
        }

        return Vec\values(Vec\filter(Vec\unique($fields), static fn (string $field): bool => !Iter\contains(self::NOT_FIELDS, $field)));
    }
}
