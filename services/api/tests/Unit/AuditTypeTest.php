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
    private const array LEFT_OUT = ['guest', 'guests', 'guest_group', 'guest_message', 'menu', 'dish', 'seating', 'run_of_show', 'staff', 'stations', 'budget_line', 'budget_markup', 'staff_rate', 'quote', 'scheduled_payment', 'payer'];

    /** Areas about a person's own account, which the log never shows. */
    private const array PERSONAL = ['name', 'email', 'phone', 'provider', 'sessions', 'two_factor_recovery'];

    /** Areas about Soirely itself rather than an organisation. */
    private const array NOT_AN_ORGANISATION = ['catalogue'];

    /** Codes and areas the scan finds that name something other than an audited action. */
    private const array NOT_ACTIONS = ['sign_in_rules.notice', 'budget.payment_reminder', 'catalogue.versions', 'replies.close', 'example.com', 'group.id', 'group.name', 'event_changes', 'event_day', 'guest_replies', 'app'];

    /** Every action whose entry shows what changed on something already there: a new action goes here or on AuditType::CREATES_OR_REMOVES (#74875). */
    private const array CHANGES_A_VALUE = [
        'event.updated', 'event.cover_changed', 'event.cover_removed', 'event.thank_you_saved', 'event.thank_you_removed',
        'event.made_live', 'event.paused', 'event.resumed', 'event.ended',
        'event_person.changed', 'door_code.stopped',
        'managed_account.refused',
        'request_link.turned_on', 'request_link.turned_off', 'request_link.replaced',
        'membership.approved', 'membership.turned_down', 'membership.request_expired', 'membership.suspended', 'membership.suspension_expired',
        'membership.restored', 'membership.role_changed', 'membership.removed', 'membership.left',
        'owner_claim.found', 'owner_claim.stopped', 'owner_claim.withdrawn', 'owner_claim.lapsed', 'owner_claim.passed', 'owner_claim.ended',
        'sign_in_rules.changed', 'sign_in_rules.two_factor_held',
        'email_domain.proved', 'email_domain.failed', 'email_domain.record_missing', 'email_domain.lapsed',
        'email_domain.only_ours_on', 'email_domain.only_ours_notice_sent', 'email_domain.only_ours_applied', 'email_domain.only_ours_cancelled', 'email_domain.only_ours_off',
        'organisation.plan_changed', 'organisation.payment_reminders_changed', 'organisation.ownership_transferred', 'organisation.export_asked', 'organisation.export_downloaded',
        AuditType::VIEWED, AuditType::EXPORTED,
    ];

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
    public function everyActionEitherCreatesOrRemovesSomethingOrChangesAValueAndNeverBoth(): void
    {
        $classified = [...AuditType::CREATES_OR_REMOVES, ...self::CHANGES_A_VALUE];

        self::assertSame([], Vec\values(Vec\filter(AuditType::actions(), static fn (string $code): bool => !Iter\contains($classified, $code))), 'an action in neither AuditType::CREATES_OR_REMOVES nor CHANGES_A_VALUE');
        self::assertSame([], Vec\values(Vec\filter($classified, static fn (string $code): bool => !AuditType::isListed($code))), 'a classified action no type lists');
        self::assertCount(Iter\count($classified), Vec\unique($classified), 'an action classified twice');
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
