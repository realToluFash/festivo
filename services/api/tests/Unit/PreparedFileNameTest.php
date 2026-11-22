<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Domain\Organisation\Export\PreparedFiles;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

final class PreparedFileNameTest extends TestCase
{
    /** @return iterable<string, array{string}> */
    public static function refused(): iterable
    {
        foreach (['/', '\\', ':', '*', '?', '<', '>', '|'] as $character) {
            yield $character => [$character];
        }
    }

    #[Test]
    #[DataProvider('refused')]
    public function aCharacterAFileSystemRefusesReadsAsADash(string $character): void
    {
        self::assertSame("attachment; filename=export.zip; filename*=utf-8''Acme-Co%202026-11-20.zip", $this->disposition('Acme' . $character . 'Co 2026-11-20.zip'));
    }

    #[Test]
    public function aQuoteIsTakenOut(): void
    {
        self::assertSame("attachment; filename=export.zip; filename*=utf-8''Acme%20-%20Quote%20Co%202026-11-20.zip", $this->disposition('Acme / "Quote" Co 2026-11-20.zip'));
    }

    #[Test]
    public function theStorysExampleKeepsItsAmpersandAndSpaces(): void
    {
        self::assertSame("attachment; filename=export.zip; filename*=utf-8''Acme-%20R%26D%20-EU--%202026-11-20.zip", $this->disposition('Acme: R&D <EU>? 2026-11-20.zip'));
    }

    #[Test]
    public function lettersOutsideAsciiStayAsTheyAre(): void
    {
        self::assertSame("attachment; filename=audit-log.csv; filename*=utf-8''Soir%C3%A9e%20%C3%A0%20Lisboa%20audit%20log%202026-11-20.csv", PreparedFiles::headers('text/csv', 'Soirée à Lisboa audit log 2026-11-20.csv', 'audit-log.csv')['Content-Disposition']);
    }

    private function disposition(string $name): string
    {
        return PreparedFiles::headers('application/zip', $name, 'export.zip')['Content-Disposition'];
    }
}
