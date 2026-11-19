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
use Psl\Regex;
use Psl\Str;
use Psl\Vec;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use SplFileInfo;

final class AuditTypeTest extends TestCase
{
    /** The areas whose actions are about an organisation, by sc-73's code. */
    private const string ORGANISATION_CODE = '/^(event|event_person|invitation|request_link|domain_join|membership|owner_claim|sign_in_rules|organisation_domain|email_domain|organisation|audit_log)\.[a-z_]+$/';

    #[Test]
    public function everyActionRecordedAboutAnOrganisationIsInExactlyOneType(): void
    {
        $recorded = Vec\filter($this->recordedCodes(), static fn (string $code): bool => Regex\matches($code, self::ORGANISATION_CODE));

        self::assertNotEmpty($recorded);
        self::assertSame([], Vec\values(Vec\filter($recorded, static fn (string $code): bool => null === AuditType::of($code))), 'an action recorded about an organisation that no type lists');

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

    /**
     * The codes passed to the Auditor: the class constants and the literals of every file that records, and each kind of deletion's restored and purged.
     *
     * @return list<string>
     */
    private function recordedCodes(): array
    {
        $codes = [AuditType::VIEWED, AuditType::EXPORTED];

        foreach (DeletedKind::cases() as $kind) {
            $codes[] = $kind->restored();
            $codes[] = $kind->purged();
        }

        $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator(\dirname(__DIR__, 2) . '/src'));

        foreach ($files as $file) {
            if (!$file instanceof SplFileInfo || 'php' !== $file->getExtension()) {
                continue;
            }

            $source = File\read($file->getPathname());

            if (!Str\contains($source, 'auditor->record(')) {
                continue;
            }

            foreach (Regex\every_match($source, "/const string [A-Z_]+ = '([a-z_]+\.[a-z_]+)';/") ?? [] as $match) {
                $codes[] = $match[1];
            }

            foreach (Regex\every_match($source, "/auditor->record\(\s*'([a-z_]+\.[a-z_]+)'/") ?? [] as $match) {
                $codes[] = $match[1];
            }

            foreach (Regex\every_match($source, "/'([a-z_]+\.[a-z_]+)'\s*:\s*'([a-z_]+\.[a-z_]+)'/") ?? [] as $match) {
                $codes[] = $match[1];
                $codes[] = $match[2];
            }
        }

        return Vec\values(Dict\unique($codes));
    }
}
