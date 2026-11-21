<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Guest\GuestNeedsRecord;
use App\Domain\Guest\Model\GuestNeeds;
use App\Domain\Menu\Pick\StoredMenuPicks;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\MealAnswer;
use App\Entity\MenuChoiceOption;
use App\Entity\MenuCourse;
use App\Entity\MenuDish;
use App\Entity\MenuDishChoice;
use App\Entity\MenuDishVariant;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\NeedKind;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use Doctrine\DBAL\Connection;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use SensitiveParameter;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Uid\Uuid;

/** A guest picks a meal for each person coming (sc-3907): one answer per person per course, against their allergens, until the course closes. */
final class MealPicksTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private User $owner;

    private string $eventId;

    private MenuCourse $main;

    private MenuDish $jollof;

    private MenuDish $egusi;

    private MenuDish $gizdodo;

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
        $this->main = new MenuCourse($event, 'Main', null, 0);
        $this->jollof = new MenuDish($this->main, null, 'Jollof rice', null, ['celery'], [], 0);
        $this->egusi = new MenuDish($this->main, null, 'Pounded yam and egusi', null, ['milk', 'fish'], [], 1);
        $this->gizdodo = new MenuDish($this->main, null, 'Gizdodo', null, null, [], 2);
        self::em()->persist($this->main);
        self::em()->persist($this->jollof);
        self::em()->persist($this->egusi);
        self::em()->persist($this->gizdodo);
        self::em()->flush();
    }

    #[Test]
    public function thePageOffersEachCourseThatAsksAndAPickIsStoredForEachPerson(): void
    {
        $token = $this->coming(['companions' => [['fullName' => 'Chidi Okonkwo-Williams']]], []);
        $page = $this->open($token);
        $chidi = $this->companionIds($page)[0];
        $guest = $this->guestId();

        self::assertSame($guest, Type\shape(['you' => Type\string()], true)->coerce($page['meals'] ?? null)['you']);
        self::assertSame(['Main'], Vec\map($this->courses(), static fn (array $course): string => Type\string()->coerce($course['name'] ?? null)));

        $this->meals($token, [
            ['person' => $guest, 'course' => $this->id($this->main), 'answer' => 'chosen', 'dish' => $this->id($this->jollof)],
            ['person' => $chidi, 'course' => $this->id($this->main), 'answer' => 'chefsChoice'],
        ]);
        $page = $this->last();

        self::assertSame(200, $this->statusCode(), Json\encode($page));
        self::assertSame('chosen', $this->answerOf($guest)['answer'] ?? null);
        self::assertSame($this->id($this->jollof), $this->answerOf($guest)['dish'] ?? null);
        self::assertSame('chefsChoice', $this->answerOf($chidi)['answer'] ?? null);
        self::assertCount(2, self::em()->getRepository(MealAnswer::class)->findAll());
    }

    #[Test]
    public function aDishHoldingThePersonsAllergenOrStatingNothingIsRefusedAndNothingIsSaved(): void
    {
        $token = $this->coming([], ['milk']);
        $guest = $this->guestId();

        foreach ([$this->egusi, $this->gizdodo] as $dish) {
            $this->meals($token, [['person' => $guest, 'course' => $this->id($this->main), 'answer' => 'chosen', 'dish' => $this->id($dish)]]);

            self::assertSame(422, $this->statusCode(), $dish->getName());
        }

        self::assertSame([], self::em()->getRepository(MealAnswer::class)->findAll());
    }

    #[Test]
    public function anOtherAllergyRulesNothingOut(): void
    {
        $token = $this->coming(['needs' => ['allergies' => ['other'], 'otherAllergy' => 'Kiwi']], null);

        $this->meals($token, [['person' => $this->guestId(), 'course' => $this->id($this->main), 'answer' => 'chosen', 'dish' => $this->id($this->gizdodo)]]);

        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    #[Test]
    public function anAllergyRecordedAfterThePickServesItAsNeedsTheHostUntilItIsRemoved(): void
    {
        $token = $this->coming([], []);
        $guest = $this->guestId();
        $this->meals($token, [['person' => $guest, 'course' => $this->id($this->main), 'answer' => 'chosen', 'dish' => $this->id($this->egusi)]]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        $this->hostRecords($guest, ['milk']);
        $page = $this->open($token);

        self::assertSame('needsHost', $this->answerOf($guest)['answer'] ?? null);
        self::assertSame($this->id($this->egusi), $this->answerOf($guest)['dish'] ?? null, 'the guest still sees the pick');

        $this->hostRecords($guest, []);

        self::assertSame('chosen', $this->answerOfOpened($token, $guest)['answer'] ?? null);
    }

    #[Test]
    public function chefsChoiceIsRefusedWhenNothingIsSafeAndNeedsTheHostIsTheAnswer(): void
    {
        $token = $this->coming([], ['celery', 'milk']);
        $guest = $this->guestId();

        $this->meals($token, [['person' => $guest, 'course' => $this->id($this->main), 'answer' => 'chefsChoice']]);
        self::assertSame(422, $this->statusCode());

        $this->meals($token, [['person' => $guest, 'course' => $this->id($this->main), 'answer' => 'needsHost']]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    #[Test]
    public function skippingIsOnlyForAnOptionalCourse(): void
    {
        $token = $this->coming([], []);

        $this->meals($token, [['person' => $this->guestId(), 'course' => $this->id($this->main), 'answer' => 'skipped']]);

        self::assertSame(422, $this->statusCode());
    }

    #[Test]
    public function aVariantIsPickedNeverTheDishAndChildrenOnlyIsNotOffered(): void
    {
        $chicken = new MenuDishVariant($this->jollof, 'Chicken', false, ['celery'], [], null, 0);
        $fish = new MenuDishVariant($this->jollof, 'Fish', false, ['fish'], [], null, 1);
        $small = new MenuDishVariant($this->jollof, 'Small', true, [], [], null, 2);
        Iter\apply([$chicken, $fish, $small], static fn (MenuDishVariant $variant) => self::em()->persist($variant));
        self::em()->flush();
        $token = $this->coming([], ['fish']);
        $guest = $this->guestId();
        $pick = ['person' => $guest, 'course' => $this->id($this->main), 'answer' => 'chosen', 'dish' => $this->id($this->jollof)];

        $this->meals($token, [$pick]);
        self::assertSame(422, $this->statusCode(), 'no way chosen');
        $this->meals($token, [[...$pick, 'variant' => $small->getId()->toRfc4122()]]);
        self::assertSame(422, $this->statusCode(), 'children only');
        $this->meals($token, [[...$pick, 'variant' => $fish->getId()->toRfc4122()]]);
        self::assertSame(422, $this->statusCode(), 'fish allergy');
        $this->meals($token, [[...$pick, 'variant' => $chicken->getId()->toRfc4122()]]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame([$guest], Vec\map(self::service(StoredMenuPicks::class)->pickersOfVariant($chicken), static fn (Guest $person): string => $person->getId()->toRfc4122()));
    }

    #[Test]
    public function aChoiceTakesExactlyItsCountAndCountsOnTheMenu(): void
    {
        $side = new MenuDishChoice($this->jollof, 'And a side?', 1, true, 0);
        $plantain = new MenuChoiceOption($side, 'Plantain', [], 0);
        $moimoi = new MenuChoiceOption($side, 'Moi moi', ['eggs'], 1);
        Iter\apply([$side, $plantain, $moimoi], static fn (object $row) => self::em()->persist($row));
        self::em()->flush();
        $token = $this->coming([], []);
        $pick = ['person' => $this->guestId(), 'course' => $this->id($this->main), 'answer' => 'chosen', 'dish' => $this->id($this->jollof)];

        $this->meals($token, [[...$pick, 'options' => []]]);
        self::assertSame(422, $this->statusCode(), 'none of a required one');
        $this->meals($token, [[...$pick, 'options' => [$plantain->getId()->toRfc4122(), $moimoi->getId()->toRfc4122()]]]);
        self::assertSame(422, $this->statusCode(), 'two of one');
        $this->meals($token, [[...$pick, 'options' => [$plantain->getId()->toRfc4122()]]]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        $picks = self::service(StoredMenuPicks::class);
        self::assertSame([1, 0], [Iter\count($picks->pickersOfOption($plantain)), Iter\count($picks->pickersOfOption($moimoi))]);
        self::assertSame(1, Iter\count($picks->pickersOf($this->jollof)));
    }

    #[Test]
    public function aChangedPickOnAClosedCourseSavesNothingAndIsRefused(): void
    {
        $token = $this->coming([], []);
        $guest = $this->guestId();
        $pick = ['person' => $guest, 'course' => $this->id($this->main), 'answer' => 'chosen', 'dish' => $this->id($this->jollof)];
        $this->meals($token, [$pick]);
        self::mockTime(new DateTimeImmutable('2030-11-14T16:00:00+00:00'));

        $this->meals($token, [$pick]);
        self::assertSame(200, $this->statusCode(), 'the same pick again is no change');

        $this->meals($token, [[...$pick, 'dish' => $this->id($this->egusi)]]);
        self::assertSame(409, $this->statusCode());
        self::assertSame(ErrorCode::MealPicksClosed->type(), $this->last()['type'] ?? null);
        self::assertSame([$this->id($this->main)], $this->last()['courses'] ?? null);
        self::assertSame($this->id($this->jollof), $this->answerOfOpened($token, $guest)['dish'] ?? null);
    }

    #[Test]
    public function aPersonNotWithTheGuestIsRefused(): void
    {
        $token = $this->coming([], []);

        $this->meals($token, [['person' => Uuid::v7()->toRfc4122(), 'course' => $this->id($this->main), 'answer' => 'chefsChoice']]);

        self::assertSame(422, $this->statusCode());
    }

    #[Test]
    public function anEventWithNoCourseThatAsksHasNoMealStep(): void
    {
        $this->main->setGuestsChoose(false);
        self::em()->remove($this->egusi);
        self::em()->remove($this->gizdodo);
        self::em()->flush();

        $this->open($this->coming([], []));

        self::assertSame([], $this->courses());
    }

    private function id(MenuCourse|MenuDish $row): string
    {
        return $row->getId()->toRfc4122();
    }

    /**
     * @param array<string, mixed> $with
     * @param ?list<string>        $allergies null keeps `$with`'s own needs
     */
    private function coming(array $with, ?array $allergies): string
    {
        $this->as('POST', $this->guests(), ['fullName' => 'Bisi Adewale', 'companions' => Vec\map(Type\vec(Type\mixed_dict())->coerce($with['companions'] ?? []), static fn (array $companion): array => $companion)]);
        $guestId = Type\shape(['id' => Type\string()], true)->coerce($this->last()['guest'] ?? null)['id'];
        $this->as('GET', $this->guests() . '/' . $guestId . '/link');
        $token = Str\after(Type\string()->coerce($this->last()['url'] ?? null), '/i/') ?? self::fail('no token');
        $page = $this->open($token);
        self::assertSame(200, $this->statusCode(), Json\encode($page));
        $needs = $with['needs'] ?? ['allergies' => $allergies ?? []];
        $this->anonymous('/api/guest-links/reply', [
            'token' => $token,
            'answer' => 'coming',
            'needs' => $needs,
            'companions' => Vec\map(
                Type\vec(Type\shape(['id' => Type\string(), 'fullName' => Type\nullable(Type\string())], true))->coerce(Type\mixed_dict()->coerce($page['guest'] ?? null)['companions'] ?? []),
                static fn (array $companion): array => ['id' => $companion['id'], 'fullName' => $companion['fullName'], 'coming' => true],
            ),
        ]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        return $token;
    }

    private function guestId(): string
    {
        return Type\string()->coerce(self::service(Connection::class)->fetchOne("SELECT id FROM guests WHERE full_name = 'Bisi Adewale'"));
    }

    /** @param list<string> $allergies */
    private function hostRecords(string $guestId, array $allergies): void
    {
        $person = self::em()->find(Guest::class, Uuid::fromString($guestId)) ?? self::fail('no guest');
        $needs = GuestNeeds::none();
        self::service(GuestNeedsRecord::class)->write($person, new GuestNeeds([...$needs->codes, NeedKind::Allergen->value => $allergies], $needs->others, null), $this->owner);
        self::em()->flush();
    }

    /** @param list<array<string, mixed>> $picks */
    private function meals(#[SensitiveParameter] string $token, array $picks): void
    {
        $this->anonymous('/api/guest-links/meals', ['token' => $token, 'picks' => $picks]);
    }

    /** @return list<array<string, mixed>> on the page last answered */
    private function courses(): array
    {
        return Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce(Type\shape(['courses' => Type\mixed()], true)->coerce($this->last()['meals'] ?? null)['courses']);
    }

    /** @return array<string, mixed> on the page last answered */
    private function answerOf(string $person): array
    {
        $answers = Type\dict(Type\string(), Type\vec(Type\dict(Type\string(), Type\mixed())))->coerce(Type\shape(['answers' => Type\mixed()], true)->coerce($this->last()['meals'] ?? null)['answers']);

        return $answers[$person][0] ?? [];
    }

    /** @return array<string, mixed> */
    private function answerOfOpened(#[SensitiveParameter] string $token, string $person): array
    {
        $this->open($token);

        return $this->answerOf($person);
    }

    /** @param array<string, mixed> $page */
    private function companionIds(array $page): array
    {
        $guest = Type\mixed_dict()->coerce($page['guest'] ?? null);

        return Vec\map(Type\vec(Type\shape(['id' => Type\string()], true))->coerce($guest['companions'] ?? []), static fn (array $one): string => $one['id']);
    }

    /** @return array<string, mixed> */
    private function open(#[SensitiveParameter] string $token): array
    {
        $this->anonymous('/api/guest-links/page', ['token' => $token]);

        return $this->last();
    }

    /** @param array<string, mixed> $body */
    private function anonymous(string $path, #[SensitiveParameter] array $body): void
    {
        $this->client->request('POST', $path, server: ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT_LANGUAGE' => 'en'], content: Json\encode($body));
    }

    private function live(Organisation $organisation): string
    {
        $this->as('POST', '/api/orgs/' . $organisation->getId()->toRfc4122() . '/events', ['name' => "Amara & Tobi's wedding", 'type' => 'wedding', 'startsAt' => '2030-11-14T16:00', 'endsAt' => '2030-11-15T02:00', 'timeZone' => 'Africa/Lagos', 'currency' => 'NGN']);
        $body = $this->last();
        self::assertSame(201, $this->statusCode(), Json\encode($body));
        $id = Type\shape(['id' => Type\string()], true)->coerce($body['event'] ?? null)['id'];
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
    private function as(string $method, string $path, ?array $body = null, ?string $ifMatch = null): void
    {
        $who = self::em()->find(User::class, $this->owner->getId()) ?? self::fail('no user');
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($who),
            'HTTP_ACCEPT_LANGUAGE' => 'en',
            ...null === $ifMatch ? [] : ['HTTP_IF_MATCH' => $ifMatch],
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
