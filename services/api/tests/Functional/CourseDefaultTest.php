<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Guest\GuestNeedsRecord;
use App\Domain\Guest\Model\GuestNeeds;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\MenuCourse;
use App\Entity\MenuDish;
use App\Entity\MenuDishVariant;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\NeedKind;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use Doctrine\DBAL\Connection;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Dict;
use Psl\Iter;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use SensitiveParameter;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Uid\Uuid;

/** A course's default and choose-by date (sc-1362): set together on Edit course, given at the date to everyone coming with no answer whom it can't harm, and worked out rather than stored. */
final class CourseDefaultTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private User $owner;

    private string $eventId;

    private MenuCourse $starter;

    private MenuCourse $main;

    private MenuDish $jollof;

    private MenuDish $suya;

    private MenuDish $stew;

    private MenuDishVariant $plate;

    private MenuDishVariant $kidsPlate;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::mockTime(new DateTimeImmutable('2026-10-03T09:00:00+00:00'));
        $this->owner = $this->account('owner@ire.events');
        $organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->eventId = $this->live($organisation);
        $event = self::em()->find(Event::class, Uuid::fromString($this->eventId)) ?? self::fail('no event');
        $this->starter = new MenuCourse($event, 'Starter', null, 0);
        $this->starter->setGuestsChoose(false);
        $soup = new MenuDish($this->starter, null, 'Pepper soup', null, [], [], 0);
        $this->main = new MenuCourse($event, 'Main', null, 1);
        $this->jollof = new MenuDish($this->main, null, 'Jollof rice', null, [], ['vegetarian', 'halal'], 0);
        $this->suya = new MenuDish($this->main, null, 'Beef suya skewers', null, [], [], 1);
        $this->stew = new MenuDish($this->main, null, 'Rice and stew', null, [], [], 2);
        $this->plate = new MenuDishVariant($this->stew, 'Plate', false, [], ['halal'], null, 0);
        $this->kidsPlate = new MenuDishVariant($this->stew, 'Kids plate', true, [], ['halal'], null, 1);

        foreach ([$this->starter, $soup, $this->main, $this->jollof, $this->suya, $this->stew, $this->plate, $this->kidsPlate] as $row) {
            self::em()->persist($row);
        }

        self::em()->flush();
    }

    /** @param array<string, mixed> $default */
    #[Test]
    #[DataProvider('wrongDefaults')]
    public function aWrongPairIsRefusedBesideItsFieldAndNothingIsSaved(array $default, string $path, string $message): void
    {
        $this->changeMain(self::resolve($default, $this));

        self::assertSame(422, $this->statusCode(), Json\encode($this->last()));
        self::assertContains(['propertyPath' => $path, 'message' => $message], Vec\map(
            Type\vec(Type\shape(['propertyPath' => Type\string(), 'message' => Type\string()], true))->coerce($this->last()['violations'] ?? null),
            static fn (array $one): array => ['propertyPath' => $one['propertyPath'], 'message' => $one['message']],
        ));
        self::assertNull($this->mainOf($this->menu())['default']);
    }

    /** @return iterable<string, array{array<string, mixed>, string, string}> */
    public static function wrongDefaults(): iterable
    {
        yield 'a default with no date' => [['dish' => 'jollof', 'chooseBy' => null], 'default.chooseBy', 'Enter a choose-by date, or set the default to No default.'];
        yield 'a date with no default' => [['dish' => null, 'chooseBy' => '2026-10-10'], 'default.dish', 'Choose a default dish, or clear the choose-by date.'];
        yield 'a date on the event' => [['dish' => 'jollof', 'chooseBy' => '2030-11-14'], 'default.chooseBy', 'Choose a date before the event.'];
        yield 'a date in the past' => [['dish' => 'jollof', 'chooseBy' => '2026-10-02'], 'default.chooseBy', 'That date has passed. Choose today or later.'];
        yield 'a dish with variants and none named' => [['dish' => 'stew', 'chooseBy' => '2026-10-10'], 'default.variant', 'Choose the default’s variant.'];
        yield 'a Children only variant' => [['dish' => 'stew', 'variant' => 'kidsPlate', 'chooseBy' => '2026-10-10'], 'default.variant', 'Choose the default’s variant.'];
    }

    #[Test]
    public function theDateClosesTheCourseAtItsEndInTheEventsZone(): void
    {
        $this->changeMain(['dish' => $this->id($this->stew), 'variant' => $this->plate->getId()->toRfc4122(), 'chooseBy' => '2026-10-10']);

        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        $main = $this->mainOf($this->last());
        self::assertSame(['dish' => $this->id($this->stew), 'variant' => $this->plate->getId()->toRfc4122(), 'options' => [], 'chooseBy' => '2026-10-10'], $main['default']);
        self::assertSame(['at' => '2026-10-10T23:59:59+01:00', 'source' => 'chooseBy', 'closed' => false], $main['picksClose']);

        self::mockTime(new DateTimeImmutable('2026-10-10T22:59:59+00:00'));
        self::assertTrue(Type\shape(['closed' => Type\bool()], true)->coerce($this->mainOf($this->menu())['picksClose'])['closed']);

        $this->changeMain(['dish' => null, 'chooseBy' => null]);
        self::assertSame(422, $this->statusCode(), 'a passed date cannot be cleared');
        $this->changeMain(['dish' => $this->id($this->jollof), 'chooseBy' => '2026-10-20']);
        self::assertSame(422, $this->statusCode(), 'a passed date is locked');
    }

    #[Test]
    public function clearingThePairHandsTheCloseBackToTheEvent(): void
    {
        $this->changeMain(['dish' => $this->id($this->jollof), 'chooseBy' => '2026-10-10']);
        $this->changeMain(['dish' => null, 'chooseBy' => null]);

        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        $main = $this->mainOf($this->last());
        self::assertNull($main['default']);
        self::assertSame('start', Type\shape(['source' => Type\string()], true)->coerce($main['picksClose'])['source']);
    }

    #[Test]
    public function atTheDateEveryoneWithNoAnswerIsGivenTheDefaultExceptWhomItCouldHarm(): void
    {
        $token = $this->coming([['fullName' => 'Chidi Okonkwo'], ['fullName' => 'Ada Obi'], ['fullName' => 'Kojo Asante']]);
        [$bisi, $chidi, $ada, $kojo] = [$this->personId('Bisi Adewale'), $this->personId('Chidi Okonkwo'), $this->personId('Ada Obi'), $this->personId('Kojo Asante')];
        $this->records($chidi, ['celery']);
        $this->records($ada, [], 'vegan');
        $this->meals($token, [['person' => $bisi, 'course' => $this->id($this->main), 'answer' => 'chosen', 'dish' => $this->id($this->suya)]]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        $this->changeMain(['dish' => $this->id($this->jollof), 'chooseBy' => '2026-10-10']);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        $before = $this->picks();
        self::assertSame(0, self::row(self::course($before, 'Main'), 'Jollof rice')['defaulted']);
        self::assertSame([], $before['given']);
        self::assertSame([['course' => $this->id($this->main), 'reason' => 'allergy']], self::waiting($before, $chidi)['excluded']);

        self::mockTime(new DateTimeImmutable('2026-10-11T09:00:00+00:00'));
        $picks = $this->picks();
        $main = self::course($picks, 'Main');

        self::assertSame([1, 0], [self::row($main, 'Jollof rice')['defaulted'], self::row($main, 'Jollof rice')['chosen']]);
        self::assertSame(2, $main['notChosen']);
        self::assertSame(2, $picks['answered']);
        self::assertSame([['course' => $this->id($this->main), 'reason' => 'allergy']], self::waiting($picks, $chidi)['excluded']);
        self::assertSame([['course' => $this->id($this->main), 'reason' => 'vegan']], self::waiting($picks, $ada)['excluded']);
        self::assertSame([['id' => $bisi, 'replier' => 'Bisi Adewale', 'people' => [[
            'id' => $kojo,
            'name' => 'Kojo Asante',
            'courses' => [['course' => $this->id($this->main), 'dish' => $this->id($this->jollof), 'variant' => null, 'options' => []]],
        ]]]], $picks['given']);

        $this->anonymous('/api/guest-links/page', ['token' => $token]);
        $meals = Type\shape(['answers' => Type\dict(Type\string(), Type\vec(Type\mixed_dict())), 'excluded' => Type\dict(Type\string(), Type\mixed())], true)->coerce($this->last()['meals'] ?? null);
        self::assertSame([['course' => $this->id($this->main), 'answer' => 'defaulted', 'dish' => $this->id($this->jollof), 'variant' => null, 'options' => []]], $meals['answers'][$kojo]);
        self::assertSame([['course' => $this->id($this->main), 'reason' => 'vegan']], $meals['excluded'][$ada]);

        $this->records($ada, []);
        self::assertSame(2, self::row(self::course($this->picks(), 'Main'), 'Jollof rice')['defaulted'], 'a diet removed gives the default again');
    }

    #[Test]
    public function changingTheDefaultAfterTheDateAsksWhoMovesAndWhoGoesBack(): void
    {
        $this->coming([['fullName' => 'Kojo Asante'], ['fullName' => 'Ada Obi']]);
        [$kojo, $ada] = [$this->personId('Kojo Asante'), $this->personId('Ada Obi')];
        $this->records($kojo, [], 'halal');
        $this->changeMain(['dish' => $this->id($this->jollof), 'chooseBy' => '2026-10-10']);
        self::mockTime(new DateTimeImmutable('2026-10-11T09:00:00+00:00'));
        self::assertSame(3, self::row(self::course($this->picks(), 'Main'), 'Jollof rice')['defaulted']);

        $this->changeMain(['dish' => $this->id($this->suya), 'chooseBy' => '2026-10-10']);

        self::assertSame(409, $this->statusCode(), Json\encode($this->last()));
        self::assertSame(['https://soirely.com/errors/menu_default_move', 2, 1], [$this->last()['type'] ?? null, $this->last()['move'] ?? null, $this->last()['back'] ?? null]);
        self::assertSame($this->id($this->jollof), Type\shape(['dish' => Type\string()], true)->coerce($this->mainOf($this->menu())['default'])['dish'], 'nothing changes until confirmed');

        $this->changeMain(['dish' => $this->id($this->suya), 'chooseBy' => '2026-10-10'], confirmMove: true);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        $picks = $this->picks();
        self::assertSame(2, self::row(self::course($picks, 'Main'), 'Beef suya skewers')['defaulted']);
        self::assertSame([['course' => $this->id($this->main), 'reason' => 'halal']], self::waiting($picks, $kojo)['excluded']);

        $this->chooseFor($ada, ['answer' => 'chosen', 'dish' => $this->id($this->suya)]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        $chosen = $this->picks();
        self::assertSame([1, 1], [self::row(self::course($chosen, 'Main'), 'Beef suya skewers')['chosen'], self::row(self::course($chosen, 'Main'), 'Beef suya skewers')['defaulted']]);
        self::assertNotContains($ada, Vec\flat_map(Type\vec(Type\shape(['people' => Type\vec(Type\shape(['id' => Type\string()], true))], true))->coerce($chosen['given']), static fn (array $party): array => Vec\map($party['people'], static fn (array $one): string => $one['id'])));
    }

    #[Test]
    public function theDefaultCannotBeRemovedWhileItIsTheDefault(): void
    {
        $this->changeMain(['dish' => $this->id($this->stew), 'variant' => $this->plate->getId()->toRfc4122(), 'chooseBy' => '2026-10-10']);

        $this->as('DELETE', '/api/events/' . $this->eventId . '/menu/dishes/' . $this->id($this->stew));
        self::assertSame([409, 'https://soirely.com/errors/menu_is_default', 'Rice and stew is Main’s default. Choose another default first, in Edit course.'], [$this->statusCode(), $this->last()['type'] ?? null, $this->last()['detail'] ?? null]);

        $this->as('DELETE', '/api/events/' . $this->eventId . '/menu/variants/' . $this->plate->getId()->toRfc4122());
        self::assertSame([409, 'https://soirely.com/errors/menu_is_default'], [$this->statusCode(), $this->last()['type'] ?? null]);

        $this->as('DELETE', '/api/events/' . $this->eventId . '/menu/dishes/' . $this->id($this->suya));
        self::assertSame(200, $this->statusCode(), 'another dish still goes');
    }

    #[Test]
    public function aCourseThatAsksNothingTakesNoDefault(): void
    {
        $soup = $this->id($this->starter, 0);
        $this->as('PUT', '/api/events/' . $this->eventId . '/menu/courses/' . $this->id($this->starter), ['name' => 'Starter', 'answer' => 'same', 'skippable' => false, 'default' => ['dish' => $soup, 'chooseBy' => '2026-10-10']]);

        self::assertSame(422, $this->statusCode(), Json\encode($this->last()));
    }

    /** @return array<string, mixed> */
    private static function resolve(mixed $default, self $test): array
    {
        $ids = ['jollof' => $test->id($test->jollof), 'stew' => $test->id($test->stew), 'kidsPlate' => $test->kidsPlate->getId()->toRfc4122()];

        return Type\dict(Type\string(), Type\mixed())->coerce(Dict\map_with_key(Type\dict(Type\string(), Type\mixed())->coerce($default), static fn (string $key, mixed $value): mixed => \is_string($value) && isset($ids[$value]) && 'chooseBy' !== $key ? $ids[$value] : $value));
    }

    /** @param array<string, mixed> $default */
    private function changeMain(array $default, bool $confirmMove = false): void
    {
        $this->as('PUT', '/api/events/' . $this->eventId . '/menu/courses/' . $this->id($this->main), ['name' => 'Main', 'answer' => 'choose', 'skippable' => false, 'default' => $default, 'confirmMove' => $confirmMove]);
    }

    /** @return array<string, mixed> */
    private function menu(): array
    {
        $this->as('GET', '/api/events/' . $this->eventId . '/menu');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        return $this->last();
    }

    /** @return array<string, mixed> */
    private function mainOf(mixed $menu): array
    {
        $courses = Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce(Type\mixed_dict()->coerce($menu['menu'] ?? null)['courses'] ?? null);

        return Iter\search($courses, fn (array $course): bool => $this->id($this->main) === ($course['id'] ?? null)) ?? self::fail('no main');
    }

    /** @return array<string, mixed> */
    private function picks(): array
    {
        $this->as('GET', '/api/events/' . $this->eventId . '/menu/picks');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        return Type\dict(Type\string(), Type\mixed())->coerce($this->last()['picks'] ?? null);
    }

    /** @param array<string, mixed> $body */
    private function chooseFor(string $person, array $body): void
    {
        $this->as('PUT', '/api/events/' . $this->eventId . '/menu/picks/people/' . $person . '/courses/' . $this->id($this->main), $body);
    }

    /** @return array<string, mixed> */
    private static function course(mixed $picks, string $name): array
    {
        $courses = Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce(Type\mixed_dict()->coerce($picks)['courses'] ?? null);

        return Iter\search($courses, static fn (array $course): bool => $name === ($course['name'] ?? null)) ?? self::fail('no course ' . $name);
    }

    /** @return array<string, mixed> */
    private static function row(mixed $course, string $name): array
    {
        $rows = Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce(Type\mixed_dict()->coerce($course)['rows'] ?? null);

        return Iter\search($rows, static fn (array $row): bool => $name === ($row['name'] ?? null)) ?? self::fail('no row ' . $name);
    }

    /** @return array<string, mixed> */
    private static function waiting(mixed $picks, string $person): array
    {
        $parties = Type\vec(Type\shape(['people' => Type\vec(Type\dict(Type\string(), Type\mixed()))], true))->coerce(Type\mixed_dict()->coerce($picks)['waiting'] ?? null);

        return Iter\search(Vec\flat_map($parties, static fn (array $party): array => $party['people']), static fn (array $one): bool => $person === ($one['id'] ?? null)) ?? self::fail('not waiting');
    }

    private function id(MenuCourse|MenuDish $row, ?int $dish = null): string
    {
        if (null === $dish) {
            return $row->getId()->toRfc4122();
        }

        return Type\string()->coerce(self::service(Connection::class)->fetchOne('SELECT id FROM menu_dishes WHERE course_id = :course ORDER BY position LIMIT 1 OFFSET ' . $dish, ['course' => $row->getId()->toRfc4122()]));
    }

    /** @param list<string> $allergies */
    private function records(string $guestId, array $allergies, string ...$diets): void
    {
        $person = self::em()->find(Guest::class, Uuid::fromString($guestId)) ?? self::fail('no guest');
        $needs = GuestNeeds::none();
        self::service(GuestNeedsRecord::class)->write($person, new GuestNeeds([...$needs->codes, NeedKind::Allergen->value => $allergies, NeedKind::Diet->value => Vec\values($diets)], $needs->others, null), $this->owner);
        self::em()->flush();
    }

    private function coming(array $companions): string
    {
        $this->as('POST', $this->guests(), ['fullName' => 'Bisi Adewale', 'companions' => Vec\map($companions, static fn (array $one): array => ['fullName' => $one['fullName']])]);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
        $guestId = Type\shape(['id' => Type\string()], true)->coerce($this->last()['guest'] ?? null)['id'];
        $this->as('GET', $this->guests() . '/' . $guestId . '/link');
        $token = Str\after(Type\string()->coerce($this->last()['url'] ?? null), '/i/') ?? self::fail('no token');
        $this->anonymous('/api/guest-links/page', ['token' => $token]);
        $page = $this->last();
        $listed = Type\vec(Type\shape(['id' => Type\string()], true))->coerce(Type\mixed_dict()->coerce($page['guest'] ?? null)['companions'] ?? []);
        $this->anonymous('/api/guest-links/reply', [
            'token' => $token,
            'answer' => 'coming',
            'needs' => ['allergies' => []],
            'companions' => Vec\map_with_key($listed, static fn (int $at, array $companion): array => ['id' => $companion['id'], ...(null === ($companions[$at]['fullName'] ?? null) ? [] : ['fullName' => $companions[$at]['fullName']]), 'coming' => true]),
        ]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        return $token;
    }

    private function personId(string $name): string
    {
        return Type\string()->coerce(self::service(Connection::class)->fetchOne('SELECT id FROM guests WHERE full_name = :name', ['name' => $name]));
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

    private function guests(): string
    {
        return '/api/events/' . $this->eventId . '/guests';
    }

    private function account(string $address): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Person', self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    /** @param array<string, mixed>|null $body */
    private function as(string $method, string $path, ?array $body = null): void
    {
        $who = self::em()->find(User::class, $this->owner->getId()) ?? self::fail('no user');
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($who),
            'HTTP_ACCEPT_LANGUAGE' => 'en',
        ], content: null === $body ? null : Json\encode($body));
    }

    /** @return array<string, mixed> */
    private function last(): array
    {
        $raw = (string) $this->client->getResponse()->getContent();

        return '' === $raw ? [] : Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($raw));
    }

    private function statusCode(): int
    {
        return $this->client->getResponse()->getStatusCode();
    }
}
