<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Guest\GuestNeedsRecord;
use App\Domain\Guest\Model\GuestNeeds;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\MealAnswer;
use App\Entity\MenuCourse;
use App\Entity\MenuDish;
use App\Entity\MenuDishVariant;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\MenuChangeWhy;
use App\Enum\NeedKind;
use App\Enum\Permission;
use App\Tests\ApiTestCase;
use App\Tests\Double\ScriptedPdfMaker;
use App\Tests\Double\WithholdingMembershipDirectory;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use Doctrine\DBAL\Connection;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\File;
use Psl\Filesystem;
use Psl\Iter;
use Psl\Json;
use Psl\Shell;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use SensitiveParameter;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Uid\Uuid;

/** The kitchen sheet (sc-3911): allergies first, by name with guests.manage and as counts without, then diets, then each course as See picks counts it. */
final class KitchenSheetTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private User $owner;

    private Organisation $organisation;

    private string $eventId;

    private MenuCourse $starter;

    private MenuCourse $main;

    private MenuDish $jollof;

    private MenuDish $egusi;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::mockTime(new DateTimeImmutable('2026-10-03T09:00:00+00:00'));
        $this->owner = $this->account('owner@ire.events');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->eventId = $this->live($this->organisation);
        $event = self::em()->find(Event::class, Uuid::fromString($this->eventId)) ?? self::fail('no event');
        $this->starter = new MenuCourse($event, 'Starter', null, 0);
        $this->starter->setGuestsChoose(false);
        $soup = new MenuDish($this->starter, null, 'Catfish pepper soup', null, ['fish', 'celery'], [], 0);
        $fullBowl = new MenuDishVariant($soup, 'Full bowl', false, ['fish', 'celery'], [], null, 0);
        $childrensBowl = new MenuDishVariant($soup, "Children's portion", true, ['fish'], [], null, 1);
        $this->main = new MenuCourse($event, 'Main', null, 1);
        $this->main->setSkippable(true);
        $this->jollof = new MenuDish($this->main, null, 'Jollof rice', null, ['celery'], ['vegetarian', 'halal'], 0);
        $this->egusi = new MenuDish($this->main, null, 'Pounded yam and egusi', null, ['milk', 'fish'], [], 1);

        foreach ([$this->starter, $soup, $fullBowl, $childrensBowl, $this->main, $this->jollof, $this->egusi] as $row) {
            self::em()->persist($row);
        }

        self::em()->flush();
    }

    #[Test]
    public function allergiesComeFirstByNameThenDietsThenEachCourseAsSeePicksCountsIt(): void
    {
        $token = $this->coming([['fullName' => 'Chidi Okonkwo'], ['fullName' => 'Ada Obi'], ['fullName' => 'Kojo Asante']]);
        [$bisi, $chidi, $ada, $kojo] = [$this->personId('Bisi Adewale'), $this->personId('Chidi Okonkwo'), $this->personId('Ada Obi'), $this->personId('Kojo Asante')];
        $this->records($chidi, ['celery']);
        $this->records($ada, ['milk', 'other'], other: 'Kiwi');
        $this->records($kojo, [], ['vegan']);
        $this->meals($token, [
            ['person' => $bisi, 'course' => $this->id($this->main), 'answer' => 'chosen', 'dish' => $this->id($this->jollof)],
            ['person' => $chidi, 'course' => $this->id($this->main), 'answer' => 'chefsChoice'],
            ['person' => $ada, 'course' => $this->id($this->main), 'answer' => 'skipped'],
        ]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        $sheet = $this->sheet();

        self::assertSame('2026-10-03T10:00:00+01:00', $sheet['asOf'], 'the snapshot, in the event’s time zone');
        self::assertSame([4, 2, true, 'a4'], [$sheet['coming'], $sheet['allergicCount'], $sheet['names'], $sheet['paper']]);
        self::assertSame([
            ['id' => $ada, 'name' => 'Ada Obi', 'allergens' => ['milk', 'other'], 'otherAllergy' => 'Kiwi', 'diets' => [], 'otherDiet' => null, 'cells' => [['kind' => 'dish', 'text' => 'Catfish pepper soup, Full bowl'], ['kind' => 'skipped']]],
            ['id' => $chidi, 'name' => 'Chidi Okonkwo', 'allergens' => ['celery'], 'otherAllergy' => null, 'diets' => [], 'otherDiet' => null, 'cells' => [['kind' => 'host'], ['kind' => 'kitchen']]],
        ], $sheet['allergic'], 'Kojo, vegan with no allergy, can still choose before any close, so is not named');
        self::assertSame([['code' => 'milk', 'count' => 1], ['code' => 'celery', 'count' => 1], ['code' => 'other', 'count' => 1]], $sheet['allergyCounts']);
        self::assertSame([['code' => 'vegan', 'count' => 1]], $sheet['dietCounts']);
        self::assertSame(['Starter', 'Main'], Vec\map(self::courses($sheet), static fn (array $course): mixed => $course['name']));
        $this->assertSameAsSeePicks($sheet);
    }

    #[Test]
    public function aPersonAskedAgainIsMenuChangedInTheirCellAndCountedOnNoDish(): void
    {
        $token = $this->coming([['fullName' => 'Ada Obi']]);
        [$bisi, $ada] = [$this->personId('Bisi Adewale'), $this->personId('Ada Obi')];
        $this->records($ada, ['milk']);
        $this->meals($token, [
            ['person' => $bisi, 'course' => $this->id($this->main), 'answer' => 'chosen', 'dish' => $this->id($this->jollof)],
            ['person' => $ada, 'course' => $this->id($this->main), 'answer' => 'chosen', 'dish' => $this->id($this->jollof)],
        ]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::em()->clear();
        $answer = self::em()->getRepository(MealAnswer::class)->findOneBy(['person' => Uuid::fromString($ada), 'course' => $this->main->getId()]) ?? self::fail('no answer');
        $answer->askAgain(MenuChangeWhy::Removed);
        self::em()->flush();

        $sheet = $this->sheet();
        $main = self::courses($sheet)[1];

        self::assertSame([['kind' => 'dish', 'text' => 'Catfish pepper soup, Full bowl'], ['kind' => 'changed']], Type\vec(Type\shape(['cells' => Type\mixed()], true))->coerce($sheet['allergic'])[0]['cells']);
        self::assertSame([1, 1], [$main['menuChanged'], Type\vec(Type\shape(['name' => Type\string(), 'count' => Type\int()], true))->coerce($main['rows'])[0]['count']], 'Ada’s Jollof rice is let go, so only Bisi’s counts');
        $this->assertSameAsSeePicks($sheet);
    }

    #[Test]
    public function aNameThatStartsWithAnAccentedLetterSortsWithItsLetter(): void
    {
        $this->coming([['fullName' => 'Oluwatoyin Bello'], ['fullName' => 'Émile Durand'], ['fullName' => 'Zainab Musa']]);
        foreach (['Oluwatoyin Bello', 'Émile Durand', 'Zainab Musa'] as $name) {
            $this->records($this->personId($name), ['celery']);
        }

        self::assertSame(['Émile Durand', 'Oluwatoyin Bello', 'Zainab Musa'], Vec\map(Type\vec(Type\shape(['name' => Type\string()], true))->coerce($this->sheet()['allergic']), static fn (array $row): string => $row['name']));
    }

    #[Test]
    public function withoutGuestsManageTheSheetCountsAllergiesAndNamesNobody(): void
    {
        $this->coming([['fullName' => 'Chidi Okonkwo']]);
        $this->records($this->personId('Chidi Okonkwo'), ['celery']);

        foreach ([Permission::GuestsManage, Permission::GuestsRead] as $withheld) {
            self::service(WithholdingMembershipDirectory::class)->withhold($withheld);
            $sheet = $this->sheet();

            self::assertFalse($sheet['names'], $withheld->value);
            self::assertNull($sheet['allergic'], $withheld->value);
            self::assertSame(1, $sheet['allergicCount'], $withheld->value);
            self::assertSame([['code' => 'celery', 'count' => 1]], $sheet['allergyCounts'], $withheld->value);
            self::assertStringNotContainsString('Chidi', Json\encode($sheet), $withheld->value);

            self::service(ScriptedPdfMaker::class)->answer('%PDF-1.7');
            $this->as('POST', $this->sheetPath() . '/pdf');
            self::assertSame(200, $this->statusCode());
            $html = self::service(ScriptedPdfMaker::class)->html ?? self::fail('no html');
            self::assertStringNotContainsString('Chidi', $html, $withheld->value);
            self::assertStringContainsString('Names need Guests manage.', $html, $withheld->value);
        }
    }

    #[Test]
    public function afterTheCloseThoseNeverGivenTheDefaultStayNotChosen(): void
    {
        $token = $this->coming([['fullName' => 'Chidi Okonkwo'], ['fullName' => 'Ada Obi'], ['fullName' => 'Kojo Asante']]);
        [$bisi, $chidi] = [$this->personId('Bisi Adewale'), $this->personId('Chidi Okonkwo')];
        $this->records($chidi, ['celery']);
        $this->meals($token, [['person' => $bisi, 'course' => $this->id($this->main), 'answer' => 'chosen', 'dish' => $this->id($this->egusi)]]);
        $this->as('PUT', '/api/events/' . $this->eventId . '/menu/courses/' . $this->id($this->main), ['name' => 'Main', 'answer' => 'choose', 'skippable' => true, 'default' => ['dish' => $this->id($this->jollof), 'chooseBy' => '2026-10-10']]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        $before = self::course($this->sheet(), 'Main');
        self::assertSame([3, false, null], [$before['notChosen'], $before['never'], $before['given']]);

        self::mockTime(new DateTimeImmutable('2026-10-11T09:00:00+00:00'));
        $sheet = $this->sheet();
        $main = self::course($sheet, 'Main');

        self::assertSame([1, true], [$main['notChosen'], $main['never']]);
        self::assertSame(['count' => 2, 'plate' => 'Jollof rice'], $main['given']);
        self::assertSame(2, self::row($main, 'Jollof rice')['count'], 'the defaulted are in the default dish’s count');
        self::assertSame([['kind' => 'host'], ['kind' => 'never']], Type\vec(Type\shape(['cells' => Type\mixed()], true))->coerce($sheet['allergic'])[0]['cells']);
        $this->assertSameAsSeePicks($sheet);

        self::service(ScriptedPdfMaker::class)->answer('%PDF-1.7');
        $this->as('POST', $this->sheetPath() . '/pdf');
        $html = self::service(ScriptedPdfMaker::class)->html ?? self::fail('no html');
        self::assertStringContainsString('1 not chosen, never given the default', $html);
        self::assertStringContainsString('2 given the default, Jollof rice, when picks closed. They are in its count.', $html);
    }

    #[Test]
    public function afterTheCloseThoseADietAloneKeptFromTheDefaultAreNamedOutsideTheAllergyCounts(): void
    {
        $token = $this->coming([['fullName' => 'Kojo Asante'], ['fullName' => 'Ada Obi']]);
        [$bisi, $kojo, $ada] = [$this->personId('Bisi Adewale'), $this->personId('Kojo Asante'), $this->personId('Ada Obi')];
        $this->records($kojo, [], ['vegan']);
        $this->records($ada, [], ['other'], otherDiet: 'No garlic');
        $this->meals($token, [['person' => $bisi, 'course' => $this->id($this->main), 'answer' => 'chosen', 'dish' => $this->id($this->egusi)]]);
        $this->as('PUT', '/api/events/' . $this->eventId . '/menu/courses/' . $this->id($this->main), ['name' => 'Main', 'answer' => 'choose', 'skippable' => true, 'default' => ['dish' => $this->id($this->jollof), 'chooseBy' => '2026-10-10']]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame([], $this->sheet()['allergic'], 'before the close they can still choose');

        self::mockTime(new DateTimeImmutable('2026-10-11T09:00:00+00:00'));
        $sheet = $this->sheet();

        self::assertSame([
            ['id' => $ada, 'name' => 'Ada Obi', 'allergens' => [], 'otherAllergy' => null, 'diets' => ['other'], 'otherDiet' => 'No garlic', 'cells' => [['kind' => 'dish', 'text' => 'Catfish pepper soup, Full bowl'], ['kind' => 'never']]],
            ['id' => $kojo, 'name' => 'Kojo Asante', 'allergens' => [], 'otherAllergy' => null, 'diets' => ['vegan'], 'otherDiet' => null, 'cells' => [['kind' => 'dish', 'text' => 'Catfish pepper soup, Full bowl'], ['kind' => 'never']]],
        ], $sheet['allergic']);
        self::assertSame([0, []], [$sheet['allergicCount'], $sheet['allergyCounts']], 'a diet is not an allergy');
        self::assertSame(2, self::course($sheet, 'Main')['notChosen']);
        $this->assertSameAsSeePicks($sheet);

        self::service(ScriptedPdfMaker::class)->answer('%PDF-1.7');
        $this->as('POST', $this->sheetPath() . '/pdf');
        $html = self::service(ScriptedPdfMaker::class)->html ?? self::fail('no html');
        self::assertStringContainsString('<p class="line">No allergies recorded for anyone coming.</p><table>', $html, 'the line stands, with them listed under it');
        self::assertStringContainsString('<th scope="row">Ada Obi</th><td>No allergy · No garlic (other)</td>', $html);
        self::assertStringContainsString('<th scope="row">Kojo Asante</th><td>No allergy · Vegan</td>', $html);
        self::assertStringContainsString('Not chosen, never given the default', $html);
        self::assertStringContainsString('<th scope="row">Other diet</th>', $html, 'the counts keep the label, not the words');
        self::assertCount(2, Str\split($html, 'No garlic'), 'the words reach the named row only');
    }

    #[Test]
    public function thePdfIsMadeWhenPressedInTheViewersLanguageAndNamedForTheSnapshotsDay(): void
    {
        $this->coming([['fullName' => 'Chidi Okonkwo']]);
        $this->records($this->personId('Chidi Okonkwo'), ['celery']);
        self::service(ScriptedPdfMaker::class)->answer('%PDF-1.7');
        self::mockTime(new DateTimeImmutable('2026-10-03T23:30:00+00:00'));

        $this->as('POST', $this->sheetPath() . '/pdf');

        self::assertSame(200, $this->statusCode());
        self::assertSame('%PDF-1.7', $this->client->getResponse()->getContent());
        self::assertSame('application/pdf', $this->client->getResponse()->headers->get('Content-Type'));
        self::assertStringContainsString("filename*=utf-8''" . \rawurlencode("Amara & Tobi's wedding kitchen sheet 2026-10-04.pdf"), (string) $this->client->getResponse()->headers->get('Content-Disposition'), 'the day in Lagos, an hour ahead');
        $html = self::service(ScriptedPdfMaker::class)->html ?? self::fail('no html');
        self::assertStringContainsString('<html lang="en">', $html);
        self::assertStringContainsString('This sheet holds guests’ health information. Keep it with the kitchen and dispose of it after the event.', $html);
        $order = Vec\map(['<h2>Allergies</h2>', '<h2>Diets</h2>', '<h2>Starter</h2>', '<h2>Main</h2>'], static fn (string $heading): int => Str\search($html, $heading) ?? self::fail('no ' . $heading));
        self::assertSame(Vec\sort($order), $order, 'allergies first, then diets, then each course in order');
        self::assertStringContainsString('<th scope="row">Chidi Okonkwo</th><td>Celery</td>', $html);

        $this->as('POST', $this->sheetPath() . '/pdf', language: 'es');
        self::assertStringContainsString('<html lang="es">', self::service(ScriptedPdfMaker::class)->html ?? '');
    }

    #[Test]
    public function aLetterCountryGetsLetterAndEveryOtherA4(): void
    {
        self::service(ScriptedPdfMaker::class)->answer('%PDF-1.7');

        foreach (['US' => ['letter', 'size: letter'], 'FR' => ['a4', 'size: A4']] as $country => [$paper, $size]) {
            self::service(Connection::class)->executeStatement('UPDATE organisations SET country_code = :country WHERE id = :id', ['country' => $country, 'id' => $this->organisation->getId()->toRfc4122()]);
            self::em()->clear();

            self::assertSame($paper, $this->sheet()['paper'], $country);
            $this->as('POST', $this->sheetPath() . '/pdf');
            self::assertStringContainsString('@page { ' . $size . ';', self::service(ScriptedPdfMaker::class)->html ?? '', $country);
        }
    }

    #[Test]
    public function whenThePdfCannotBeMadeTheAnswerSaysSo(): void
    {
        self::service(ScriptedPdfMaker::class)->takeDown();

        $this->as('POST', $this->sheetPath() . '/pdf');

        self::assertSame([503, 'https://soirely.com/errors/service_unavailable'], [$this->statusCode(), $this->last()['type'] ?? null]);
    }

    #[Test]
    public function theSheetNeedsMenuRead(): void
    {
        self::service(WithholdingMembershipDirectory::class)->withhold(Permission::MenuRead);

        $this->as('GET', $this->sheetPath());
        self::assertSame(403, $this->statusCode());
        $this->as('POST', $this->sheetPath() . '/pdf');
        self::assertSame(403, $this->statusCode());
    }

    /** The real WeasyPrint, and veraPDF's PDF/UA-1 profile (ISO 14289-1) on what it made: both are on the dev and CI image (sc-5821). */
    #[Test]
    public function aMadeSheetPassesVeraPdfsPdfUa1Profile(): void
    {
        $token = $this->coming([['fullName' => 'Chidi Okonkwo'], ['fullName' => 'Ada Obi']]);
        $this->records($this->personId('Chidi Okonkwo'), ['celery']);
        $this->records($this->personId('Ada Obi'), ['milk'], ['vegetarian']);
        $this->meals($token, [['person' => $this->personId('Bisi Adewale'), 'course' => $this->id($this->main), 'answer' => 'skipped']]);

        $this->as('POST', $this->sheetPath() . '/pdf');
        self::assertSame(200, $this->statusCode(), (string) $this->client->getResponse()->getContent());
        $file = Filesystem\create_temporary_file(null, 'kitchen') . '.pdf';
        File\write($file, (string) $this->client->getResponse()->getContent());

        try {
            $report = Shell\execute('verapdf', ['--flavour', 'ua1', '--format', 'xml', $file]);
        } catch (Shell\Exception\FailedExecutionException $failed) {
            $report = $failed->getOutput();
        } finally {
            Filesystem\delete_file($file);
        }

        self::assertStringContainsString('isCompliant="true"', $report, $report);
    }

    /** @param array<string, mixed> $sheet */
    private function assertSameAsSeePicks(array $sheet): void
    {
        $this->as('GET', '/api/events/' . $this->eventId . '/menu/picks');
        $picks = Type\shape(['picks' => Type\mixed_dict()], true)->coerce($this->last())['picks'];

        foreach (self::courses($picks) as $at => $seen) {
            $course = self::courses($sheet)[$at];
            $rows = Type\vec(Type\shape(['id' => Type\string(), 'chosen' => Type\int(), 'defaulted' => Type\int()], true))->coerce($seen['rows']);
            self::assertSame(Vec\map($rows, static fn (array $row): array => [$row['id'], $row['chosen'] + $row['defaulted']]), Vec\map(Type\vec(Type\shape(['id' => Type\string(), 'count' => Type\int()], true))->coerce($course['rows']), static fn (array $row): array => [$row['id'], $row['count']]));
            foreach (['kitchen', 'skipped', 'needsHost', 'notChosen', 'menuChanged', 'room'] as $state) {
                self::assertSame($seen[$state], $course[$state], $state);
            }
        }
    }

    /** @return array<string, mixed> */
    private function sheet(): array
    {
        $this->as('GET', $this->sheetPath());
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        return Type\shape(['sheet' => Type\dict(Type\string(), Type\mixed())], true)->coerce($this->last())['sheet'];
    }

    private function sheetPath(): string
    {
        return '/api/events/' . $this->eventId . '/menu/kitchen-sheet';
    }

    /** @return list<array<string, mixed>> */
    private static function courses(mixed $sheet): array
    {
        return Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce(Type\mixed_dict()->coerce($sheet)['courses'] ?? null);
    }

    /** @return array<string, mixed> */
    private static function course(mixed $sheet, string $name): array
    {
        return Iter\search(self::courses($sheet), static fn (array $course): bool => $name === ($course['name'] ?? null)) ?? self::fail('no course ' . $name);
    }

    /** @return array<string, mixed> */
    private static function row(mixed $course, string $name): array
    {
        $rows = Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce(Type\mixed_dict()->coerce($course)['rows'] ?? null);

        return Iter\search($rows, static fn (array $row): bool => $name === ($row['name'] ?? null)) ?? self::fail('no row ' . $name);
    }

    private function id(MenuCourse|MenuDish $row): string
    {
        return $row->getId()->toRfc4122();
    }

    /** @param list<array{fullName: ?string}> $companions */
    private function coming(array $companions): string
    {
        $this->as('POST', '/api/events/' . $this->eventId . '/guests', ['fullName' => 'Bisi Adewale', 'companions' => Vec\map($companions, static fn (array $one): array => ['fullName' => $one['fullName']])]);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
        $guestId = Type\shape(['id' => Type\string()], true)->coerce($this->last()['guest'] ?? null)['id'];
        $this->as('GET', '/api/events/' . $this->eventId . '/guests/' . $guestId . '/link');
        $token = Str\after(Type\string()->coerce($this->last()['url'] ?? null), '/i/') ?? self::fail('no token');
        $this->anonymous('/api/guest-links/page', ['token' => $token]);
        $listed = Type\vec(Type\shape(['id' => Type\string()], true))->coerce(Type\mixed_dict()->coerce($this->last()['guest'] ?? null)['companions'] ?? []);
        $this->anonymous('/api/guest-links/reply', [
            'token' => $token,
            'answer' => 'coming',
            'needs' => ['allergies' => []],
            'companions' => Vec\map_with_key($listed, static fn (int $at, array $companion): array => ['id' => $companion['id'], 'fullName' => $companions[$at]['fullName'], 'coming' => true]),
        ]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        return $token;
    }

    private function personId(string $name): string
    {
        return Type\string()->coerce(self::service(Connection::class)->fetchOne('SELECT id FROM guests WHERE full_name = :name', ['name' => $name]));
    }

    /**
     * @param list<string> $allergies
     * @param list<string> $diets
     */
    private function records(string $guestId, array $allergies, array $diets = [], ?string $other = null, ?string $otherDiet = null): void
    {
        $person = self::em()->find(Guest::class, Uuid::fromString($guestId)) ?? self::fail('no guest');
        $none = GuestNeeds::none();
        $needs = new GuestNeeds([...$none->codes, NeedKind::Allergen->value => $allergies, NeedKind::Diet->value => $diets], [...$none->others, NeedKind::Allergen->value => $other, NeedKind::Diet->value => $otherDiet], null);
        self::service(GuestNeedsRecord::class)->write($person, $needs, $this->owner);
        self::em()->flush();
    }

    /** @param list<array<string, mixed>> $picks */
    private function meals(#[SensitiveParameter] string $token, array $picks): void
    {
        $this->anonymous('/api/guest-links/meals', ['token' => $token, 'picks' => $picks]);
    }

    /** @param array<string, mixed> $body */
    private function anonymous(string $path, #[SensitiveParameter] array $body): void
    {
        $this->client->request('POST', $path, server: ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT_LANGUAGE' => 'en'], content: Json\encode($body));
    }

    private function live(Organisation $organisation): string
    {
        $this->as('POST', '/api/orgs/' . $organisation->getId()->toRfc4122() . '/events', ['name' => "Amara & Tobi's wedding", 'type' => 'wedding', 'startsAt' => '2030-11-14T16:00', 'endsAt' => '2030-11-15T02:00', 'timeZone' => 'Africa/Lagos', 'currency' => 'NGN']);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
        $id = Type\shape(['id' => Type\string()], true)->coerce($this->last()['event'] ?? null)['id'];
        self::service(Connection::class)->executeStatement('UPDATE events SET hosts = :hosts WHERE id = :id', ['hosts' => '["Funmi Adeyemi"]', 'id' => $id]);
        $this->as('POST', '/api/events/' . $id . '/make-live');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        return $id;
    }

    private function account(string $address): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Person', self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    /** @param array<string, mixed>|null $body */
    private function as(string $method, string $path, ?array $body = null, string $language = 'en'): void
    {
        $who = self::em()->find(User::class, $this->owner->getId()) ?? self::fail('no user');
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($who),
            'HTTP_ACCEPT_LANGUAGE' => $language,
        ], content: null === $body ? null : Json\encode($body));
    }

    /** @return array<string, mixed> */
    private function last(): array
    {
        $raw = (string) $this->client->getResponse()->getContent();

        return '' === $raw || !Str\starts_with($raw, '{') ? [] : Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($raw));
    }

    private function statusCode(): int
    {
        return $this->client->getResponse()->getStatusCode();
    }
}
