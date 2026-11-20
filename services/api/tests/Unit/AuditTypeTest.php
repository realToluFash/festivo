<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Enum\AuditType;
use App\Enum\DeletedKind;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Psl\Dict;
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

final class AuditTypeTest extends TestCase
{
    /** Areas about an event's guests, menu, seating, schedule, staff and budget: left out until sc-71986 gives them types (decided 19 Nov 2026). */
    private const array LEFT_OUT = ['guest', 'guests', 'guest_group', 'menu', 'dish', 'seating', 'run_of_show', 'staff', 'stations', 'budget_line', 'budget_markup', 'quote', 'scheduled_payment'];

    /** Areas about a person's own account, which the log never shows. */
    private const array PERSONAL = ['name', 'email', 'phone', 'provider', 'sessions', 'two_factor_recovery'];

    /** Areas about Soirely itself rather than an organisation. */
    private const array NOT_AN_ORGANISATION = ['catalogue'];

    /** Codes and areas the scan finds that name something other than an audited action. */
    private const array NOT_ACTIONS = ['sign_in_rules.notice', 'catalogue.versions', 'replies.close', 'example.com', 'group.id', 'group.name', 'event_changes', 'event_day', 'app'];

    #[Test]
    public function everyRecordedActionIsInExactlyOneTypeOrInAnAreaTheLogLeavesOut(): void
    {
        $recorded = $this->recordedCodes();
        $leftOut = [...self::LEFT_OUT, ...self::PERSONAL, ...self::NOT_AN_ORGANISATION];

        self::assertContains('guests.marked_invited', $recorded);
        self::assertContains('run_of_show.item_skipped', $recorded);
        self::assertSame([], Vec\values(Vec\filter($recorded, static fn (string $code): bool => null === AuditType::of($code) && !Iter\contains($leftOut, self::area($code)))), 'an action in no type and in no area the log leaves out');
        self::assertSame([], Vec\values(Vec\filter($recorded, static fn (string $code): bool => null !== AuditType::of($code) && Iter\contains($leftOut, self::area($code)))), 'an action the log leaves out that a type lists');

        foreach (AuditType::actions() as $code) {
            self::assertCount(1, Vec\filter(AuditType::cases(), static fn (AuditType $type): bool => Iter\contains(AuditType::actions($type), $code)), $code);
        }
    }

    #[Test]
    public function everyListedActionIsOneSomethingRecords(): void
    {
        $recorded = $this->recordedCodes();

        self::assertSame([], Vec\values(Vec\filter(AuditType::actions(), static fn (string $code): bool => !Iter\contains($recorded, $code))), 'a type lists an action nothing records');
    }

    #[Test]
    public function onlySignInAndSecuritySaysWhereAnEntryCameFrom(): void
    {
        self::assertSame([AuditType::Security], Vec\filter(AuditType::cases(), static fn (AuditType $type): bool => $type->showsWhereFrom()));
    }

    private static function area(string $code): string
    {
        return Str\before($code, '.') ?? $code;
    }

    /**
     * The codes passed to the Auditor: every quoted code in a file that uses it and every code a class constant names, less the translation keys those files also quote, and each kind of deletion's restored and purged.
     *
     * @return list<string>
     */
    private function recordedCodes(): array
    {
        $root = \dirname(__DIR__, 2);
        $keys = [];

        foreach (['messages.en.json', 'messages+intl-icu.en.json', 'errors.en.json'] as $catalogue) {
            $keys = [...$keys, ...Vec\keys(Type\dict(Type\string(), Type\mixed())->coerce(Json\decode(File\read($root . '/translations/' . $catalogue))))];
        }

        $codes = [AuditType::VIEWED, AuditType::EXPORTED];

        foreach (DeletedKind::cases() as $kind) {
            $codes[] = $kind->restored();
            $codes[] = $kind->purged();
        }

        foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root . '/src')) as $file) {
            if (!$file instanceof SplFileInfo || 'php' !== $file->getExtension()) {
                continue;
            }

            $source = File\read(Type\non_empty_string()->coerce($file->getPathname()));

            if (Str\ends_with($file->getPathname(), 'Enum/AuditType.php')) {
                continue;
            }

            foreach (Regex\every_match($source, "/const string [A-Z_]+ = '([a-z_]+\\.[a-z_]+)';/") ?? [] as $match) {
                $codes[] = $match[1];
            }

            if (!Str\contains($source, 'Audit\\Auditor;')) {
                continue;
            }

            foreach (Regex\every_match($source, "/'([a-z_]+\\.[a-z_]+)'/") ?? [] as $match) {
                $codes[] = $match[1];
            }
        }

        return Vec\values(Vec\filter(Dict\diff(Dict\unique($codes), [...$keys, ...self::NOT_ACTIONS]), static fn (string $code): bool => !Iter\contains(self::NOT_ACTIONS, self::area($code))));
    }
}
