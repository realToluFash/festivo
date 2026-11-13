<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Locale\GuestLanguage;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Psl\File;
use Psl\Json;
use Psl\Type;
use Psl\Vec;

/** /guest-language.json's cases, which packages/domain's guestLanguage is tested against too: one rule, so drift either way fails (sc-3790). */
final class GuestLanguageTest extends TestCase
{
    /** @param list<string> $browser */
    #[Test]
    #[DataProvider('cases')]
    public function eachCaseOpensInItsLanguage(?string $chosen, array $browser, ?string $host, string $organisation, string $page, string $message): void
    {
        self::assertSame($page, GuestLanguage::pageLanguage($chosen, $browser, $host, $organisation));
        self::assertSame($message, GuestLanguage::messageLanguage($chosen, $host, $organisation));
    }

    #[Test]
    public function theTableHoldsTheCasesTheStoryNames(): void
    {
        $browsers = Vec\map(self::cases(), static fn (array $row): string => \implode(',', $row[1]));

        self::assertContains('pt-BR', $browsers);
        self::assertContains('de', $browsers);
    }

    /** @return array<string, array{0: ?string, 1: list<string>, 2: ?string, 3: string, 4: string, 5: string}> */
    public static function cases(): array
    {
        // A fixed mount, like EVENT_STATES_FILE: the file lives outside the application's tree.
        $path = $_SERVER['GUEST_LANGUAGE_FILE'] ?? \getenv('GUEST_LANGUAGE_FILE') ?: null;

        self::assertIsString($path, 'GUEST_LANGUAGE_FILE is not set — see compose.yaml');
        self::assertFileExists($path, 'The guest language cases are missing');

        $declared = Json\typed(File\read($path), Type\shape([
            'cases' => Type\vec(Type\shape([
                'name' => Type\string(),
                'chosen' => Type\nullable(Type\string()),
                'browser' => Type\vec(Type\string()),
                'host' => Type\nullable(Type\string()),
                'organisation' => Type\string(),
                'page' => Type\string(),
                'message' => Type\string(),
            ])),
        ], true));

        $cases = [];

        foreach ($declared['cases'] as $row) {
            $cases[$row['name']] = [$row['chosen'], $row['browser'], $row['host'], $row['organisation'], $row['page'], $row['message']];
        }

        return $cases;
    }
}
