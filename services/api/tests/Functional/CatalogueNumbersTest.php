<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Enum\CatalogueLimit;
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
    /** Words about the plan beside the limits' own: an identifier is read as words, so `FREE_GUESTS_PER_EVENT` and `$creditsPerSms` both speak. */
    private const array PLAN_WORDS = ['credit', 'price', 'cost', 'proposal', 'quota', 'allowance', 'included', 'enterprise', 'catalogue', 'review level', 'member', 'limit', 'max', 'maximum', 'cap', 'free'];

    private const array LIMIT_FILLER = ['per', 'live', 'team', 'bytes'];

    /** Lines that name a number the catalogue happens to hold, for a reason that is not the plan: a field's length, a table's size, a retry cap. */
    private const array NOT_THE_PLAN = [
        'Enum/TableShape.php: self::Round => [\'widthCm\' => 180, \'lengthCm\' => 180, \'seats\' => 10],',
        'Enum/TableShape.php: self::Head => [\'widthCm\' => 240, \'lengthCm\' => 76, \'seats\' => 4],',
        'Enum/TableShape.php: self::Cocktail => [\'widthCm\' => 60, \'lengthCm\' => 60, \'seats\' => 4],',
        'Domain/Organisation/OrganisationRules.php: public const int NAME_MAXIMUM = 100;',
        'Domain/Guest/GuestRules.php: public const int OTHER_MAXIMUM = 100;',
        'Domain/Seating/GuestSeater.php: if (Iter\\count($seats) < 2) {',
        'Domain/Seating/SeatingPlanEditor.php: $seat = new SeatingSeat($plan, $named[\'name\'], $named[\'nameKey\'], Math\\div($plan->getWidthCm(), 2), Math\\div($plan->getLengthCm(), 2), $by);',
        'Domain/Seating/FloorGeometry.php: return [($seats - 1) / 2 * $spacingCm + self::CHAIR_RADIUS_CM + self::ROW_TAB_CM, self::CHAIR_RADIUS_CM];',
        'Domain/User/Device/KnownDevices.php: public const int DAILY_CAP = 10;',
        'Domain/Messaging/Command/WorkNotificationsCommand.php: public const int PROVIDER_CALL_LIMIT = 3;',
        'Integrations/Nominatim/NominatimProvider.php: \'limit\' => 8,',
        'Entity/MenuCourse.php: public const int PER_EVENT_MAXIMUM = 10;',
        'Entity/MenuCourse.php: public const int OWN_ITEMS_MAXIMUM = 3;',
        'Entity/Guest.php: public const int COMPANIONS_MAXIMUM = 10;',
        'Entity/BudgetLine.php: public const int LABEL_MAXIMUM = 100;',
        'Entity/ScheduledPayment.php: public const int DESCRIPTION_MAXIMUM = 100;',
        'Entity/ScheduledPayment.php: public const int REFERENCE_MAXIMUM = 100;',
        'Domain/Budget/QuoteRules.php: public const int SCHEDULE_MAXIMUM = 10;',
        'Entity/MenuDishChoice.php: public const int PER_DISH_MAXIMUM = 3;',
        'Entity/MenuDishChoice.php: public const int OPTIONS_MAXIMUM = 8;',
        'Entity/SeatingRow.php: public const int LABEL_MAXIMUM = 10;',
        'Entity/SeatingRow.php: public const int SEATS_DEFAULT = 10;',
        'Entity/SeatingRow.php: public const int SPACING_MAXIMUM_CM = 100;',
        'Entity/VerificationChallenge.php: public const int MAXIMUM_ATTEMPTS = 5;',
        'Entity/GuestGroup.php: public const int MOST_PER_EVENT = 50;',
        'Entity/StaffShift.php: public const int NEEDED_MAXIMUM = 50;',
        'WebAuthn/Cbor.php: private const int MAX_DEPTH = 8;',
        'WebAuthn/Cbor.php: if ($value > (\\PHP_INT_MAX >> 8)) {',
        'Domain/Messaging/GuestMessages/GuestEmailUnsubscribe.php: && \\hash_equals($this->signature($guest->getId(), $guest->getEvent()->getOrganisation()->getId()), Str\\Byte\\slice($token, 22));',
        'Integrations/SingleSignOn/HttpProviderDocuments.php: $response = $this->http->request(\'GET\', $url, [\'timeout\' => 10, \'max_redirects\' => 3]);',
        'Entity/GuestSuppression.php: #[ORM\\Column(type: Types::STRING, length: 10, enumType: GuestChannel::class)]',
    ];

    #[Test]
    public function noNumberFromTheCatalogueIsWrittenIntoFeatureCode(): void
    {
        $numbers = $this->catalogueNumbers();
        $found = [];

        /** @var SplFileInfo $file */
        foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator(self::sourceRoot())) as $file) {
            if ('php' === $file->getExtension()) {
                $path = Str\after($file->getPathname(), '/src/') ?? $file->getPathname();

                foreach (self::find((string) \file_get_contents($file->getPathname()), $numbers) as $line => $text) {
                    if (!Iter\contains(self::NOT_THE_PLAN, $path . ': ' . $text)) {
                        $found[] = $path . ':' . $line . ': ' . $text;
                    }
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
        yield 'a guest count compared' => ['if ($guestCount >= 100) {', true];
        yield 'a guest cap with no plan in its name' => ['const MAX_GUESTS = 100;', true];
        yield 'a storage limit in bytes' => ['$storageLimit = 2000000000;', true];
        yield 'a member count compared' => ['if (count($members) > 3) {', true];
        yield 'a seat cap' => ['const FREE_SEATS = 3;', true];
        yield 'an AI allowance' => ['$aiRequestsPerMonth = 5;', true];
        yield 'an event cap' => ['const MAX_ACTIVE_EVENTS = 2;', true];
        yield 'a number the catalogue does not hold' => ['$creditsLeft = 7;', false];
        yield 'a number in a comment' => ['// the Free plan allows 100 guests per event', false];
    }

    #[Test]
    #[DataProvider('sources')]
    public function theGuardFindsAPlanNumberAndNothingElse(string $line, bool $found): void
    {
        self::assertSame($found, [] !== self::find("<?php\n" . $line, [2, 3, 5, 13, 100, 24900, 2000000000]));
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
     * @return array<int, string> the source of each line about the plan that holds a number, by its line
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

            if (Regex\matches($words, self::aboutThePlan())) {
                $found[$token->line] = Str\trim($text);
            }
        }

        return $found;
    }

    /** @return non-empty-string the limits' words from CatalogueLimit itself, so a new limit is guarded with no change here */
    private static function aboutThePlan(): string
    {
        $words = Vec\map(CatalogueLimit::cases(), static fn (CatalogueLimit $limit): array => Str\split($limit->value, '_'));
        $words = Vec\filter(Dict\unique([...self::PLAN_WORDS, ...Vec\flatten($words)]), static fn (string $word): bool => !Iter\contains(self::LIMIT_FILLER, $word));

        return '/\\b(' . Str\join(Vec\map($words, static fn (string $word): string => Regex\replace($word, '/(?<=...)s$/', '') . 's?'), '|') . ')\\b/';
    }

    private static function sourceRoot(): string
    {
        return \dirname(__DIR__, 2) . '/src';
    }
}
