<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Repository\CatalogueVersionRepository;
use App\Tests\FunctionalTestCase;
use PhpToken;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Dict;
use Psl\Iter;
use Psl\Regex;
use Psl\Str;
use Psl\Vec;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use SplFileInfo;

/** sc-3928: a number the catalogue holds is never written into feature code, where it would drift from the version a subscriber bought. */
final class CatalogueNumbersTest extends FunctionalTestCase
{
    /** A line about the plan, by its words: an identifier is read as words, so `FREE_GUESTS_PER_EVENT` and `$creditsPerSms` both speak. */
    private const string ABOUT_THE_PLAN = '/\b(credits?|prices?|costs?|proposals?|whatsapp|sms|quotas?|allowances?|included|enterprise|catalogue|live events?|guests? per event|team seats?|review level)\b/';

    #[Test]
    public function noNumberFromTheCatalogueIsWrittenIntoFeatureCode(): void
    {
        $numbers = $this->catalogueNumbers();
        $found = [];

        /** @var SplFileInfo $file */
        foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator(self::sourceRoot())) as $file) {
            if ('php' === $file->getExtension()) {
                foreach (self::find((string) \file_get_contents($file->getPathname()), $numbers) as $line) {
                    $found[] = (Str\after($file->getPathname(), '/src/') ?? $file->getPathname()) . ':' . $line;
                }
            }
        }

        self::assertSame([], $found, 'Read these from the catalogue (App\Domain\Billing\Catalogue\Catalogue) instead.');
    }

    /** @return iterable<string, array{string, bool}> */
    public static function sources(): iterable
    {
        yield 'a guest cap as a constant' => ['private const int FREE_GUESTS_PER_EVENT = 100;', true];
        yield 'a credit cost in a sum' => ['$charge = $segments * 13; // credits', true];
        yield 'a price in minor units' => ['$enterprisePrice = 24900;', true];
        yield 'a hundred that is a name length' => ['public const int NAME_MAXIMUM = 100;', false];
        yield 'a number the catalogue does not hold' => ['$creditsLeft = 7;', false];
        yield 'a number in a comment' => ['// the Free plan allows 100 guests per event', false];
    }

    /** The guard's own test: it has to find what it exists to find, and only that. */
    #[Test]
    #[DataProvider('sources')]
    public function theGuardFindsAPlanNumberAndNothingElse(string $line, bool $found): void
    {
        self::assertSame($found, [] !== self::find("<?php\n" . $line, [13, 100, 24900]));
    }

    /** @return list<int> every whole number in every version, past 1, which says nothing alone */
    private function catalogueNumbers(): array
    {
        $numbers = [];

        foreach (self::service(CatalogueVersionRepository::class)->findAllInOrder() as $version) {
            $terms = $version->getTerms();
            \array_walk_recursive($terms, static function (mixed $value) use (&$numbers): void {
                if (\is_int($value) && $value > 1) {
                    $numbers[] = $value;
                }
            });
        }

        self::assertNotSame([], $numbers, 'The catalogue holds no versions to guard.');

        return Vec\values(Dict\unique($numbers));
    }

    /**
     * @param list<int> $numbers
     *
     * @return list<string> "line: source" for each number found on a line about the plan
     */
    private static function find(string $source, array $numbers): array
    {
        $lines = Str\split($source, "\n");
        $found = [];

        foreach (PhpToken::tokenize($source) as $token) {
            if (\T_LNUMBER !== $token->id || !Iter\contains($numbers, (int) Str\replace($token->text, '_', ''))) {
                continue;
            }

            $text = $lines[$token->line - 1] ?? '';
            $words = Str\lowercase(Str\trim(Regex\replace(Regex\replace($text, '/([a-z])([A-Z])/', '$1 $2'), '/[^A-Za-z]+/', ' ')));

            if (Regex\matches($words, self::ABOUT_THE_PLAN)) {
                $found[] = $token->line . ': ' . Str\trim($text);
            }
        }

        return $found;
    }

    private static function sourceRoot(): string
    {
        return \dirname(__DIR__, 2) . '/src';
    }
}
